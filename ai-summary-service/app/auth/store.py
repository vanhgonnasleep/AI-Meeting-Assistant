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
            name TEXT NOT NULL, email TEXT, UNIQUE(provider, subject)
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
