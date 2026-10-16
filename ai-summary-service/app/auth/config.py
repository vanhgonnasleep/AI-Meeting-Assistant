"""Server-only OAuth settings; no credentials are returned to the browser."""
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


def _origin(name, default):
    value = os.environ.get(name, default).rstrip('/')
    parsed = urlsplit(value)
    if (parsed.scheme not in {'http', 'https'} or not parsed.hostname
            or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment):
        raise ValueError(f'{name} must be an absolute HTTP(S) origin without a path.')
    if parsed.scheme != 'https' and parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError(f'{name} requires HTTPS outside loopback development.')
    return value


@dataclass(frozen=True)
class AuthSettings:
    mode: str
    public_url: str
    frontend_url: str
    data_dir: Path

    @property
    def secure_cookie(self):
        return self.public_url.startswith('https:')

    def credentials(self, provider):
        if provider not in {'google', 'github'}:
            return '', ''
        return (os.environ.get(f'{provider.upper()}_CLIENT_ID', '').strip(),
                os.environ.get(f'{provider.upper()}_CLIENT_SECRET', '').strip())

    def providers(self):
        return {name: all(self.credentials(name)) for name in ('google', 'github')}


def settings():
    mode = os.environ.get('CLARION_AUTH_MODE', 'private')
    if mode not in {'private', 'local'}:
        raise ValueError('CLARION_AUTH_MODE must be private or local.')
    public_url = _origin('CLARION_PUBLIC_URL', 'http://localhost:8002')
    frontend_url = _origin('CLARION_FRONTEND_URL', 'http://localhost:5173')
    if urlsplit(public_url).hostname != urlsplit(frontend_url).hostname:
        raise ValueError('Public API and frontend must use the same hostname for session cookies.')
    directory = Path(os.environ.get('CLARION_DATA_DIR', str(Path(__file__).resolve().parents[3] / 'data'))).resolve()
    return AuthSettings(mode, public_url, frontend_url, directory)
