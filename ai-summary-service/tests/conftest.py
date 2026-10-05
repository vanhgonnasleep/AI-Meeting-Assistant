"""Keep test collection and every test away from real meeting data."""
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ai-summary-service"))

import database.db as db

# crud initializes the schema at import time, before fixtures run.
_collection_database = TemporaryDirectory(prefix="meeting-tests-")
db.DB_PATH = Path(_collection_database.name) / "collection.db"


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "meeting.db")
    db.init_db()


def pytest_collection_modifyitems(config, items):
    if config.getoption("--run-model-tests"):
        return
    model_tests = {
        "test_transcribe_audio_from_bytes",
        "test_transcribe_audio_detailed_from_temp_file",
        "test_transcribe_endpoint_success",
        "test_transcribe_endpoint_with_diarization",
        "test_non_speech_does_not_become_a_long_repetition_loop",
        "test_fallback_keeps_clear_spoken_meeting_content",
    }
    for item in items:
        if item.name in model_tests:
            item.add_marker(pytest.mark.skip(reason="Use --run-model-tests for local Whisper integration tests"))


def pytest_addoption(parser):
    parser.addoption("--run-model-tests", action="store_true", default=False)
