from datetime import datetime
from io import BytesIO
import wave

import pytest
from fastapi.testclient import TestClient

import agent1_transcribe as stt
import agent3_action_items as actions
import database.crud as crud
import database.db as db
import main


@pytest.mark.parametrize('text, expected', [
    ('thứ 6 tuần này', '2026-10-16'), ('cuối tháng', '2026-10-31'),
    ('ngày mai', '2026-10-15'), ('next Monday', '2026-10-19'),
    ('Friday afternoon', '2026-10-16'), ('2026-12-31', '2026-12-31'),
    ('31/12/2026', '2026-12-31'), ('end of sprint', None), ('someday', None),
    ('2026-02-30', None), ('not Friday', None), ('', None),
])
def test_deadline_normalization(text, expected):
    assert actions.normalize_deadline_to_iso(text, datetime(2026, 10, 14)) == expected


def test_deadline_boundaries_and_sprint_context():
    normalize = actions.normalize_deadline_to_iso
    assert normalize('tomorrow', datetime(2026, 12, 31)) == '2027-01-01'
    assert normalize('cuối tháng', datetime(2024, 2, 1)) == '2024-02-29'
    assert normalize('next Monday', datetime(2026, 10, 19)) == '2026-10-26'
    assert normalize('end of sprint', datetime(2026, 10, 14), sprint_end=datetime(2026, 10, 23)) == '2026-10-23'


def test_iso_deadline_survives_storage_and_task_status():
    mid = crud.create_meeting(filename='dates.wav', action_items=[{'task': 'Ship', 'deadline': '2026-12-31'}])
    assert crud.get_meeting(mid).action_items[0].deadline_iso == '2026-12-31'
    crud.update_action_item_status(mid, 0, 'done')
    assert crud.get_meeting(mid).action_items[0].deadline_iso == '2026-12-31'


def test_legacy_deadlines_backfilled_against_original_meeting_date():
    with db.get_connection() as connection:
        connection.execute("DELETE FROM schema_migrations WHERE name='deadline_iso_v1'")
        connection.execute('''INSERT INTO meetings(filename, created_at, action_items) VALUES
            ('legacy.wav', '2026-10-14 10:00:00', '[{"task":"Ship","deadline":"ngày mai"}]')''')
    db.init_db()
    assert crud.get_all_meetings()[0].action_items[0].deadline_iso == '2026-10-15'


def test_voice_profile_enrollment_centroid_and_threshold():
    crud.upsert_speaker_profile('Alice', [1., 0., 0.])
    assert crud.match_speaker_profile([1., 0., 0.]) == 'Alice'
    assert crud.match_speaker_profile([0., 1., 0.]) is None
    assert crud.match_speaker_profile([1., 0.]) is None
    crud.upsert_speaker_profile('Alice', [1., 0., 0.])
    assert crud.get_speaker_profiles()[0]['sample_count'] == 2


@pytest.mark.parametrize('embedding', [[], [0., 0.], [float('nan'), 1.], [float('inf'), 0.], ['x', 1.]])
def test_invalid_voiceprints_rejected(embedding):
    with pytest.raises(ValueError):
        crud.upsert_speaker_profile('Alice', embedding)


def test_speaker_correction_enrolls_real_acoustic_centroid():
    mid = crud.create_meeting(filename='voice.wav', segments=[
        {'speaker': 'Speaker 1', 'text': 'hello', 'start': 0, 'end': 2, 'voice_embedding': [1., 0., 0.]},
        {'speaker': 'Speaker 1', 'text': 'world', 'start': 2, 'end': 4, 'voice_embedding': [1., 0., 0.]},
    ])
    crud.edit_meeting_speaker(mid, 'Speaker 1', 'Alice')
    assert crud.match_speaker_profile([1., 0., 0.]) == 'Alice'


def wav_bytes(seconds=0.2):
    buffer = BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(b'\0\0' * int(seconds * 16000))
    return buffer.getvalue()


def test_chunk_decode_is_in_memory_and_silence_skips_model(monkeypatch):
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kwargs: pytest.fail('Silence must not load Whisper'))
    result = stt.transcribe_audio_chunk(wav_bytes(), model_name='tiny')
    assert result['text'] == '' and result['duration'] == pytest.approx(0.2)


def test_chunk_endpoint_and_input_limits(monkeypatch):
    monkeypatch.setattr(main, 'transcribe_audio_chunk', lambda data, **k: {'text': 'Hello', 'language': 'en', 'duration': .2})
    client = TestClient(main.app)
    response = client.post('/api/transcribe-chunk?whisper_model=tiny', files={'file': ('chunk.wav', wav_bytes(), 'audio/wav')})
    assert response.status_code == 200 and response.json()['text'] == 'Hello'
    assert client.post('/api/transcribe-chunk', files={'file': ('bad.txt', b'x')}).status_code == 400
    assert client.post('/api/transcribe-chunk', files={'file': ('empty.wav', b'')}).status_code == 400


def test_chunk_rejects_excessive_duration_before_inference(monkeypatch):
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **kwargs: pytest.fail('Decode budget must precede model allocation'))
    with pytest.raises(stt.MediaLimitError):
        stt.transcribe_audio_chunk(wav_bytes(31))


def test_chunk_rejects_invalid_media():
    with pytest.raises(ValueError):
        stt.transcribe_audio_chunk(b'not audio')


def test_chunk_forwards_mono_numpy_samples_without_temp_files(monkeypatch):
    import numpy as np
    from types import SimpleNamespace
    samples = (np.sin(np.arange(3200) * .2) * 12000).astype('<i2')
    buffer = BytesIO()
    with wave.open(buffer, 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(16000)
        output.writeframes(samples.tobytes())
    def infer(audio, **options):
        assert audio.dtype == np.float32 and audio.shape == (3200,)
        assert options['condition_on_previous_text'] is False
        return {'text': ' Hello world ', 'language': 'en'}
    monkeypatch.setattr(stt.tempfile, 'NamedTemporaryFile', lambda *a, **k: pytest.fail('No temporary audio files'))
    monkeypatch.setattr(stt, 'get_whisper_model', lambda **k: SimpleNamespace(transcribe=infer))
    assert stt.transcribe_audio_chunk(buffer.getvalue())['text'] == 'Hello world'


def test_diarization_reuses_enrolled_name(monkeypatch):
    import torch
    crud.upsert_speaker_profile('Alice', [1., 0., 0.])
    monkeypatch.setattr(stt, '_embedding_from_pcm', lambda *a: torch.tensor([1., 0., 0.]))
    segments, names = stt.diarize_segments([{'text': 'Hello', 'start': 0, 'end': 2}], 'unused',
                                         subdivide_sentences=False, use_llm_refinement=False, prepared_audio=object())
    assert names == ['Alice']
    assert segments[0]['voice_embedding'] == [1., 0., 0.]
