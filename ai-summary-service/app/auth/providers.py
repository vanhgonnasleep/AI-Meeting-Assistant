"""Minimal identity scopes; provider tokens are discarded after profile lookup."""
from authlib.integrations.requests_client import OAuth2Session

PROVIDERS = {
    'google': {
        'authorize': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token': 'https://oauth2.googleapis.com/token',
        'userinfo': 'https://openidconnect.googleapis.com/v1/userinfo',
        'scope': 'openid email profile',
    },
    'github': {
        'authorize': 'https://github.com/login/oauth/authorize',
        'token': 'https://github.com/login/oauth/access_token',
        'userinfo': 'https://api.github.com/user',
        'scope': 'read:user user:email',
    },
}


def oauth_client(provider, client_id, client_secret, redirect_uri):
    return OAuth2Session(client_id, client_secret, redirect_uri=redirect_uri,
                         scope=PROVIDERS[provider]['scope'], code_challenge_method='S256',
                         token_endpoint_auth_method='client_secret_post')


def authorization_url(provider, config, state, verifier):
    client_id, client_secret = config.credentials(provider)
    with oauth_client(provider, client_id, client_secret, f'{config.public_url}/api/auth/{provider}/callback') as client:
        uri, _ = client.create_authorization_url(PROVIDERS[provider]['authorize'], state=state, code_verifier=verifier)
        return uri


def identify(provider, *, code, verifier, config):
    client_id, client_secret = config.credentials(provider)
    with oauth_client(provider, client_id, client_secret, f'{config.public_url}/api/auth/{provider}/callback') as client:
        client.fetch_token(PROVIDERS[provider]['token'], code=code, code_verifier=verifier,
                           grant_type='authorization_code', timeout=15, headers={'Accept': 'application/json'})
        response = client.get(PROVIDERS[provider]['userinfo'], timeout=15, headers={'Accept': 'application/json'})
        response.raise_for_status()
        profile = response.json()
        if provider == 'google':
            if not profile.get('sub') or profile.get('email_verified') is not True:
                raise ValueError('A verified Google account is required.')
            subject, email = profile['sub'], profile.get('email')
        else:
            if isinstance(profile.get('id'), bool) or not isinstance(profile.get('id'), int) or profile['id'] <= 0:
                raise ValueError('Invalid GitHub account identity.')
            subject = str(profile['id'])
            response = client.get('https://api.github.com/user/emails', timeout=15, headers={'Accept': 'application/json'})
            response.raise_for_status()
            emails = response.json()
            verified = [item for item in emails if isinstance(item, dict) and item.get('verified') is True]
            primary = next((item for item in verified if item.get('primary') is True), next(iter(verified), {}))
            email = primary.get('email')
        if not isinstance(subject, str) or not 1 <= len(subject) <= 255:
            raise ValueError('Invalid provider identity.')
        return {'subject': subject, 'name': str(profile.get('name') or profile.get('login') or 'Meeting owner')[:200],
                'email': str(email)[:320] if email else None}
