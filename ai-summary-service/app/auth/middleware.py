"""ASGI session and CSRF boundary preserves context until streaming completes."""
import secrets
from threading import Lock

from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.responses import JSONResponse

from database import db
from app.core.error_boundary import StorageUnavailableError
from .config import settings
from .store import find_session

SESSION_COOKIE = 'clarion_session'
PUBLIC_PATHS = {'/api/health', '/api/version', '/api/auth/session'}
LOGIN_PATHS = {f'/api/auth/{provider}/{action}' for provider in ('google', 'github') for action in ('login', 'callback')}
_ready = set()
_schema_lock = Lock()


def ensure_database(path):
    with _schema_lock:
        if path not in _ready or not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            db.init_db()
            _ready.add(path)


class PrivateWorkspaceMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not scope.get('path', '').startswith('/api/'):
            return await self.app(scope, receive, send)
        config = settings()
        session = None
        original_send = send

        async def uncached_send(message):
            if message['type'] == 'http.response.start':
                headers = [(key, value) for key, value in message.get('headers', []) if key.lower() != b'cache-control']
                if session:
                    headers.append((b'x-clarion-account', session['id'].encode('ascii')))
                message = {**message, 'headers': headers + [(b'cache-control', b'no-store')]}
            await original_send(message)

        send = uncached_send
        if config.mode == 'local':
            return await self.app(scope, receive, send)
        request = Request(scope)
        session = await run_in_threadpool(find_session, request.cookies.get(SESSION_COOKIE))
        scope.setdefault('state', {})['account'] = session
        path = scope['path']
        public = path in PUBLIC_PATHS or path in LOGIN_PATHS or scope['method'] == 'OPTIONS'
        if not public and not session:
            return await JSONResponse({'detail': 'Sign in to access your private workspace.'}, status_code=401)(scope, receive, send)
        if session and scope['method'] not in {'GET', 'HEAD', 'OPTIONS'}:
            headers = Headers(scope=scope)
            csrf = headers.get('x-csrf-token', '')
            if (headers.get('origin') != config.frontend_url
                    or not csrf.isascii() or not secrets.compare_digest(csrf, session['csrf'])):
                return await JSONResponse({'detail': 'Request verification failed. Reload and try again.'}, status_code=403)(scope, receive, send)
        if not session or public:
            return await self.app(scope, receive, send)
        path = config.data_dir / 'users' / session['id'] / 'meeting.db'
        selection = db.ACTIVE_DB_PATH.set(path)
        try:
            try:
                await run_in_threadpool(ensure_database, path)
            except OSError as exc:
                raise StorageUnavailableError('Workspace storage could not be prepared.') from exc
            await self.app(scope, receive, send)
        finally:
            db.ACTIVE_DB_PATH.reset(selection)
