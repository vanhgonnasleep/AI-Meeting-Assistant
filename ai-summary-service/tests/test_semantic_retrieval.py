"""Exercise local hybrid retrieval without downloading or running a model."""
from types import SimpleNamespace

import requests
import pytest

from meeting_chat import answer_meeting_question


def response(vectors):
    return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'embeddings': vectors})


def model_server(url, json, **kwargs):
    if url.endswith('/api/embed'):
        return response([[0.0, 1.0] if 'compost' in text else [1.0, 0.0] for text in json['input']])
    raise requests.ConnectionError('No generation model in this test')


def test_semantic_retrieval_finds_synonym_without_lexical_overlap(monkeypatch):
    monkeypatch.setattr(requests, 'post', model_server)
    source = [{'text': 'Postpone the release.', 'speaker': 'Alice', 'start': 42, 'timestamp': '00:42'},
              {'text': 'Apply compost to the soil.', 'start': 60}]
    result = answer_meeting_question('Why did we defer shipping?', segments=source, semantic=True)
    assert [item['text'] for item in result['citations']] == ['Postpone the release.']
    assert result['citations'][0]['start'] == 42
    assert result['citations'][0]['retrieval'] == 'hybrid'
    assert result['mode'] == 'rag_fallback'


def test_low_semantic_similarity_does_not_create_evidence(monkeypatch):
    monkeypatch.setattr(requests, 'post', model_server)
    result = answer_meeting_question('Why did we defer shipping?', transcript='Apply compost to the soil.', semantic=True)
    assert result['citations'] == []
    assert result['mode'] == 'no_matching_context'


def test_offline_embeddings_fall_back_to_lexical_with_visible_warning(monkeypatch):
    def offline(*args, **kwargs):
        raise requests.ConnectionError('Offline')
    monkeypatch.setattr(requests, 'post', offline)
    result = answer_meeting_question('When is migration?', transcript='Migration starts Friday.', semantic=True,
                                     embedding_model='offline-test-model')
    assert result['citations'][0]['text'] == 'Migration starts Friday.'
    assert 'keyword' in result['retrieval_warning'].lower()


@pytest.mark.parametrize('vectors', [[[float('nan'), 1]], [[0, 0]], [[True, 1]], [[1, 0], [1, 2, 3]], []])
def test_malformed_embeddings_do_not_hide_lexical_evidence(monkeypatch, vectors):
    monkeypatch.setattr(requests, 'post', lambda *args, **kwargs: response(vectors))
    result = answer_meeting_question('Migration?', transcript='Migration starts Friday.', semantic=True,
                                     embedding_model='malformed-' + str(vectors))
    assert result['citations'][0]['text'] == 'Migration starts Friday.'
    assert result['retrieval_warning']


def test_embeddings_cache_reuses_sources_and_invalidates_edited_content(monkeypatch):
    from semantic_retrieval import clear_embedding_cache
    clear_embedding_cache()
    calls = []
    def server(url, json, **kwargs):
        if url.endswith('/api/embed'):
            calls.extend(json['input'])
        return model_server(url, json, **kwargs)
    monkeypatch.setattr(requests, 'post', server)
    for text in ['Postpone release.', 'Postpone release.', 'Advance release.']:
        answer_meeting_question('Defer shipping?', transcript=text, semantic=True, embedding_model='cache-test')
    assert calls.count('Postpone release.') == 1
    assert calls.count('Advance release.') == 1


def test_large_semantic_corpus_is_skipped_explicitly_not_partially_searched(monkeypatch):
    monkeypatch.setattr(requests, 'post', model_server)
    source = [{'text': f'Unrelated detail {i}.'} for i in range(257)] + [{'text': 'Migration starts Friday.'}]
    result = answer_meeting_question('Migration?', segments=source, semantic=True)
    assert result['citations'][0]['text'] == 'Migration starts Friday.'
    assert 'limit' in result['retrieval_warning'].lower()


def test_chat_endpoints_propagate_semantic_options_and_persist_fallback_warning(monkeypatch):
    import main
    from database import crud
    from fastapi.testclient import TestClient
    def offline(*args, **kwargs):
        raise requests.ConnectionError('Offline')
    monkeypatch.setattr(requests, 'post', offline)
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'get_installed_ollama_models', lambda: [])
    payload = {'question': 'Migration?', 'semantic': True, 'embedding_model': 'api-offline'}
    mid = crud.create_meeting(filename='migration.wav', raw_transcript='Migration starts Friday.')
    client = TestClient(main.app)
    saved = client.post(f'/api/meetings/{mid}/chat', json=payload)
    assert saved.status_code == 200
    assert saved.json()['retrieval_warning']
    assert crud.get_chat_history(mid)[-1]['retrieval_warning']
    unsaved = client.post('/api/chat', json={**payload, 'transcript': 'Migration starts Friday.'})
    assert unsaved.status_code == 200
    assert unsaved.json()['retrieval_warning']


def test_regeneration_is_subject_to_existing_compute_admission():
    import asyncio
    from request_limits import RequestLimitsMiddleware
    called, sent = [], []
    async def app(scope, receive, send):
        called.append(True)
    async def receive():
        return {'type': 'http.request', 'body': b''}
    async def send(message):
        sent.append(message)
    middleware = RequestLimitsMiddleware(app, [], 1024)
    assert middleware.compute_slots.acquire(False)
    assert middleware.compute_slots.acquire(False)
    asyncio.run(middleware({'type': 'http', 'method': 'POST', 'path': '/api/meetings/1/regenerate-summary',
                            'headers': []}, receive, send))
    assert sent[0]['status'] == 503
    assert called == []
    middleware.compute_slots.release()
    middleware.compute_slots.release()


@pytest.mark.parametrize('attributions', [[('Alice', 2), ('Bob', 2)], [('Alice', 3), ('Alice', 4)], [('Alice', 2), ('Alice', 2)]])
def test_hybrid_preserves_distinct_turns_with_duplicate_ids_and_text(monkeypatch, attributions):
    from semantic_retrieval import clear_embedding_cache
    clear_embedding_cache()
    query = 'When is migration?'
    def server(url, json, **kwargs):
        if url.endswith('/api/embed'):
            return response([[1, 0] if text == query else [0, 1] for text in json['input']])
        raise requests.ConnectionError('Offline generation')
    monkeypatch.setattr(requests, 'post', server)
    segments = [{'id': 'turn', 'timestamp': '00:01', 'text': 'Migration starts Friday.', 'speaker': speaker,
                 'end': end} for speaker, end in attributions]
    result = answer_meeting_question(query, segments=segments, semantic=True)
    assert [(item['speaker'], item['end']) for item in result['citations']] == attributions
