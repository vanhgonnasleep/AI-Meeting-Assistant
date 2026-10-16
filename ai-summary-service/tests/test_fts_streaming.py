import json

import pytest
from fastapi.testclient import TestClient

import database.crud as crud
import database.db as db
import main
import app.pipeline.chat as meeting_chat


def test_fts_migrates_existing_rows_and_stays_in_sync():
    mid = crud.create_meeting(filename='old.wav', raw_transcript='migration rehearsal')
    with db.get_connection() as connection:
        for name in ('meetings_ai', 'meetings_ad', 'meetings_au'):
            connection.execute(f'DROP TRIGGER IF EXISTS {name}')
        connection.execute('DROP TABLE IF EXISTS meetings_fts')
    db.init_db()
    assert [r.id for r in crud.search_meetings_fts('rehearsal')] == [mid]
    crud.update_meeting(mid, raw_transcript='certificate renewal')
    assert crud.search_meetings_fts('rehearsal') == []
    assert [r.id for r in crud.search_meetings_fts('certificate')] == [mid]
    crud.delete_meeting(mid)
    assert crud.search_meetings_fts('certificate') == []
    db.init_db()


def test_fts_precedes_pagination_and_keeps_filename_and_literal_search():
    ids = [crud.create_meeting(filename=f'project-{i}.wav', raw_transcript='alpha beta 50%') for i in range(3)]
    crud.create_meeting(filename='other.wav', raw_transcript='alpha alone')
    client = TestClient(main.app)
    result = client.get('/api/meetings', params={'q': 'alpha beta', 'limit': 1, 'offset': 1}).json()
    assert result['total'] == 3
    assert result['meetings'][0]['id'] == ids[1]
    assert client.get('/api/meetings', params={'q': '50%'}).json()['total'] == 3
    assert client.get('/api/meetings', params={'q': 'project-1.wav'}).json()['total'] == 1
    assert crud.search_meetings_fts('alpha', limit=2)


class Upstream:
    def __init__(self, lines):
        self.lines = lines
        self.closed = False

    def raise_for_status(self):
        pass

    def iter_lines(self):
        yield from self.lines

    def close(self):
        self.closed = True


def test_model_stream_emits_tokens_before_reading_completion(monkeypatch):
    upstream = Upstream([json.dumps({'message': {'content': 'Friday '}}).encode(),
                         json.dumps({'message': {'content': 'morning.'}}).encode(),
                         b'{"done": true}'])
    def post(*args, **kwargs):
        assert kwargs['stream'] is True and kwargs['json']['stream'] is True
        return upstream
    monkeypatch.setattr(meeting_chat.requests, 'post', post)
    events = meeting_chat.stream_meeting_question('migration?', transcript='Migration starts Friday morning.')
    assert next(events) == {'token': 'Friday ', 'done': False}
    assert upstream.closed is False
    rest = list(events)
    assert rest[0]['token'] == 'morning.'
    assert rest[-1]['done'] is True and rest[-1]['citations']
    assert upstream.closed


def test_sse_saved_chat_persists_only_completed_answer(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(meeting_chat.requests, 'post', lambda *a, **k: Upstream([
        b'{"message":{"content":"Friday."}}', b'{"done":true}']))
    mid = crud.create_meeting(filename='a.wav', raw_transcript='Migration starts Friday.')
    response = TestClient(main.app).post('/api/chat/stream', json={'question': 'migration?', 'meeting_id': mid})
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/event-stream')
    events = [json.loads(frame[6:]) for frame in response.text.strip().split('\n\n')]
    assert events[0]['token'] == 'Friday.'
    assert events[-1]['done'] and events[-1]['citations']
    assert crud.get_chat_history(mid)[-1]['content'] == 'Friday.'


def test_interrupted_upstream_is_an_error_and_not_saved(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(meeting_chat.requests, 'post', lambda *a, **k: Upstream([b'{"message":{"content":"Partial"}}']))
    mid = crud.create_meeting(filename='a.wav', raw_transcript='Migration starts Friday.')
    response = TestClient(main.app).post('/api/chat/stream', json={'question': 'migration?', 'meeting_id': mid})
    assert '"error"' in response.text
    assert crud.get_chat_history(mid) == []


def test_sse_unknown_saved_meeting_is_404():
    assert TestClient(main.app).post('/api/chat/stream', json={'question': 'migration?', 'meeting_id': 9999}).status_code == 404


def test_stream_does_not_restore_history_cleared_during_inference(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    mid = crud.create_meeting(filename='a.wav', raw_transcript='Migration starts Friday.')
    class ClearingUpstream(Upstream):
        def iter_lines(self):
            yield b'{"message":{"content":"Friday."}}'
            crud.clear_chat_history(mid)
            yield b'{"done":true}'
    monkeypatch.setattr(meeting_chat.requests, 'post', lambda *a, **k: ClearingUpstream([]))
    response = TestClient(main.app).post('/api/chat/stream', json={'question': 'migration?', 'meeting_id': mid})
    assert 'Meeting changed' in response.text
    assert crud.get_chat_history(mid) == []


def test_closing_generator_closes_upstream_without_consuming_rest(monkeypatch):
    upstream = Upstream([b'{"message":{"content":"Partial"}}', b'{"done":true}'])
    monkeypatch.setattr(meeting_chat.requests, 'post', lambda *a, **k: upstream)
    events = meeting_chat.stream_meeting_question('migration?', transcript='Migration Friday.')
    next(events)
    events.close()
    assert upstream.closed


def test_underscore_queries_are_literal_not_fts_phrase_separators():
    ids = [crud.create_meeting(filename=str(i), raw_transcript=text) for i, text in enumerate(['foo-bar', 'foo bar', 'foo_bar', '_'])]
    client = TestClient(main.app)
    exact = client.get('/api/meetings', params={'q': 'foo_bar'}).json()
    assert [r['id'] for r in exact['meetings']] == [ids[2]]
    assert client.get('/api/meetings', params={'q': '_'}).json()['total'] == 2
