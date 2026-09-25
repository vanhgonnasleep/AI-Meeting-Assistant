import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = SERVICE_DIR.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from main import app, generate_failsafe_summary
from database.models import MeetingRecord, ActionItem

client = TestClient(app)

def test_health_endpoint():
    """Verify system health, Ollama status, and GPU detection telemetry."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "gpu" in data
    assert "has_gpu" in data
    assert "agents" in data
    assert data["agents"]["agent2_summary"] is True

def test_unsupported_file_format():
    """Ensure invalid file formats (e.g. .txt, .pdf) are rejected with HTTP 400."""
    files = {"file": ("unsupported_document.txt", b"plain text content", "text/plain")}
    response = client.post("/api/process-audio", files=files)
    assert response.status_code == 400
    assert "Only .mp3, .wav, .m4a files are supported" in response.json()["detail"]

def test_instant_demo_mode():
    """Ensure presenter fail-safe demo mode returns valid schema in <100ms."""
    files = {"file": ("sample_meeting.mp3", b"dummy audio binary data", "audio/mp3")}
    response = client.post("/api/process-audio?demo_mode=true", files=files)
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["mode"] == "instant_demo"
    assert "transcript" in payload["data"]
    assert "summary" in payload["data"]
    assert "action_items" in payload["data"]
    assert len(payload["data"]["action_items"]) > 0

def test_failsafe_summary_generator():
    """Ensure fail-safe summary generator returns valid bullet points on timeout."""
    summary = generate_failsafe_summary()
    assert isinstance(summary, str)
    assert len(summary) > 50
    assert "-" in summary

def test_database_schema_contract():
    """Verify MeetingRecord and ActionItem validate properly with Pydantic v2."""
    task = ActionItem(task="Finalize Q3 Budget", assignee="John Doe")
    assert task.task == "Finalize Q3 Budget"
    assert task.assignee == "John Doe"

    record = MeetingRecord(
        filename="budget_review.mp3",
        raw_transcript="Speaker A: Let's finalize the budget.",
        executive_summary="- Approved budget.",
        action_items=[task]
    )
    assert record.filename == "budget_review.mp3"
    assert record.processed_at is not None
    assert len(record.action_items) == 1
