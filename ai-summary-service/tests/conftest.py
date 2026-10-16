"""Keep test collection and every test away from real meeting data."""
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
import dotenv

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ai-summary-service"))

# A developer's saved .env must never configure collection-time middleware,
# contact real providers, or select their database during regression tests.
# Individual tests can still override these explicit defaults with monkeypatch.
_test_environment = pytest.MonkeyPatch()
for name, value in {
    'CLARION_ALLOWED_HOSTS': 'localhost,127.0.0.1,[::1],testserver,test',
    'CORS_ORIGINS': 'http://localhost:5173,http://127.0.0.1:5173',
    'CLARION_AUTH_MODE': 'local',
    'CLARION_PUBLIC_URL': 'http://localhost:8002',
    'CLARION_FRONTEND_URL': 'http://localhost:5173',
    'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': '',
    'GITHUB_CLIENT_ID': '', 'GITHUB_CLIENT_SECRET': '',
    'MAX_UPLOAD_MB': '256', 'MAX_AUDIO_DURATION_SECONDS': '10800',
    'AUDIO_CHUNK_SECONDS': '300',
}.items():
    _test_environment.setenv(name, value)
_test_environment.delenv('OLLAMA_BASE_URL', raising=False)
_test_environment.setattr(dotenv, 'load_dotenv', lambda *args, **kwargs: False)

# crud initializes the schema at import time, before fixtures run.
_collection_database = TemporaryDirectory(prefix="meeting-tests-")
_test_environment.setenv('CLARION_DB_PATH', str(Path(_collection_database.name) / 'collection.db'))
_test_environment.setenv('CLARION_DATA_DIR', str(Path(_collection_database.name) / 'private-data'))

import database.db as db

db.DB_PATH = Path(_collection_database.name) / "collection.db"


def pytest_unconfigure(config):
    _test_environment.undo()


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    # Legacy API tests exercise the explicitly selected offline/local workflow.
    monkeypatch.setenv('CLARION_AUTH_MODE', 'local')
    monkeypatch.setenv('CLARION_DATA_DIR', str(tmp_path / 'private-data'))
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
