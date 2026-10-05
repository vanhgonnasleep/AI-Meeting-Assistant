import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
import agent3_action_items as actions
from database import crud, db
from runtime_config import MediaLimitError


@pytest.mark.parametrize('route', ['/api/transcribe', '/api/process-audio'])
def test_duration_rejection_is_actionable_without_retrying_inference(monkeypatch, route):
    def reject(*args, **kwargs):
        raise MediaLimitError('Audio duration exceeds 10800 seconds.')
    monkeypatch.setattr(main, 'transcribe_audio_detailed', reject)
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    result = TestClient(main.app).post(route, files={'file': ('meeting.wav', b'not decoded in this test', 'audio/wav')})
    assert result.status_code == 413
    assert '10800' in result.json()['detail']


def test_long_summary_never_sends_unbounded_reduce_context(monkeypatch):
    inputs = []
    def summarize(prompt, **kwargs):
        context = prompt.split('<meeting_transcript>\n')[-1].split('\n</meeting_transcript>')[0]
        inputs.append(context.split())
        return ' '.join(context.split()[:100])
    monkeypatch.setattr(main, 'call_ollama', summarize)
    assert main.summarize_with_llama('word ' * 14000, model_name='test')
    assert all(len(words) <= 800 for words in inputs)
    assert len(inputs) > 21  # More than one reduction level is exercised.


def test_noncompressing_summary_fails_explicitly_instead_of_overflowing_context(monkeypatch):
    monkeypatch.setattr(main, 'call_ollama', lambda prompt, **kwargs: 'word ' * 800)
    with pytest.raises(main.AIServiceError, match='compress'):
        main.summarize_with_llama('word ' * 4000, model_name='test')


@pytest.mark.parametrize('task', ['Review [unfinished section', 'Explain literal ,} and ,] in examples'])
def test_action_json_string_punctuation_is_preserved(monkeypatch, task):
    content = json.dumps([{'task': task, 'assignee': 'Alice'}])
    monkeypatch.setattr(actions, 'OLLAMA_LIB_AVAILABLE', False)
    monkeypatch.setattr(actions.requests, 'post', lambda *a, **k: SimpleNamespace(
        raise_for_status=lambda: None, json=lambda: {'message': {'content': content + '\nExplanation'}}))
    assert actions.extract_action_items('Discuss report')[0]['task'] == task


def test_legacy_nonfinite_and_malformed_task_fields_do_not_break_history_or_analytics():
    record = crud.create_meeting(filename='legacy.wav', duration=60)
    connection = db.get_connection()
    try:
        connection.execute('UPDATE meetings SET duration=?, action_items=?, segments=? WHERE id=?',
                           (float('inf'), '[{"task":"Review","assignee":{},"status":{"old":true}}]',
                            '[{"text":"Review","start":Infinity}]', record))
        connection.commit()
    finally:
        connection.close()
    client = TestClient(main.app)
    for route in (f'/api/meetings/{record}', '/api/meetings?compact=true', '/api/analytics'):
        response = client.get(route)
        assert response.status_code == 200
        json.dumps(response.json(), allow_nan=False)
    assert crud.get_meeting(record).duration is None
    assert crud.get_analytics_summary()['total_duration_seconds'] == 0


def test_legacy_update_rejects_invalid_task_fields_before_storage():
    record = crud.create_meeting(filename='valid.wav')
    result = TestClient(main.app).put(f'/api/meetings/{record}', json={
        'action_items': [{'task': 'Review', 'status': {'invalid': True}}]})
    assert result.status_code == 422
    assert crud.get_meeting(record).action_items == []
