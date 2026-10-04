import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
SERVICE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = SERVICE_DIR.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dataclasses import is_dataclass
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
    assert "Only .mp3, .wav, .m4a" in response.json()["detail"]

def test_instant_demo_mode():
    """Ensure presenter fail-safe demo mode returns valid schema in <100ms via demo_mode, model, or filename."""
    # 1. Via demo_mode=true query parameter
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

    # 2. Via model=instant_demo query parameter
    files_model = {"file": ("any_meeting.mp3", b"dummy audio binary data", "audio/mp3")}
    res_model = client.post("/api/process-audio?model=instant_demo", files=files_model)
    assert res_model.status_code == 200
    assert res_model.json()["mode"] == "instant_demo"

    # 3. Via demo sample filename (e.g. q3_product_budget_review.mp3)
    files_sample = {"file": ("q3_product_budget_review.mp3", b"sample meeting dummy binary content", "audio/mp3")}
    res_sample = client.post("/api/process-audio", files=files_sample)
    assert res_sample.status_code == 200
    assert res_sample.json()["mode"] == "instant_demo"

def test_failsafe_summary_generator():
    """Ensure fail-safe summary generator returns valid bullet points on timeout."""
    summary = generate_failsafe_summary()
    assert isinstance(summary, str)
    assert len(summary) > 50
    assert "-" in summary

def test_database_schema_contract():
    """Verify MeetingRecord and ActionItem validate properly as Python dataclasses."""
    assert is_dataclass(ActionItem)
    assert is_dataclass(MeetingRecord)

    task = ActionItem(task="Finalize Q3 Budget", assignee="John Doe")
    assert task.task == "Finalize Q3 Budget"
    assert task.assignee == "John Doe"
    assert task.to_dict()["task"] == "Finalize Q3 Budget"
    assert task.model_dump()["assignee"] == "John Doe"

    record = MeetingRecord(
        filename="budget_review.mp3",
        raw_transcript="Speaker A: Let's finalize the budget.",
        executive_summary="- Approved budget.",
        action_items=[task]
    )
    assert record.filename == "budget_review.mp3"
    assert record.processed_at is not None
    assert len(record.action_items) == 1
    assert record.to_dict()["filename"] == "budget_review.mp3"
    assert record.model_dump()["action_items"][0]["task"] == "Finalize Q3 Budget"

def test_meeting_crud_endpoints():
    """Verify GET, detail, and DELETE endpoints for meeting database records."""
    import database.crud as crud
    # Create test meeting
    meeting_id = crud.create_meeting(
        filename="test_crud_meeting.mp3",
        raw_transcript="Speaker A: Hello test.",
        executive_summary="- Test summary.",
        action_items=[{"task": "Unit test", "assignee": "Tester"}]
    )
    assert meeting_id is not None

    # Test GET /api/meetings
    res_list = client.get("/api/meetings")
    assert res_list.status_code == 200
    data_list = res_list.json()
    assert data_list["status"] == "success"
    assert any(m["id"] == meeting_id for m in data_list["meetings"])

    # Test GET /api/meetings/{id}
    res_detail = client.get(f"/api/meetings/{meeting_id}")
    assert res_detail.status_code == 200
    data_detail = res_detail.json()
    assert data_detail["status"] == "success"
    assert data_detail["meeting"]["filename"] == "test_crud_meeting.mp3"

    # Test DELETE /api/meetings/{id}
    res_del = client.delete(f"/api/meetings/{meeting_id}")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True

    # Confirm 404 after deletion
    res_notfound = client.get(f"/api/meetings/{meeting_id}")
    assert res_notfound.status_code == 404


def test_version_endpoint():
    """Verify system architecture documentation endpoint /api/version."""
    response = client.get("/api/version")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "2.0.0"
    assert "agents" in data
    assert len(data["agents"]) >= 4
    assert "fail_safe_mechanisms" in data


def test_meeting_crud_edge_cases():
    """Verify CRUD resilience when action_items is a single dict or list of strings."""
    import database.crud as crud
    # Test single dict input
    m1 = crud.create_meeting(
        filename="dict_actions.mp3",
        raw_transcript="Meeting audio transcript",
        executive_summary="- Summary",
        action_items={"task": "Fix bug", "assignee": "Alice"}
    )
    assert m1 is not None
    record1 = crud.get_meeting(m1)
    assert len(record1.action_items) == 1
    assert record1.action_items[0].task == "Fix bug"

    # Test list of plain strings input
    m2 = crud.create_meeting(
        filename="str_actions.mp3",
        raw_transcript="Meeting audio transcript",
        executive_summary="- Summary",
        action_items=["Task one", "Task two"]
    )
    assert m2 is not None
    record2 = crud.get_meeting(m2)
    assert len(record2.action_items) == 2
    assert record2.action_items[0].task == "Task one"


def test_meeting_search_endpoint():
    """Verify GET /api/meetings?q=... returns matching results."""
    import database.crud as crud
    crud.create_meeting(
        filename="unique_quarterly_planning_alpha.mp3",
        raw_transcript="Special keyword for search query test.",
        executive_summary="Summary with search match.",
        action_items=[{"task": "Prepare Q3 revenue forecast", "assignee": "Jonathan", "status": "pending"}]
    )
    res = client.get("/api/meetings?q=quarterly_planning_alpha")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert any("unique_quarterly_planning_alpha" in m["filename"] for m in data["meetings"])

    # Search by action item assignee
    res_task = client.get("/api/meetings?q=Jonathan")
    assert res_task.status_code == 200
    assert any("unique_quarterly_planning_alpha" in m["filename"] for m in res_task.json()["meetings"])


def test_meeting_update_put_endpoint():
    """Verify PUT /api/meetings/{id} updates summary and fields."""
    import database.crud as crud
    mid = crud.create_meeting(
        filename="editable_meeting.mp3",
        raw_transcript="Initial text.",
        executive_summary="Initial summary.",
        action_items=[]
    )
    update_payload = {
        "filename": "editable_meeting_v2.mp3",
        "executive_summary": "Updated executive summary text.",
        "duration": 120.5,
        "language": "en"
    }
    res = client.put(f"/api/meetings/{mid}", json=update_payload)
    assert res.status_code == 200
    assert res.json()["updated"] is True

    record = crud.get_meeting(mid)
    assert record.filename == "editable_meeting_v2.mp3"
    assert record.executive_summary == "Updated executive summary text."
    assert record.duration == 120.5


def test_meeting_task_status_patch_endpoint():
    """Verify PATCH /api/meetings/{id}/tasks/{idx} toggles task status."""
    import database.crud as crud
    mid = crud.create_meeting(
        filename="tasks_meeting.mp3",
        raw_transcript="Transcript text.",
        executive_summary="Executive summary.",
        action_items=[
            {"task": "Design architecture", "assignee": "Alex", "status": "pending"},
            {"task": "Run tests", "assignee": "Dev", "status": "pending"}
        ]
    )
    res = client.patch(f"/api/meetings/{mid}/tasks/0", json={"status": "completed"})
    assert res.status_code == 200
    assert res.json()["status"] == "completed"

    record = crud.get_meeting(mid)
    assert record.action_items[0].status == "completed"
    assert record.action_items[1].status == "pending"


def test_concurrent_task_status_updates_preserve_both_changes():
    """Concurrent task updates must not overwrite each other's action-item changes."""
    import database.crud as crud

    meeting_id = crud.create_meeting(
        filename="concurrent_tasks.mp3",
        action_items=[
            {"task": "Prepare report", "status": "pending"},
            {"task": "Review budget", "status": "pending"},
        ],
    )
    barrier = Barrier(2)

    def update_task(index, status):
        barrier.wait()
        return crud.update_action_item_status(meeting_id, index, status)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(update_task, 0, "completed")
            second = executor.submit(update_task, 1, "in_progress")
            assert first.result(timeout=5) is True
            assert second.result(timeout=5) is True

        record = crud.get_meeting(meeting_id)
        assert [item.status for item in record.action_items] == ["completed", "in_progress"]
    finally:
        crud.delete_meeting(meeting_id)


def test_meeting_task_status_invalid_value():
    """Verify PATCH /api/meetings/{id}/tasks/{idx} rejects invalid status values with 422."""
    import database.crud as crud
    mid = crud.create_meeting(
        filename="validation_test.mp3",
        raw_transcript="Test transcript.",
        executive_summary="Summary.",
        action_items=[{"task": "Test task", "assignee": "Alice", "status": "pending"}]
    )
    res = client.patch(f"/api/meetings/{mid}/tasks/0", json={"status": "invalid_status_xyz"})
    assert res.status_code == 422


def test_analytics_endpoint():
    """Verify GET /api/analytics returns valid metrics schema."""
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "analytics" in data
    stats = data["analytics"]
    assert "total_meetings" in stats
    assert "total_action_items" in stats
    assert "completion_rate_percent" in stats
    assert stats["total_meetings"] >= 1


def test_meeting_insights_heuristic():
    """Verify deterministic extraction of decisions, risks, and questions with segment evidence."""
    from meeting_insights import extract_insights_heuristic
    transcript = (
        "Speaker A: We decided to approved $50,000 for the Q3 marketing budget.\n"
        "Speaker B: However, the main risk is a potential delay if John slips on the financial report.\n"
        "Speaker A: Who will oversee the social media ad accounts once launched?"
    )
    segments = [
        {"id": 1, "start": 0.0, "end": 10.0, "timestamp": "[00:00 - 00:10]", "speaker": "Speaker A", "text": "We decided to approved $50,000 for the Q3 marketing budget."},
        {"id": 2, "start": 10.5, "end": 20.0, "timestamp": "[00:10 - 00:20]", "speaker": "Speaker B", "text": "However, the main risk is a potential delay if John slips on the financial report."},
        {"id": 3, "start": 20.5, "end": 28.0, "timestamp": "[00:20 - 00:28]", "speaker": "Speaker A", "text": "Who will oversee the social media ad accounts once launched?"}
    ]
    insights = extract_insights_heuristic(transcript, segments=segments)
    assert "decisions" in insights
    assert "risks" in insights
    assert "open_questions" in insights
    assert len(insights["decisions"]) >= 1
    assert len(insights["risks"]) >= 1
    assert len(insights["open_questions"]) >= 1
    assert insights["decisions"][0].get("timestamp") is not None


def test_instant_demo_mode_includes_insights_and_chat():
    """Verify that instant demo returns rich insights, chat history, and corrected 29.05s duration."""
    files = {"file": ("q3_product_budget_review.mp3", b"dummy audio", "audio/mp3")}
    res = client.post("/api/process-audio?demo_mode=true", files=files)
    assert res.status_code == 200
    payload = res.json()
    assert payload["status"] == "success"
    data = payload["data"]
    assert "insights" in data
    assert "decisions" in data["insights"] and len(data["insights"]["decisions"]) >= 2
    assert "risks" in data["insights"] and len(data["insights"]["risks"]) >= 2
    assert "open_questions" in data["insights"] and len(data["insights"]["open_questions"]) >= 2
    assert "chat_history" in data and len(data["chat_history"]) >= 2
    assert data["duration"] == 29.05


def test_meeting_chat_standalone_and_demo():
    """Verify /api/chat standalone endpoint with demo-matched questions."""
    # Test English query matching budget intent
    res = client.post("/api/chat", json={
        "question": "What is the approved budget?",
        "demo_mode": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "50,000" in data["answer"]
    assert len(data["citations"]) >= 1

    # Test Vietnamese query matching deadline intent
    res_vi = client.post("/api/chat", json={
        "question": "Ai phụ trách báo cáo tài chính và hạn chót khi nào?",
        "demo_mode": True,
        "language": "vi"
    })
    assert res_vi.status_code == 200
    assert "John" in res_vi.json()["answer"]
    assert len(res_vi.json()["citations"]) >= 1


def test_meeting_chat_crud_persistence():
    """Verify meeting chat persistence: POST new question, GET history, and DELETE history."""
    import database.crud as crud
    mid = crud.create_meeting(
        filename="chat_test_meeting.mp3",
        raw_transcript="Speaker A: We finalized the cloud migration for August 15. Speaker B: Sounds great.",
        executive_summary="Approved migration for August 15.",
        action_items=[{"task": "Prepare migration plan", "assignee": "Alex"}]
    )

    # Ask question
    res_post = client.post(f"/api/meetings/{mid}/chat", json={
        "question": "When is the migration scheduled?"
    })
    assert res_post.status_code == 200
    post_data = res_post.json()
    assert post_data["status"] == "success"
    assert len(post_data["chat_history"]) >= 2

    # Get chat history
    res_get = client.get(f"/api/meetings/{mid}/chat")
    assert res_get.status_code == 200
    assert len(res_get.json()["chat_history"]) >= 2

    # Clear chat history
    res_del = client.delete(f"/api/meetings/{mid}/chat")
    assert res_del.status_code == 200
    assert res_del.json()["cleared"] is True

    # Verify history is now empty
    res_get_empty = client.get(f"/api/meetings/{mid}/chat")
    assert res_get_empty.json()["chat_history"] == []

