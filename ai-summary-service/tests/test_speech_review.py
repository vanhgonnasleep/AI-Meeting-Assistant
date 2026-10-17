"""Uncertain speech stays reviewable and never becomes trusted AI evidence."""
import io
import wave
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
from database import crud


def uncertain(text='ni ' * 80):
    return {'text': text, 'start': 0, 'end': 1, 'timestamp': '[00:00 - 00:01]',
            'quality': {'status': 'needs_review', 'reasons': ['repetition']}}


def test_short_repetition_is_preserved_for_review_but_not_returned_as_normal_text(monkeypatch):
    pytest.importorskip('numpy')
    from app.pipeline import transcription as stt
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
        audio.writeframes(b'\0\0' * 4000)
    fake = {'text': 'ni ' * 80, 'language': 'en', 'segments': [
        {'text': 'ni ' * 80, 'start': 0, 'end': .2, 'compression_ratio': 9,
         'avg_logprob': -.2, 'no_speech_prob': .1}]}
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kw: SimpleNamespace(transcribe=lambda *a, **k: fake))
    result = stt.transcribe_audio_detailed(buffer.getvalue(), language='en')
    assert 'ni ni' not in result['text']
    assert result['segments'][0]['text'].strip() == fake['text'].strip()
    assert result['segments'][0]['quality']['status'] == 'needs_review'


def test_high_no_speech_probability_alone_does_not_remove_good_speech(monkeypatch):
    pytest.importorskip('numpy')
    from app.pipeline import transcription as stt
    fake = {'text': 'Budget approved.', 'language': 'en', 'segments': [
        {'text': 'Budget approved.', 'start': 0, 'end': .04, 'compression_ratio': 1,
         'avg_logprob': -.2, 'no_speech_prob': .75}]}
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
        audio.writeframes(b'\0\0' * 4000)
    monkeypatch.setattr(stt, 'AUDIO_CHUNK_SECONDS', .1)
    monkeypatch.setattr(stt, 'CHUNK_OVERLAP_SECONDS', 0)
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kw: SimpleNamespace(transcribe=lambda *a, **k: fake))
    result = stt.transcribe_audio_detailed(buffer.getvalue(), language='en')
    assert len(result['segments']) == 3
    assert all('quality' not in segment for segment in result['segments'])


def test_chat_cannot_fall_back_to_rejected_recognition():
    from app.pipeline.chat import retrieve_relevant_segments
    assert retrieve_relevant_segments('ni', segments=[uncertain()], transcript='ni ' * 80) == []


def test_processing_all_uncertain_audio_saves_reviewable_draft_without_calling_ai(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(main, 'transcribe_audio_detailed', lambda *a, **k: {
        'text': '[Unclear speech - review audio]', 'segments': [uncertain()], 'duration': 1, 'language': 'en'})
    monkeypatch.setattr(main, 'summarize_with_llama', lambda *a, **k: pytest.fail('Uncertain source reached summary'))
    monkeypatch.setattr(main, 'extract_action_items', lambda *a, **k: pytest.fail('Uncertain source reached tasks'))
    monkeypatch.setattr(main, 'extract_insights', lambda *a, **k: pytest.fail('Uncertain source reached insights'))
    response = TestClient(main.app).post('/api/process-audio?enable_mmr=false', files={'file': ('source.wav', b'audio')})
    assert response.status_code == 200
    assert response.json()['summary_mode'] == 'needs_review'
    record = crud.get_meeting(response.json()['meeting_id'])
    assert record.segments[0]['quality']['status'] == 'needs_review'
    assert record.executive_summary == '' and not record.action_items
    assert response.json()['warnings']


def test_review_correction_invalidates_notes_and_restores_chat_evidence():
    mid = crud.create_meeting('review.wav', raw_transcript='[Unclear speech - review audio]',
                              executive_summary='Outdated notes', action_items=[{'task': 'Old task'}], segments=[uncertain()])
    client = TestClient(main.app)
    assert client.patch(f'/api/meetings/{mid}/review', json={
        'expected_revision': 0, 'review_status': 'reviewed'}).status_code == 422
    corrected = uncertain()
    corrected['text'] = 'The budget is approved.'
    corrected['quality'] = {'status': 'reviewed', 'reasons': ['repetition'], 'original_text': 'ni ' * 80}
    response = client.patch(f'/api/meetings/{mid}/review', json={
        'expected_revision': 0, 'review_status': 'draft', 'segments': [corrected]})
    assert response.status_code == 200
    record = crud.get_meeting(mid)
    assert record.executive_summary == '' and not record.action_items
    assert record.revision == 1 and record.review_status == 'draft'
    from app.pipeline.chat import retrieve_relevant_segments
    assert retrieve_relevant_segments('budget', segments=record.segments)[0]['text'] == corrected['text']
    assert client.patch(f'/api/meetings/{mid}/review', json={
        'expected_revision': 0, 'review_status': 'reviewed'}).status_code == 409


def test_regeneration_does_not_send_uncertain_source_to_model(monkeypatch):
    mid = crud.create_meeting('review.wav', raw_transcript='ni ' * 80, segments=[uncertain()])
    from fastapi import FastAPI
    from app.api.workspace import create_workspace_router
    app = FastAPI()
    app.include_router(create_workspace_router(lambda *a, **k: 'Unsafe generated notes'))
    assert TestClient(app).post(f'/api/meetings/{mid}/regenerate-summary', json={
        'expected_revision': 0}).status_code == 422


def test_auto_detection_does_not_lock_an_early_wrong_language_for_later_chunks(monkeypatch):
    pytest.importorskip('numpy')
    from app.pipeline import transcription as stt
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
        audio.writeframes(b'\0\0' * 4000)
    calls = []
    def decode(*args, **options):
        calls.append(options)
        return {'text': 'Budget approved.', 'language': 'mi' if len(calls) == 1 else 'en',
                'segments': [{'text': 'Budget approved.', 'start': 0, 'end': .04}]}
    monkeypatch.setattr(stt, 'AUDIO_CHUNK_SECONDS', .1)
    monkeypatch.setattr(stt, 'CHUNK_OVERLAP_SECONDS', 0)
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kw: SimpleNamespace(transcribe=decode))
    result = stt.transcribe_audio_detailed(buffer.getvalue())
    assert all('language' not in options for options in calls)
    assert result['language'] == 'mixed'
    assert result['detected_languages'] == ['mi', 'en']


def test_repetition_requires_a_sustained_text_loop_not_a_window_score():
    from database.transcript_quality import recognition_reasons
    assert recognition_reasons({'text': 'The committee reviewed the budget.', 'compression_ratio': 5}) == []
    assert recognition_reasons({'text': 'Thank you thank you thank you'}) == []
    assert 'repetition' in recognition_reasons({'text': 'thank you ' * 10})


def test_legacy_unreviewed_repetition_is_flagged_without_rewriting_stored_source():
    from database.db import get_connection
    raw = 'ni ' * 80
    mid = crud.create_meeting('old.wav', raw_transcript=raw, segments=[{'text': raw, 'start': 0, 'end': 30}])
    record = crud.get_meeting(mid)
    assert record.segments[0]['quality']['status'] == 'needs_review'
    with get_connection() as connection:
        assert connection.execute('SELECT raw_transcript FROM meetings WHERE id=?', (mid,)).fetchone()[0] == raw
    from app.pipeline.chat import retrieve_relevant_segments
    assert retrieve_relevant_segments('ni', segments=record.segments, transcript=raw) == []


def test_microphone_chunks_share_the_review_policy(monkeypatch):
    np = pytest.importorskip('numpy')
    from app.pipeline import transcription as stt
    monkeypatch.setattr(stt, 'ffmpeg_executable', lambda: 'fixture-ffmpeg')
    monkeypatch.setattr(stt.subprocess, 'run', lambda *a, **k: SimpleNamespace(returncode=0, stdout=np.ones(1600, dtype='<f4').tobytes()))
    monkeypatch.setattr(stt, 'get_whisper_device', lambda: 'cpu')
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kw: SimpleNamespace(transcribe=lambda *a, **k: {
        'text': 'ni ' * 80, 'language': 'en', 'segments': [{'text': 'ni ' * 80, 'start': 0, 'end': .1}]}))
    result = stt.transcribe_audio_chunk(b'fixture audio')
    assert 'ni ni' not in result['text']
    assert result['segments'][0]['quality']['status'] == 'needs_review'


@pytest.mark.parametrize('edit', ['summary', 'regenerate', 'task', 'speaker', 'legacy_update'])
def test_legacy_reviewed_source_stays_confirmed_after_note_edits(edit):
    from database import workspace
    from database.db import get_connection
    source = 'thank you ' * 12
    mid = crud.create_meeting('legacy.wav', raw_transcript=source,
        segments=[{'text': source, 'start': 0, 'end': 10, 'speaker': 'Speaker 1'}],
        action_items=[{'task': 'Send minutes'}])
    with get_connection() as connection:
        connection.execute("UPDATE meetings SET review_status='reviewed' WHERE id=?", (mid,))
    if edit == 'summary':
        workspace.review_meeting(mid, 0, 'draft', executive_summary='Human notes')
    elif edit == 'regenerate':
        workspace.save_regenerated_summary(mid, 0, 'New generated notes')
    elif edit == 'task':
        crud.update_action_item_status(mid, 0, 'completed', expected_revision=0)
    elif edit == 'speaker':
        crud.edit_meeting_speaker(mid, 'Speaker 1', 'Alex')
    else:
        crud.update_meeting(mid, executive_summary='Updated notes')
    record = crud.get_meeting(mid)
    assert record.review_status == 'draft'
    assert record.segments[0]['quality']['status'] == 'reviewed'
    assert workspace.review_meeting(mid, record.revision, 'reviewed').review_status == 'reviewed'
