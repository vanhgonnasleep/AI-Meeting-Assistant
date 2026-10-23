"""Identity metadata is separate from every account's meeting database."""
import hashlib
import secrets
import sqlite3
import time
from contextlib import closing
from uuid import uuid4

from .config import settings
from app.core.error_boundary import StorageUnavailableError

SESSION_SECONDS = 24 * 60 * 60
STATE_SECONDS = 10 * 60


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), 200_000).hex()
    return f'pbkdf2_sha256$200000${salt}${derived}'


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not password or not stored_hash or '$' not in stored_hash:
        return False
    try:
        scheme, iterations, salt, expected = stored_hash.split('$', 3)
        if scheme != 'pbkdf2_sha256':
            return False
        derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), int(iterations)).hex()
        return secrets.compare_digest(derived, expected)
    except Exception:
        return False


def connect():
    directory = settings().data_dir
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise StorageUnavailableError('Account storage could not be prepared.') from exc
    connection = sqlite3.connect(directory / 'identity.db', timeout=15)
    connection.row_factory = sqlite3.Row
    connection.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL,
            name TEXT NOT NULL, email TEXT, password_hash TEXT, UNIQUE(provider, subject)
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
            csrf TEXT NOT NULL, expires REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS oauth_states (
            state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL,
            provider TEXT NOT NULL, verifier TEXT NOT NULL, expires REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires);
        CREATE INDEX IF NOT EXISTS idx_oauth_expiry ON oauth_states(expires);
    ''')
    columns = {row['name'] for row in connection.execute('PRAGMA table_info(users)').fetchall()}
    if 'password_hash' not in columns:
        connection.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
    return connection


def begin_login(provider):
    state, browser, verifier = (secrets.token_urlsafe(48) for _ in range(3))
    with closing(connect()) as connection, connection:
        connection.execute('DELETE FROM oauth_states WHERE expires <= ?', (time.time(),))
        connection.execute('INSERT INTO oauth_states VALUES(?,?,?,?,?)',
                           (digest(state), digest(browser), provider, verifier, time.time() + STATE_SECONDS))
    return state, browser, verifier


def consume_login(provider, state, browser):
    if not state or not browser or max(len(state), len(browser)) > 256:
        return None
    with closing(connect()) as connection, connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute('SELECT * FROM oauth_states WHERE state_hash=?', (digest(state),)).fetchone()
        if (not row or row['expires'] <= time.time() or row['provider'] != provider
                or not secrets.compare_digest(row['browser_hash'], digest(browser))):
            return None
        connection.execute('DELETE FROM oauth_states WHERE state_hash=?', (digest(state),))
        return row['verifier']


def create_session(provider, identity):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    with closing(connect()) as connection, connection:
        connection.execute('BEGIN IMMEDIATE')
        connection.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
        user = connection.execute('SELECT id FROM users WHERE provider=? AND subject=?',
                                  (provider, identity['subject'])).fetchone()
        user_id = user['id'] if user else str(uuid4())
        connection.execute('''INSERT INTO users(id,provider,subject,name,email) VALUES(?,?,?,?,?)
            ON CONFLICT(provider,subject) DO UPDATE SET name=excluded.name,email=excluded.email''',
                           (user_id, provider, identity['subject'], identity['name'], identity.get('email')))
        connection.execute('INSERT INTO sessions VALUES(?,?,?,?)',
                           (digest(token), user_id, csrf, time.time() + SESSION_SECONDS))
    return token


def register_local_user(name: str, email: str, password: str):
    email_clean = email.strip().lower()
    name_clean = name.strip() or email_clean.split('@')[0]
    pw_hash = hash_password(password)
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    with closing(connect()) as connection, connection:
        connection.execute('BEGIN IMMEDIATE')
        connection.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
        existing = connection.execute(
            'SELECT id FROM users WHERE provider=? AND subject=?',
            ('local', email_clean)
        ).fetchone()
        if existing:
            raise ValueError('An account with this email already exists.')
        user_id = str(uuid4())
        connection.execute(
            'INSERT INTO users(id, provider, subject, name, email, password_hash) VALUES(?,?,?,?,?,?)',
            (user_id, 'local', email_clean, name_clean, email_clean, pw_hash)
        )
        connection.execute(
            'INSERT INTO sessions VALUES(?,?,?,?)',
            (digest(token), user_id, csrf, time.time() + SESSION_SECONDS)
        )
    return token, {
        'id': user_id,
        'provider': 'local',
        'name': name_clean,
        'email': email_clean,
        'csrf': csrf,
    }


def authenticate_local_user(email: str, password: str):
    email_clean = email.strip().lower()
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    with closing(connect()) as connection, connection:
        connection.execute('BEGIN IMMEDIATE')
        connection.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
        row = connection.execute(
            'SELECT id, provider, name, email, password_hash FROM users WHERE provider=? AND subject=?',
            ('local', email_clean)
        ).fetchone()
        if not row or not verify_password(password, row['password_hash']):
            return None
        connection.execute(
            'INSERT INTO sessions VALUES(?,?,?,?)',
            (digest(token), row['id'], csrf, time.time() + SESSION_SECONDS)
        )
        return token, {
            'id': row['id'],
            'provider': row['provider'],
            'name': row['name'],
            'email': row['email'],
            'csrf': csrf,
        }


def update_user_account(
    user_id: str,
    name: str | None = None,
    current_password: str | None = None,
    new_password: str | None = None,
):
    with closing(connect()) as connection, connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute(
            'SELECT id, provider, subject, name, email, password_hash FROM users WHERE id=?',
            (user_id,)
        ).fetchone()
        if not row:
            raise LookupError('Account not found.')
        updated_name = row['name']
        if name is not None and name.strip():
            updated_name = name.strip()
        updated_hash = row['password_hash']
        if new_password:
            if row['password_hash'] and not verify_password(current_password or '', row['password_hash']):
                raise PermissionError('Current password is incorrect.')
            updated_hash = hash_password(new_password)
        connection.execute(
            'UPDATE users SET name=?, password_hash=? WHERE id=?',
            (updated_name, updated_hash, user_id)
        )
        return {
            'id': row['id'],
            'provider': row['provider'],
            'name': updated_name,
            'email': row['email'],
        }


def find_session(token):
    if not token or len(token) > 256:
        return None
    with closing(connect()) as connection:
        row = connection.execute('''SELECT u.id,u.provider,u.name,u.email,s.csrf FROM sessions s
            JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?''',
                                 (digest(token), time.time())).fetchone()
        return dict(row) if row else None


def revoke_session(token):
    if token and len(token) <= 256:
        with closing(connect()) as connection, connection:
            connection.execute('DELETE FROM sessions WHERE token_hash=?', (digest(token),))
