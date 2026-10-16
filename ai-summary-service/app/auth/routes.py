"""Public status reveals availability, never provider credentials."""
from fastapi import APIRouter, Request, HTTPException, Query
from starlette.responses import RedirectResponse, JSONResponse
from .config import settings
from .middleware import SESSION_COOKIE
from .providers import authorization_url, identify
from . import store

router = APIRouter(prefix='/api/auth', tags=['authentication'])
LOGIN_COOKIE = 'clarion_login'


@router.get('/session')
def current_session(request: Request):
    config = settings()
    session = getattr(request.state, 'account', None)
    return {'mode': config.mode, 'providers': config.providers(),
            'user': {key: session[key] for key in ('id', 'name', 'email', 'provider')} if session else None,
            'csrf_token': session['csrf'] if session else None}


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
