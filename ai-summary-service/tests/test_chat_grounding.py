"""Chat must distinguish retrieved evidence from unrelated or unavailable context."""
from types import SimpleNamespace

import requests
from fastapi.testclient import TestClient

import main
import database.crud as crud
from meeting_chat import answer_meeting_question, retrieve_relevant_segments


def offline(*args, **kwargs):
    raise requests.ConnectionError('Offline test')


def test_unrelated_question_does_not_receive_chronological_citations():
    assert retrieve_relevant_segments('What budget was approved?', transcript='The gardening workshop covers composting.') == []


def test_generic_approval_word_cannot_substitute_for_the_missing_budget_topic():
    assert retrieve_relevant_segments('What budget was approved and what are the terms?',
                                      transcript='We approved the irrigation schedule for the gardening workshop.') == []


def test_quoted_suggestion_focuses_on_its_source_excerpt_not_question_template():
    result = retrieve_relevant_segments('What follow-up, if any, is discussed in “Coral health is declining.”?',
                                       transcript='The follow-up for the database release was discussed.\nCoral health is declining.')
    assert [item['text'] for item in result] == ['Coral health is declining.']


def test_no_matching_evidence_does_not_call_model_or_trust_generated_summary(monkeypatch):
    calls = []
    def model(*args, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'message': {'content': 'The budget is $50,000.'}})
    monkeypatch.setattr(requests, 'post', model)
    result = answer_meeting_question('What budget was approved?', transcript='The gardening workshop covers composting.',
                                     summary='Approved a budget of $50,000.')
    assert result['citations'] == []
    assert result['mode'] == 'no_matching_context'
    assert '50,000' not in result['answer']
    assert calls == []


def test_offline_answer_is_labeled_as_an_excerpt_not_a_generated_answer(monkeypatch):
    monkeypatch.setattr(requests, 'post', offline)
    result = answer_meeting_question('When is migration?', transcript='Alice: Migration starts Friday.')
    assert result['mode'] == 'rag_fallback'
    assert 'Migration starts Friday.' in result['answer']
    assert 'unavailable' in result['answer'].lower()
    assert 'audio' not in result['answer'].lower()


def test_generic_overview_can_retrieve_real_content_without_keyword_overlap(monkeypatch):
    monkeypatch.setattr(requests, 'post', offline)
    segments = [{'text': text, 'start': i * 20, 'end': i * 20 + 10} for i, text in enumerate([
        'Database migration is planned for Friday.', 'Certificate renewal belongs to Alice.',
        'The rollback rehearsal belongs to Bob.', 'Replication lag requires investigation.',
        'The release will wait for the rehearsal.', 'Customer notifications go out Thursday.',
    ])]
    result = answer_meeting_question('Summarize the main topics of this meeting.', segments=segments)
    assert result['citations']
    assert any('Customer notifications' in citation['text'] for citation in result['citations'])
    assert all(citation['text'] in [segment['text'] for segment in segments] for citation in result['citations'])


def test_blank_legacy_segments_do_not_hide_usable_transcript(monkeypatch):
    monkeypatch.setattr(requests, 'post', offline)
    result = answer_meeting_question('Migration?', transcript='Migration is planned for Friday.', segments=[{'text': ''}])
    assert result['citations'][0]['text'] == 'Migration is planned for Friday.'


def test_raw_transcript_colons_are_not_mistaken_for_speaker_headers():
    for text in ['10:30 is the migration rehearsal.', 'Use a ratio of 1:2 for dilution.',
                 'Connect to postgres://localhost for migration.']:
        result = retrieve_relevant_segments(f'What does the meeting say about “{text}”?', transcript=text)
        assert result[0]['text'] == text


def test_saved_meeting_short_chat_payload_uses_database_evidence(monkeypatch):
    monkeypatch.setattr(requests, 'post', offline)
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'get_installed_ollama_models', lambda: [])
    mid = crud.create_meeting(filename='migration.wav', raw_transcript='Migration starts Friday.')
    response = TestClient(main.app).post(f'/api/meetings/{mid}/chat', json={'question': 'When is migration?'})
    assert response.status_code == 200
    assert response.json()['citations'][0]['text'] == 'Migration starts Friday.'
