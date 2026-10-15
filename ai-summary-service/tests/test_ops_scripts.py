"""Maintenance commands must preserve data and report actual measurements."""
import datetime
import importlib.util
import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[2]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def manager(tmp_path, monkeypatch):
    module = load_script("manage_db")
    monkeypatch.setattr(module, "DB_FILE", tmp_path / "operations.db")
    monkeypatch.setattr(module, "BACKUP_DIR", tmp_path / "backups")
    module.BACKUP_DIR.mkdir()
    return module


def test_status_migrates_original_schema_without_losing_saved_minutes(manager):
    with sqlite3.connect(manager.DB_FILE) as conn:
        conn.execute("""CREATE TABLE meetings (id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL, raw_transcript TEXT, executive_summary TEXT,
            action_items TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
        conn.execute("INSERT INTO meetings(filename, raw_transcript) VALUES ('original.wav', 'Keep these minutes')")
    manager.get_status()
    with sqlite3.connect(manager.DB_FILE) as conn:
        row = conn.execute("SELECT filename,raw_transcript,revision,review_status,project_id FROM meetings").fetchone()
    assert row == ("original.wav", "Keep these minutes", 0, "draft", None)


def test_seed_resolves_project_names_instead_of_reusing_unrelated_ids(manager):
    with manager.get_db_connection() as conn:
        manager.ensure_schema(conn)
        conn.executemany("INSERT INTO projects(id,name,name_key) VALUES (?,?,?)", [
            (1, "Existing customer", "existing customer"),
            (2, "Existing roadmap", "existing roadmap"),
            (7, "CLARION CORE PLATFORM", "clarion core platform"),
        ])
        conn.execute("INSERT INTO meetings(filename,project_id) VALUES ('real.wav',1)")
    manager.seed_database()
    with sqlite3.connect(manager.DB_FILE) as conn:
        assigned = conn.execute("""SELECT m.filename,p.name_key FROM meetings m
            JOIN projects p ON p.id=m.project_id ORDER BY m.id""").fetchall()
    assert assigned == [
        ("real.wav", "existing customer"),
        ("q3_product_budget_review.wav", "clarion core platform"),
        ("Clarion_Q4_Architecture_Sync.mp3", "clarion core platform"),
        ("Executive_Strategy_2026_Enterprise_Readiness.mp3", "enterprise compliance"),
    ]


def test_backups_in_same_clock_tick_preserve_both_snapshots(manager, monkeypatch):
    class FrozenTime(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 15, 12, 0, 0)
    monkeypatch.setattr(manager.datetime, "datetime", FrozenTime)
    with sqlite3.connect(manager.DB_FILE) as conn:
        conn.execute("CREATE TABLE example(value TEXT)")
        conn.execute("INSERT INTO example VALUES ('before')")
    first = manager.backup_database()
    with sqlite3.connect(manager.DB_FILE) as conn:
        conn.execute("UPDATE example SET value='after'")
    second = manager.backup_database()
    assert first != second
    with sqlite3.connect(first) as conn:
        assert conn.execute("SELECT value FROM example").fetchone()[0] == "before"
    with sqlite3.connect(second) as conn:
        assert conn.execute("SELECT value FROM example").fetchone()[0] == "after"


def test_restore_rejects_invalid_input_before_backing_up_or_touching_live_data(manager):
    manager.seed_database()
    invalid = manager.DB_FILE.parent / "invalid.db"
    invalid.write_text("not a SQLite backup", encoding="utf-8")
    with pytest.raises((ValueError, sqlite3.DatabaseError, SystemExit)):
        manager.restore_backup(str(invalid))
    assert list(manager.BACKUP_DIR.iterdir()) == []
    with sqlite3.connect(manager.DB_FILE) as conn:
        assert conn.execute("SELECT COUNT(*) FROM meetings").fetchone()[0] == 3


def test_restore_rejects_live_database_as_source_without_copying(manager, monkeypatch):
    manager.seed_database()
    # A self-backup may block forever; fail at the unsafe backup boundary instead.
    def unsafe_backup():
        pytest.fail("Self restore reached the backup/copy stage")
    monkeypatch.setattr(manager, "backup_database", unsafe_backup)
    with pytest.raises((ValueError, SystemExit)):
        manager.restore_backup(str(manager.DB_FILE))


def test_restore_rejects_incomplete_meeting_schema_before_replacing_live_data(manager):
    manager.seed_database()
    invalid = manager.DB_FILE.parent / "incomplete.db"
    with sqlite3.connect(invalid) as conn:
        conn.execute("""CREATE TABLE meetings (id INTEGER PRIMARY KEY, filename TEXT,
            raw_transcript TEXT, executive_summary TEXT, action_items TEXT)""")
    with pytest.raises(ValueError, match="meeting database"):
        manager.restore_backup(str(invalid))
    assert list(manager.BACKUP_DIR.iterdir()) == []
    with sqlite3.connect(manager.DB_FILE) as conn:
        assert conn.execute("SELECT COUNT(*) FROM meetings").fetchone()[0] == 3


def test_restore_preserves_a_recoverable_copy_of_current_meetings(manager):
    manager.seed_database()
    original = manager.backup_database()
    with sqlite3.connect(manager.DB_FILE) as conn:
        conn.execute("UPDATE meetings SET filename='edited.wav' WHERE id=1")
    manager.restore_backup(str(original))
    with sqlite3.connect(manager.DB_FILE) as conn:
        assert conn.execute("SELECT filename FROM meetings WHERE id=1").fetchone()[0] == "q3_product_budget_review.wav"
    copies = [path for path in manager.BACKUP_DIR.glob("*.db") if path != original]
    assert len(copies) == 1
    with sqlite3.connect(copies[0]) as conn:
        assert conn.execute("SELECT filename FROM meetings WHERE id=1").fetchone()[0] == "edited.wav"


def test_failed_whisper_benchmark_has_no_fabricated_measurements(monkeypatch):
    benchmark = load_script("benchmark_pipeline")
    import sys
    def fail_to_load(*args, **kwargs):
        raise RuntimeError("model unavailable offline")
    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(load_model=fail_to_load))
    result = benchmark.benchmark_whisper_rtf()
    assert result["status"] == "skipped"
    assert "unavailable" in result["reason"]
    for key in ("inference_time_s", "rtf", "processing_speed", "model_load_time_s"):
        assert result[key] is None


def test_whisper_benchmark_decodes_with_bundled_ffmpeg_before_inference(monkeypatch):
    np = pytest.importorskip("numpy")
    benchmark = load_script("benchmark_pipeline")
    import sys
    class Model:
        def transcribe(self, audio, **kwargs):
            if not isinstance(audio, np.ndarray):
                raise RuntimeError("Whisper path decoding needs ffmpeg on PATH")
            assert audio.dtype == np.float32 and audio.size > 16000
            return {"text": "Measured transcription"}
    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(load_model=lambda *a, **k: Model()))
    result = benchmark.benchmark_whisper_rtf()
    assert result["status"] == "measured"
    assert result["audio_duration_s"] == pytest.approx(29.05, abs=0.01)
    assert result["inference_time_s"] >= 0
    assert result["words_transcribed"] == 2


def test_invalid_benchmark_recording_is_skipped_instead_of_aborting_report(tmp_path, monkeypatch):
    benchmark = load_script("benchmark_pipeline")
    monkeypatch.setattr(benchmark, "REPO_ROOT", tmp_path)
    recording = tmp_path / "meeting-assistant-ui" / "public" / "q3_product_budget_review.wav"
    recording.parent.mkdir(parents=True)
    recording.write_bytes(b"invalid recording")
    import sys
    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(load_model=lambda *a, **k: object()))
    result = benchmark.benchmark_whisper_rtf()
    assert result["status"] == "skipped"
    assert "decoding failed" in result["reason"]
    assert result["rtf"] is None


def test_report_labels_skipped_inference_and_limits_claims_to_measured_workload(tmp_path, monkeypatch):
    benchmark = load_script("benchmark_pipeline")
    monkeypatch.setattr(benchmark, "REPO_ROOT", tmp_path)
    (tmp_path / "docs").mkdir()
    mmr = benchmark.benchmark_mmr()
    db_result = benchmark.benchmark_sqlite_wal()
    report = benchmark.generate_markdown_report(mmr, db_result, {
        "status": "skipped", "reason": "model unavailable", "model": "Whisper tiny",
        "audio_duration_s": 29.05, "inference_time_s": None, "rtf": None, "processing_speed": None,
    }).read_text(encoding="utf-8")
    assert "model unavailable" in report
    assert "not measured" in report.lower()
    assert "sequential" in report.lower()
    assert "synthetic" in report.lower()
    assert "without losing critical action items" not in report
    assert "~120ms" not in report
