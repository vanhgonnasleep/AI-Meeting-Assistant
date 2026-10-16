"""Cross-feature regressions using only the disposable test workspace."""
import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import main
from database import crud


def test_stale_task_checkbox_cannot_complete_a_different_task():
    client = TestClient(main.app)
    mid = crud.create_meeting('tasks.wav', action_items=[{'task': 'Old build'}, {'task': 'Production deploy'}])
    edited = client.patch(f'/api/meetings/{mid}/review', json={
        'expected_revision': 0, 'review_status': 'draft',
        'action_items': [{'task': 'Production deploy'}],
    })
    assert edited.status_code == 200
    response = client.patch(f'/api/meetings/{mid}/tasks/0', json={'status': 'completed', 'expected_revision': 0})
    assert response.status_code == 409
    record = crud.get_meeting(mid)
    assert [(task.task, task.status) for task in record.action_items] == [('Production deploy', 'pending')]
    assert record.revision == 1
    fresh = client.patch(f'/api/meetings/{mid}/tasks/0', json={'status': 'completed', 'expected_revision': 1})
    assert fresh.status_code == 200
    assert fresh.json()['meeting']['revision'] == 2
    assert crud.get_meeting(mid).action_items[0].status == 'completed'


@pytest.mark.parametrize('revision', ['missing', None, -1, True, '0', 0.0])
def test_task_checkbox_requires_a_strict_nonnegative_revision(revision):
    client = TestClient(main.app)
    mid = crud.create_meeting('tasks.wav', action_items=[{'task': 'Keep pending'}])
    payload = {'status': 'completed'}
    if revision != 'missing':
        payload['expected_revision'] = revision
    assert client.patch(f'/api/meetings/{mid}/tasks/0', json=payload).status_code == 422
    assert crud.get_meeting(mid).action_items[0].status == 'pending'
    assert crud.get_meeting(mid).revision == 0


def test_saved_maximum_segment_meeting_can_correct_a_turn_with_rich_metadata():
    client = TestClient(main.app)
    segments = [{'text': 'Review.', 'start': i / 2, 'end': (i + 1) / 2, 'metadata': 'x' * 230}
                for i in range(20_000)]
    saved = client.post('/api/meetings', json={
        'save_key': str(uuid4()), 'filename': 'long.wav', 'raw_transcript': 'Review.', 'segments': segments,
    })
    assert saved.status_code == 201
    mid = saved.json()['meeting']['id']
    segments[0]['text'] = 'Corrected.'
    payload = {'expected_revision': 0, 'review_status': 'draft', 'segments': segments}
    assert 4 * 1024 * 1024 < len(json.dumps(payload)) < 16 * 1024 * 1024
    corrected = client.patch(f'/api/meetings/{mid}/review', json=payload)
    assert corrected.status_code == 200
    record = crud.get_meeting(mid)
    assert len(record.segments) == 20_000
    assert record.segments[0]['text'] == 'Corrected.'
    assert record.segments[-1]['metadata'] == 'x' * 230
    assert record.revision == 1


def test_unsaved_chat_accepts_the_transcribers_maximum_segment_count(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(main, 'answer_meeting_question', lambda **kwargs: {
        'answer': kwargs['segments'][-1]['text'], 'citations': [], 'mode': 'test',
    })
    segments = [{'text': 'Review.'} for _ in range(20_000)]
    segments[-1]['text'] = 'Final turn.'
    client = TestClient(main.app)
    response = client.post('/api/chat', json={'question': 'Last turn?', 'segments': segments})
    assert response.status_code == 200
    assert response.json()['answer'] == 'Final turn.'
    assert client.post('/api/chat', json={'question': 'Last turn?', 'segments': segments + [{'text': 'Excess'}]}).status_code == 422


def test_review_body_and_segment_limits_remain_bounded():
    client = TestClient(main.app)
    mid = crud.create_meeting('review.wav', raw_transcript='Preserve.')
    response = client.patch(f'/api/meetings/{mid}/review', json={
        'expected_revision': 0, 'review_status': 'draft', 'segments': [{'text': 'x'}] * 20_001,
    })
    assert response.status_code == 422
    too_large = client.patch(f'/api/meetings/{mid}/review', content=b'{}', headers={
        'Content-Type': 'application/json', 'Content-Length': str(16 * 1024 * 1024 + 1),
    })
    assert too_large.status_code == 413
    assert crud.get_meeting(mid).raw_transcript == 'Preserve.'


@pytest.mark.parametrize('invalidate', ['source_edit', 'clear_history', 'delete_meeting'])
def test_json_chat_rejects_an_answer_invalidated_during_inference(monkeypatch, invalidate):
    client = TestClient(main.app)
    mid = crud.create_meeting('source.wav', raw_transcript='Old source.')
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')

    def answer(**kwargs):
        if invalidate == 'source_edit':
            crud.update_meeting(mid, raw_transcript='Corrected source.')
        elif invalidate == 'clear_history':
            crud.clear_chat_history(mid)
        else:
            crud.delete_meeting(mid)
        return {'answer': 'Obsolete answer.', 'citations': [], 'mode': 'test'}

    monkeypatch.setattr(main, 'answer_meeting_question', answer)
    response = client.post(f'/api/meetings/{mid}/chat', json={'question': 'What happened?'})
    assert response.status_code == 409
    assert 'Obsolete answer.' not in response.text
    assert not crud.get_chat_history(mid)
