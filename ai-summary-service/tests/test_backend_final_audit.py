"""Backend failure boundaries exercised with disposable data only."""
import asyncio
import sqlite3
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import main
from app.auth import middleware, store
from app.core.error_boundary import StorageErrorMiddleware
from database import crud, db


@pytest.mark.parametrize('failure', ['read', 'write', 'initialize', 'session', 'initialize-filesystem', 'session-filesystem'])
def test_private_storage_failure_is_readable_without_losing_account(monkeypatch, failure):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    client = TestClient(main.app, raise_server_exceptions=False)
    token = store.create_session('google', {'subject': 'audit', 'name': 'Audit', 'email': None})
    client.cookies.set(middleware.SESSION_COOKIE, token)
    session = client.get('/api/auth/session').json()
    headers = {'Origin': 'http://localhost:5173', 'X-CSRF-Token': session['csrf_token']}
    assert client.get('/api/meetings', headers=headers).status_code == 200
    saved = client.post('/api/meetings', headers=headers, json={
        'save_key': str(uuid4()), 'filename': 'preserve.wav', 'raw_transcript': 'Keep this meeting.',
    })
    assert saved.status_code == 201
    meeting_id = saved.json()['meeting']['id']

    def unavailable(*args, **kwargs):
        raise sqlite3.OperationalError('private-path/identity.db: sensitive diagnostic')

    def filesystem_unavailable(*args, **kwargs):
        raise PermissionError('private-path: sensitive diagnostic')

    if failure == 'session':
        monkeypatch.setattr(middleware, 'find_session', unavailable)
    elif failure == 'session-filesystem':
        monkeypatch.setattr(Path, 'mkdir', filesystem_unavailable)
    elif failure == 'initialize-filesystem':
        monkeypatch.setattr(middleware, 'ensure_database', filesystem_unavailable)
    elif failure == 'initialize':
        monkeypatch.setattr(middleware, 'ensure_database', unavailable)
    elif failure == 'read':
        monkeypatch.setattr(crud, 'get_meeting_page', unavailable)
    else:
        original_connect = crud.get_connection

        def read_only():
            connection = original_connect()
            connection.execute('PRAGMA query_only=ON')
            return connection

        monkeypatch.setattr(crud, 'get_connection', read_only)

    response = (client.delete(f'/api/meetings/{meeting_id}', headers=headers) if failure == 'write'
                else client.get('/api/meetings', headers=headers))
    assert response.status_code == 503
    assert response.json()['code'] == 'workspace_unavailable'
    assert response.headers['access-control-allow-origin'] == headers['Origin']
    assert response.headers['cache-control'] == 'no-store'
    if not failure.startswith('session'):
        assert response.headers['x-clarion-account'] == session['user']['id']
    assert 'sensitive diagnostic' not in response.text
    assert '.db' not in response.text
    assert db.ACTIVE_DB_PATH.get() is None
    if failure == 'write':
        assert client.get(f'/api/meetings/{meeting_id}', headers=headers).json()['meeting']['raw_transcript'] == 'Keep this meeting.'


def test_local_storage_failure_also_has_json_and_cors(monkeypatch):
    def unavailable(*args, **kwargs):
        raise sqlite3.OperationalError('database is locked')

    monkeypatch.setattr(crud, 'get_meeting_page', unavailable)
    response = TestClient(main.app, raise_server_exceptions=False).get(
        '/api/meetings', headers={'Origin': 'http://localhost:5173'})
    assert response.status_code == 503
    assert response.json()['code'] == 'workspace_unavailable'
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'


def test_malformed_csrf_header_is_denied_without_a_server_error(monkeypatch):
    monkeypatch.setenv('CLARION_AUTH_MODE', 'private')
    client = TestClient(main.app, raise_server_exceptions=False)
    client.cookies.set(middleware.SESSION_COOKIE, store.create_session(
        'google', {'subject': 'audit', 'name': 'Audit', 'email': None}))
    response = client.post('/api/projects', json={'name': 'Do not create'}, headers={
        b'Origin': b'http://localhost:5173', b'X-CSRF-Token': b'\xff',
    })
    assert response.status_code == 403
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    assert client.get('/api/projects').json()['projects'] == []


@pytest.mark.parametrize('stage', ['transcription', 'summarization'])
def test_processing_failure_never_returns_internal_exception_text(monkeypatch, stage):
    marker = 'private-file-path-and-internal-diagnostic'

    def failure(*args, **kwargs):
        raise RuntimeError(marker)

    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(main, 'transcribe_audio_detailed', failure if stage == 'transcription'
                        else lambda *a, **k: {'text': 'Budget approved.'})
    monkeypatch.setattr(main, 'summarize_with_llama', failure)
    response = TestClient(main.app).post('/api/process-audio?enable_mmr=false',
                                        files={'file': ('meeting.wav', b'audio')})
    assert response.status_code == (400 if stage == 'transcription' else 500)
    assert marker not in response.text
    assert 'recording' in response.json()['detail'].lower()
    assert crud.get_all_meetings() == []


HUGE = 2**63


@pytest.mark.parametrize('method,path,payload', [
    ('GET', f'/api/meetings/{HUGE}', None),
    ('PUT', f'/api/meetings/{HUGE}', {'filename': 'valid.wav'}),
    ('DELETE', f'/api/meetings/{HUGE}', None),
    ('GET', f'/api/meetings/{HUGE}/chat', None),
    ('DELETE', f'/api/meetings/{HUGE}/chat', None),
    ('POST', f'/api/meetings/{HUGE}/chat', {'question': 'Budget?'}),
    ('PATCH', f'/api/meetings/{HUGE}/tasks/0', {'status': 'completed', 'expected_revision': 0}),
    ('PATCH', f'/api/meetings/{HUGE}/speakers', {'old_name': 'Alice', 'new_name': 'Bob'}),
    ('PATCH', f'/api/meetings/{HUGE}/review', {'expected_revision': 0, 'review_status': 'reviewed'}),
    ('POST', f'/api/meetings/{HUGE}/regenerate-summary', {'expected_revision': 0}),
    ('PATCH', '/api/meetings/1/project', {'expected_revision': 0, 'project_id': HUGE}),
    ('GET', f'/api/projects/{HUGE}/timeline', None),
    ('GET', f'/api/meetings?offset={HUGE}', None),
    ('GET', f'/api/tasks?project_id={HUGE}', None),
    ('POST', '/api/chat', {'question': 'Budget?', 'meeting_id': HUGE}),
    ('POST', '/api/chat/stream', {'question': 'Budget?', 'meeting_id': HUGE}),
])
def test_out_of_range_storage_integer_is_validation_error(method, path, payload):
    response = TestClient(main.app, raise_server_exceptions=False).request(method, path, json=payload)
    assert response.status_code == 422, response.text
    assert isinstance(response.json()['detail'], list)


def test_largest_sqlite_id_remains_a_valid_missing_record():
    response = TestClient(main.app).get(f'/api/meetings/{HUGE - 1}')
    assert response.status_code == 404


def test_storage_error_after_stream_headers_does_not_start_a_second_response():
    messages = []

    async def stream(scope, receive, send):
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        await send({'type': 'http.response.body', 'body': b'partial', 'more_body': True})
        raise sqlite3.OperationalError('write failed after headers')

    async def send(message):
        messages.append(message)

    with pytest.raises(sqlite3.OperationalError):
        asyncio.run(StorageErrorMiddleware(stream)({'type': 'http'}, None, send))
    assert sum(message['type'] == 'http.response.start' for message in messages) == 1


def test_storage_boundary_does_not_disguise_a_programming_error():
    async def broken(scope, receive, send):
        raise TypeError('programming error')

    with pytest.raises(TypeError):
        asyncio.run(StorageErrorMiddleware(broken)({'type': 'http'}, None, None))
