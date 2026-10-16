"""Regressions for the post-rescue audit, using isolated data only."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
import database.db as db
from database import crud


def load_manager():
    path = Path(__file__).resolve().parents[2] / 'scripts' / 'manage_db.py'
    spec = importlib.util.spec_from_file_location('audit_db_manager', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_admin_commands_use_configured_database_and_backup_location(tmp_path, monkeypatch):
    target = tmp_path / 'custom' / 'meeting.db'
    monkeypatch.setenv('CLARION_DB_PATH', str(target))
    manager = load_manager()
    assert manager.DB_FILE == target
    assert manager.BACKUP_DIR == target.parent / 'backups'


def test_admin_schema_includes_fts_profiles_and_deadline_migrations(tmp_path, monkeypatch):
    manager = load_manager()
    monkeypatch.setattr(manager, 'DB_FILE', tmp_path / 'admin.db')
    with manager.get_db_connection() as connection:
        manager.ensure_schema(connection)
        tables = {row[0] for row in connection.execute('SELECT name FROM sqlite_master')}
        assert {'meetings_fts', 'speaker_profiles', 'schema_migrations'} <= tables
        connection.execute("INSERT INTO meetings(filename, raw_transcript) VALUES('fresh.wav','migration rehearsal')")
        assert connection.execute("SELECT count(*) FROM meetings_fts WHERE meetings_fts MATCH 'rehearsal'").fetchone()[0] == 1


def test_failed_schema_migration_rolls_back_new_tables_and_columns(tmp_path, monkeypatch):
    monkeypatch.setattr(db, 'DB_PATH', tmp_path / 'partial.db')
    with db.get_connection() as connection:
        connection.execute('''CREATE TABLE meetings(id INTEGER PRIMARY KEY, filename TEXT,
            raw_transcript TEXT, executive_summary TEXT, action_items TEXT,
            created_at TEXT, updated_at TEXT)''')
        # Force a late migration error without touching user data.
        connection.execute('CREATE TABLE meetings_fts(wrong_column TEXT)')
        connection.execute("""INSERT INTO meetings(filename, created_at, action_items)
            VALUES('old.wav', '2026-10-14 10:00:00', '[{}]')""")
    with pytest.raises(Exception):
        db.init_db()
    with db.get_connection() as connection:
        assert 'duration' not in {row[1] for row in connection.execute('PRAGMA table_info(meetings)')}
        assert connection.execute("SELECT 1 FROM sqlite_master WHERE name='speaker_profiles'").fetchone() is None


def test_sse_completion_does_not_resend_entire_persisted_chat(monkeypatch):
    monkeypatch.setattr(main, 'get_gpu_info', lambda: ('CPU', False))
    monkeypatch.setattr(main, 'resolve_model', lambda *a, **k: 'test')
    monkeypatch.setattr(main, 'stream_meeting_question', lambda **kw: (event for event in [
        {'token': 'Friday.', 'done': False},
        {'answer': 'Friday.', 'done': True, 'citations': [], 'mode': 'rag_llm'},
    ]))
    mid = crud.create_meeting(filename='large-chat.wav', raw_transcript='Migration Friday.',
        chat_history=[{'role': 'assistant', 'content': 'x' * 40_000}] * 30)
    response = TestClient(main.app).post('/api/chat/stream', json={'question': 'migration?', 'meeting_id': mid})
    assert response.status_code == 200
    frames = [json.loads(frame[6:]) for frame in response.text.strip().split('\n\n')]
    assert frames[-1]['done'] is True
    assert 'chat_history' not in frames[-1]
    assert len(response.content) < 10_000
    assert crud.get_chat_history(mid)[-1]['content'] == 'Friday.'


def test_chunk_missing_runtime_is_reported_as_service_unavailable(monkeypatch):
    def unavailable(*args, **kwargs):
        raise RuntimeError('Whisper model is unavailable')
    monkeypatch.setattr(main, 'transcribe_audio_chunk', unavailable)
    response = TestClient(main.app).post('/api/transcribe-chunk', files={'file': ('a.wav', b'audio')})
    assert response.status_code == 503
    assert 'unavailable' in response.json()['detail'].lower()


def test_clean_workspace_removes_voice_profiles_and_preserves_backup(tmp_path, monkeypatch):
    manager = load_manager()
    monkeypatch.setattr(manager, 'DB_FILE', tmp_path / 'clean.db')
    monkeypatch.setattr(manager, 'BACKUP_DIR', tmp_path / 'backups')
    with manager.get_db_connection() as connection:
        manager.ensure_schema(connection)
        connection.execute("INSERT INTO speaker_profiles(name,embedding) VALUES('Private person','[1,0]')")
    manager.clean_database()
    with manager.get_db_connection() as connection:
        assert connection.execute('SELECT count(*) FROM speaker_profiles').fetchone()[0] == 0
    import sqlite3
    with sqlite3.connect(next(manager.BACKUP_DIR.glob('*.db'))) as backup:
        assert backup.execute('SELECT name FROM speaker_profiles').fetchone()[0] == 'Private person'


def test_profile_centroid_is_the_mean_of_all_samples():
    import math
    crud.upsert_speaker_profile('Alice', [1., 0.])
    crud.upsert_speaker_profile('Alice', [0., 1.])
    crud.upsert_speaker_profile('Alice', [1., 0.])
    assert crud.get_speaker_profiles()[0]['embedding'] == pytest.approx([2 / math.sqrt(5), 1 / math.sqrt(5)])


def test_profile_oversized_numbers_are_validation_errors():
    with pytest.raises(ValueError):
        crud.upsert_speaker_profile('Alice', [10**1000, 1])


def test_correction_can_repair_corrupted_profile_metadata():
    with db.get_connection() as connection:
        connection.execute("INSERT INTO speaker_profiles(name,embedding,sample_count) VALUES('Alice','broken','bad')")
    crud.upsert_speaker_profile('Alice', [1., 0.])
    assert crud.match_speaker_profile([1., 0.]) == 'Alice'


def test_diarization_preserves_each_turn_embedding_for_human_corrections(monkeypatch):
    torch = pytest.importorskip('torch')
    pytest.importorskip('whisper')
    import agent1_transcribe as stt
    vectors = iter([torch.tensor([1., 0., 0.]), torch.tensor([0., 1., 0.])])
    monkeypatch.setattr(stt, '_embedding_from_pcm', lambda *a: next(vectors))
    segments, _ = stt.diarize_segments([
        {'text': 'Alice', 'start': 0, 'end': 2}, {'text': 'Bob', 'start': 2, 'end': 4}], 'unused',
        num_speakers=1, subdivide_sentences=False, use_llm_refinement=False, prepared_audio=object())
    assert segments[0]['voice_embedding'] == [1., 0., 0.]
    assert segments[1]['voice_embedding'] == [0., 1., 0.]
