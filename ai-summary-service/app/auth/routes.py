"""Public status reveals availability, never provider credentials."""
import re
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request, HTTPException, Query
from starlette.responses import RedirectResponse, JSONResponse
from .config import settings
from .middleware import SESSION_COOKIE
from .providers import authorization_url, identify
from . import store

router = APIRouter(prefix='/api/auth', tags=['authentication'])
LOGIN_COOKIE = 'clarion_login'
EMAIL_PATTERN = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


class RegisterPayload(BaseModel):
    name: str = Field(default='', max_length=120)
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=256)


class LoginPayload(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=256)


class AccountUpdatePayload(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    current_password: str | None = Field(default=None, max_length=256)
    new_password: str | None = Field(default=None, max_length=256)


def _session_response(config, token: str, session: dict, status_code: int = 200) -> JSONResponse:
    response = JSONResponse(
        {
            'mode': config.mode,
            'providers': config.providers(),
            'user': {key: session[key] for key in ('id', 'name', 'email', 'provider')},
            'csrf_token': session['csrf'],
            'authenticated': True,
        },
        status_code=status_code,
        headers={'X-Clarion-Account': session['id']},
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=store.SESSION_SECONDS,
        httponly=True,
        secure=config.secure_cookie,
        samesite='lax',
        path='/',
    )
    return response


@router.get('/session')
def current_session(request: Request):
    config = settings()
    session = getattr(request.state, 'account', None)
    return {'mode': config.mode, 'providers': config.providers(),
            'user': {key: session[key] for key in ('id', 'name', 'email', 'provider')} if session else None,
            'csrf_token': session['csrf'] if session else None,
            'authenticated': bool(session)}


@router.post('/register')
def register_local(payload: RegisterPayload, request: Request):
    config = settings()
    if config.mode != 'private':
        raise HTTPException(409, 'Registration is available in private workspace mode.')
    email = payload.email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(400, 'Please enter a valid email address.')
    if len(payload.password) < 8:
        raise HTTPException(400, 'Password must be at least 8 characters long.')
    name = payload.name.strip() or email.split('@')[0]
    try:
        token, session = store.register_local_user(name=name, email=email, password=payload.password)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    store.revoke_session(request.cookies.get(SESSION_COOKIE))
    return _session_response(config, token, session, status_code=201)


@router.post('/login')
def login_local(payload: LoginPayload, request: Request):
    config = settings()
    if config.mode != 'private':
        raise HTTPException(409, 'Sign-in is available in private workspace mode.')
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(400, 'Enter both your email and password.')
    authenticated = store.authenticate_local_user(email=email, password=payload.password)
    if not authenticated:
        raise HTTPException(401, 'Invalid email or password. Please check your credentials and try again.')
    token, session = authenticated
    store.revoke_session(request.cookies.get(SESSION_COOKIE))
    return _session_response(config, token, session, status_code=200)


@router.patch('/account')
def update_account(payload: AccountUpdatePayload, request: Request):
    session = getattr(request.state, 'account', None)
    if not session:
        raise HTTPException(401, 'Sign in to manage your account.')
    if payload.name is not None and not payload.name.strip():
        raise HTTPException(400, 'Display name cannot be empty.')
    if payload.new_password is not None and payload.new_password != '' and len(payload.new_password) < 8:
        raise HTTPException(400, 'New password must be at least 8 characters long.')
    try:
        updated = store.update_user_account(
            user_id=session['id'],
            name=payload.name.strip() if payload.name is not None else None,
            current_password=payload.current_password,
            new_password=payload.new_password if payload.new_password else None,
        )
    except PermissionError as exc:
        raise HTTPException(400, str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {'user': updated, 'status': 'updated'}


@router.get('/{provider}/login')
def login(provider: str, request: Request):
    config = settings()
    if provider not in {'google', 'github'}:
        raise HTTPException(404, 'Unknown sign-in provider.')
    if config.mode != 'private':
        raise HTTPException(409, 'Sign-in is available in private workspace mode.')
    if not config.providers()[provider]:
        raise HTTPException(503, 'This sign-in provider is not configured. Set its server client ID and secret.')
    if getattr(request.state, 'account', None):
        return RedirectResponse(config.frontend_url + '/', status_code=303)
    state, browser, verifier = store.begin_login(provider)
    response = RedirectResponse(authorization_url(provider, config, state, verifier), status_code=302)
    response.set_cookie(LOGIN_COOKIE, browser, max_age=store.STATE_SECONDS, httponly=True,
                        secure=config.secure_cookie, samesite='lax', path='/api/auth')
    return response


@router.get('/{provider}/callback')
def callback(provider: str, request: Request, state: str = Query('', max_length=256),
             code: str = Query('', max_length=4096), error: str = Query('', max_length=256)):
    config = settings()
    if provider not in {'google', 'github'} or config.mode != 'private':
        raise HTTPException(400, 'Invalid sign-in callback.')
    verifier = store.consume_login(provider, state, request.cookies.get(LOGIN_COOKIE))
    if not verifier:
        raise HTTPException(400, 'Sign-in expired or could not be verified. Start sign-in again.')
    if error:
        response = RedirectResponse(config.frontend_url + '/?auth_error=cancelled', status_code=303)
    elif not code or not config.providers()[provider]:
        raise HTTPException(400, 'Sign-in callback is incomplete. Start sign-in again.')
    else:
        try:
            identity = identify(provider, code=code, verifier=verifier, config=config)
        except Exception:
            response = RedirectResponse(config.frontend_url + '/?auth_error=provider_failed', status_code=303)
        else:
            store.revoke_session(request.cookies.get(SESSION_COOKIE))
            token = store.create_session(provider, identity)
            response = RedirectResponse(config.frontend_url + '/', status_code=303)
            response.set_cookie(SESSION_COOKIE, token, max_age=store.SESSION_SECONDS, httponly=True,
                                secure=config.secure_cookie, samesite='lax', path='/')
    response.delete_cookie(LOGIN_COOKIE, path='/api/auth', secure=config.secure_cookie, httponly=True, samesite='lax')
    return response


@router.post('/logout')
def logout(request: Request):
    config = settings()
    store.revoke_session(request.cookies.get(SESSION_COOKIE))
    response = JSONResponse({'status': 'signed_out'})
    response.delete_cookie(SESSION_COOKIE, path='/', secure=config.secure_cookie, httponly=True, samesite='lax')
    return response
