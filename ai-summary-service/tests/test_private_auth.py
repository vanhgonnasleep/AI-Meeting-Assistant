"""Account boundaries use real isolated SQLite storage, never working data."""
import pytest
import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4
from fastapi.testclient import TestClient

import main
from database import crud
import database.db as db
from app.auth import routes, store, providers


@pytest.mark.parametrize('path', ['/api/meetings', '/api/analytics', '/api/projects', '/api/tasks'])
def test_private_mode_rejects_anonymous_library_reads(monkeypatch, path):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    crud.create_meeting(filename='local-private.wav', raw_transcript='Do not expose local records')
    response = TestClient(main.app).get(path)
    assert response.status_code == 401
    assert 'Do not expose' not in response.text


def test_auth_status_is_public_and_has_no_secrets(monkeypatch):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'test-client')
    monkeypatch.setenv('GOOGLE_CLIENT_SECRET', 'never-echo-this-secret')
    response = TestClient(main.app).get('/api/auth/session')
    assert response.status_code == 200
    assert response.json()['user'] is None
    assert response.json()['mode'] == 'private'
    assert response.json()['providers']['google'] is True
    assert 'never-echo-this-secret' not in response.text


def test_explicit_local_mode_keeps_the_legacy_library():
    crud.create_meeting(filename='local.wav', raw_transcript='Offline meeting')
    response = TestClient(main.app).get('/api/meetings')
    assert response.status_code == 200
    assert response.json()['meetings'][0]['filename'] == 'local.wav'


@pytest.fixture
def private(monkeypatch):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    for provider in ('GOOGLE', 'GITHUB'):
        monkeypatch.setenv(f'{provider}_CLIENT_ID', 'client-id')
        monkeypatch.setenv(f'{provider}_CLIENT_SECRET', 'client-secret')
    monkeypatch.setattr(routes, 'identify', lambda provider, **kwargs: {
        'subject': kwargs['code'], 'name': 'Account ' + kwargs['code'], 'email': 'same@example.com',
    }, raising=False)


def start_login(client, provider='google'):
    response = client.get(f'/api/auth/{provider}/login', follow_redirects=False)
    assert response.status_code == 302
    parameters = parse_qs(urlsplit(response.headers['location']).query)
    assert parameters['code_challenge_method'] == ['S256']
    assert parameters['redirect_uri'] == [f'http://localhost:8002/api/auth/{provider}/callback']
    return parameters['state'][0]


def sign_in(client, subject='alice', provider='google'):
    state = start_login(client, provider)
    response = client.get(f'/api/auth/{provider}/callback', params={'state': state, 'code': subject}, follow_redirects=False)
    assert response.status_code == 303
    assert response.headers['location'] == 'http://localhost:5173/'
    return client.get('/api/auth/session').json()


def mutation_headers(client):
    return {'Origin': 'http://localhost:5173', 'X-CSRF-Token': client.get('/api/auth/session').json()['csrf_token']}


def save(client, transcript):
    response = client.post('/api/meetings', headers=mutation_headers(client), json={
        'save_key': str(uuid4()), 'filename': transcript + '.wav', 'raw_transcript': transcript,
        'action_items': [{'task': transcript + ' task'}],
    })
    assert response.status_code == 201, response.text
    return response.json()['meeting']['id']


@pytest.mark.parametrize('provider', ['google', 'github'])
def test_provider_callback_creates_server_session_without_exposing_token(private, provider):
    client = TestClient(main.app)
    status = sign_in(client, provider=provider)
    assert status['user']['provider'] == provider
    assert status['csrf_token']
    cookie = client.cookies.get('clarion_session')
    assert cookie and cookie not in json.dumps(status)
    with store.connect() as connection:
        assert connection.execute('SELECT token_hash FROM sessions').fetchone()[0] == store.digest(cookie)
    assert client.get('/api/auth/session').headers['cache-control'] == 'no-store'


def test_browser_bound_state_cannot_be_stolen_or_replayed(private):
    alice, attacker = TestClient(main.app), TestClient(main.app)
    state = start_login(alice)
    stolen = attacker.get('/api/auth/google/callback', params={'state': state, 'code': 'attacker'}, follow_redirects=False)
    assert stolen.status_code == 400
    assert not attacker.cookies.get('clarion_session')
    first = alice.get('/api/auth/google/callback', params={'state': state, 'code': 'alice'}, follow_redirects=False)
    assert first.status_code == 303
    replay = alice.get('/api/auth/google/callback', params={'state': state, 'code': 'attacker'}, follow_redirects=False)
    assert replay.status_code == 400
    assert alice.get('/api/auth/session').json()['user']['name'] == 'Account alice'


def test_expired_oauth_state_fails_before_provider_exchange(private, monkeypatch):
    client = TestClient(main.app)
    state = start_login(client)
    with store.connect() as connection:
        connection.execute('UPDATE oauth_states SET expires=0')
    monkeypatch.setattr(routes, 'identify', lambda *a, **k: pytest.fail('Expired state must not reach provider'), raising=False)
    assert client.get('/api/auth/google/callback', params={'state': state, 'code': 'alice'}, follow_redirects=False).status_code == 400


def test_accounts_isolate_records_search_projects_and_preserve_local_data(private):
    crud.create_meeting(filename='legacy.wav', raw_transcript='legacy-only')
    alice, bob = TestClient(main.app), TestClient(main.app)
    sign_in(alice)
    sign_in(bob, 'bob')
    alice_id = save(alice, 'alice-only')
    assert bob.get(f'/api/meetings/{alice_id}').status_code == 404
    assert bob.put(f'/api/meetings/{alice_id}', headers=mutation_headers(bob), json={'raw_transcript': 'stolen'}).status_code == 404
    assert bob.delete(f'/api/meetings/{alice_id}', headers=mutation_headers(bob)).status_code == 404
    save(bob, 'bob-only')
    assert [row['raw_transcript'] for row in alice.get('/api/meetings').json()['meetings']] == ['alice-only']
    assert [row['raw_transcript'] for row in bob.get('/api/meetings').json()['meetings']] == ['bob-only']
    assert not bob.get('/api/meetings', params={'q': 'alice-only'}).json()['meetings']
    project = alice.post('/api/projects', headers=mutation_headers(alice), json={'name': 'Alice project'})
    assert project.status_code in {200, 201}, project.text
    assert not bob.get('/api/projects').json()['projects']
    # No request context is left in the test thread; its local data is untouched.
    assert db.ACTIVE_DB_PATH.get() is None
    assert crud.get_all_meetings()[0].filename == 'legacy.wav'


def test_same_email_does_not_link_different_provider_accounts(private):
    google, github = TestClient(main.app), TestClient(main.app)
    first = sign_in(google, 'same-subject', 'google')
    second = sign_in(github, 'same-subject', 'github')
    assert first['user']['id'] != second['user']['id']
    save(google, 'google-only')
    assert not github.get('/api/meetings').json()['meetings']


@pytest.mark.parametrize('headers', [{}, {'Origin': 'http://localhost:5173'},
    {'Origin': 'https://attacker.example', 'X-CSRF-Token': 'bad'}])
def test_authenticated_mutations_require_origin_and_session_csrf(private, headers):
    client = TestClient(main.app)
    sign_in(client)
    response = client.post('/api/meetings', headers=headers, json={'save_key': str(uuid4()), 'filename': 'blocked.wav'})
    assert response.status_code == 403
    assert not client.get('/api/meetings').json()['meetings']


def test_logout_revokes_copied_session_and_expired_sessions_fail(private):
    client, copied = TestClient(main.app), TestClient(main.app)
    sign_in(client)
    copied.cookies.set('clarion_session', client.cookies.get('clarion_session'))
    response = client.post('/api/auth/logout', headers=mutation_headers(client))
    assert response.status_code == 200
    assert client.get('/api/meetings').status_code == 401
    assert copied.get('/api/meetings').status_code == 401
    sign_in(client)
    with store.connect() as connection:
        connection.execute('UPDATE sessions SET expires=0')
    assert client.get('/api/meetings').status_code == 401


def test_missing_provider_config_has_actionable_response(monkeypatch):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    monkeypatch.delenv('GITHUB_CLIENT_SECRET', raising=False)
    assert TestClient(main.app).get('/api/auth/github/login', follow_redirects=False).status_code == 503


def test_concurrent_accounts_keep_sqlite_and_streamed_chat_private(private, monkeypatch):
    from database.voiceprints import upsert_speaker_profile, get_speaker_profiles
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')

    def stream(**kwargs):
        # Runs from StreamingResponse's worker pool, still inside the account context.
        upsert_speaker_profile(kwargs['transcript'], [1, 0])
        yield {'token': kwargs['transcript'], 'done': False}
        yield {'answer': kwargs['transcript'], 'done': True, 'citations': [], 'mode': 'test'}

    monkeypatch.setattr(main, 'stream_meeting_question', stream)
    alice, bob = TestClient(main.app), TestClient(main.app)
    a_status, b_status = sign_in(alice), sign_in(bob, 'bob')
    a_id, b_id = save(alice, 'AliceOnly'), save(bob, 'BobOnly')

    def ask(client, meeting_id):
        return client.post('/api/chat/stream', headers=mutation_headers(client),
                           json={'question': 'What happened?', 'meeting_id': meeting_id})

    with ThreadPoolExecutor(max_workers=2) as workers:
        first = workers.submit(ask, alice, a_id)
        second = workers.submit(ask, bob, b_id)
        assert 'AliceOnly' in first.result().text
        assert 'BobOnly' in second.result().text
    assert alice.get(f'/api/meetings/{a_id}/chat').json()['chat_history'][-1]['content'] == 'AliceOnly'
    assert bob.get(f'/api/meetings/{b_id}/chat').json()['chat_history'][-1]['content'] == 'BobOnly'
    from app.auth.config import settings
    for status, expected in ((a_status, 'AliceOnly'), (b_status, 'BobOnly')):
        selection = db.ACTIVE_DB_PATH.set(settings().data_dir / 'users' / status['user']['id'] / 'meeting.db')
        try:
            assert [item['name'] for item in get_speaker_profiles()] == [expected]
        finally:
            db.ACTIVE_DB_PATH.reset(selection)


def test_secure_cookie_flags_and_callback_are_configuration_bound(private, monkeypatch):
    monkeypatch.setenv('CLARION_PUBLIC_URL', 'https://meetings.example')
    monkeypatch.setenv('CLARION_FRONTEND_URL', 'https://meetings.example')
    client = TestClient(main.app, base_url='https://localhost')
    response = client.get('/api/auth/google/login', headers={'Host': 'localhost'}, follow_redirects=False)
    assert response.status_code == 302
    cookie = response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=lax' in cookie
    parameters = parse_qs(urlsplit(response.headers['location']).query)
    assert parameters['redirect_uri'] == ['https://meetings.example/api/auth/google/callback']


def test_provider_failure_is_generic_and_state_is_consumed(private, monkeypatch):
    client = TestClient(main.app)
    state = start_login(client)
    def fail(*a, **k):
        raise RuntimeError('secret-token-provider-details')
    monkeypatch.setattr(routes, 'identify', fail)
    response = client.get('/api/auth/google/callback', params={'state': state, 'code': 'test'}, follow_redirects=False)
    assert response.headers['location'] == 'http://localhost:5173/?auth_error=provider_failed'
    assert 'secret-token' not in response.text
    assert not client.cookies.get('clarion_session')
    assert client.get('/api/auth/google/callback', params={'state': state, 'code': 'test'}, follow_redirects=False).status_code == 400


@pytest.mark.parametrize('provider', ['google', 'github'])
def test_provider_adapter_uses_fixed_identity_endpoints_and_pkce(private, monkeypatch, provider):
    calls = []
    class Response:
        def __init__(self, value): self.value = value
        def raise_for_status(self): pass
        def json(self): return self.value
    class Client:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def fetch_token(self, url, **kwargs): calls.append((url, kwargs))
        def get(self, url, **kwargs):
            calls.append((url, kwargs))
            if provider == 'google': return Response({'sub': 'google-sub', 'email_verified': True, 'email': 'a@example.com'})
            if url.endswith('/emails'): return Response([{'email': 'a@example.com', 'primary': True, 'verified': True}])
            return Response({'id': 123, 'login': 'alice'})
    monkeypatch.setattr(providers, 'oauth_client', lambda *a: Client())
    from app.auth.config import settings
    identity = providers.identify(provider, code='single-use-code', verifier='verifier', config=settings())
    assert identity['subject'] == ('google-sub' if provider == 'google' else '123')
    assert calls[0][0] == providers.PROVIDERS[provider]['token']
    assert calls[0][1]['code_verifier'] == 'verifier'
    assert calls[0][1]['timeout'] == 15
    assert all(url.startswith('https://') for url, _ in calls)



def test_local_account_registration_login_and_password_change(private):
    client = TestClient(main.app)
    reg = client.post('/api/auth/register', json={
        'name': 'Luong Nguyen',
        'email': 'luong@example.com',
        'password': 'StrongPassword123!',
    })
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body['authenticated'] is True
    assert body['user']['name'] == 'Luong Nguyen'
    assert body['user']['email'] == 'luong@example.com'
    assert body['user']['provider'] == 'local'

    # Duplicate email registration is rejected
    dup = client.post('/api/auth/register', json={
        'name': 'Other',
        'email': 'LUONG@example.com',
        'password': 'AnotherPassword123!',
    })
    assert dup.status_code == 409

    # Update display name and password via /api/auth/account
    wrong_pw = client.patch('/api/auth/account', headers=mutation_headers(client), json={
        'name': 'Luong Updated',
        'current_password': 'WrongPassword',
        'new_password': 'NewStrongPassword456!',
    })
    assert wrong_pw.status_code == 400

    updated = client.patch('/api/auth/account', headers=mutation_headers(client), json={
        'name': 'Luong Updated',
        'current_password': 'StrongPassword123!',
        'new_password': 'NewStrongPassword456!',
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()['user']['name'] == 'Luong Updated'

    # Logout and sign back in with new password
    client.post('/api/auth/logout', headers=mutation_headers(client))
    assert client.get('/api/auth/session').json()['user'] is None

    old_login = client.post('/api/auth/login', json={
        'email': 'luong@example.com',
        'password': 'StrongPassword123!',
    })
    assert old_login.status_code == 401

    new_login = client.post('/api/auth/login', json={
        'email': 'luong@example.com',
        'password': 'NewStrongPassword456!',
    })
    assert new_login.status_code == 200
    assert new_login.json()['user']['name'] == 'Luong Updated'
