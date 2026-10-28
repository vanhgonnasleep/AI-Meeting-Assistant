from fastapi.testclient import TestClient
from app.main import app
from database.crud import create_meeting


def test_speaker_profiles_api():
    client = TestClient(app)
    response = client.get("/api/speaker-profiles")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert isinstance(data["profiles"], list)


def test_docx_export_api():
    meeting_id = create_meeting(
        filename="Docx_Export_API_Test.mp3",
        raw_transcript="Speaker 1: Testing docx export endpoint.",
        executive_summary="- Summary point for docx export.",
        action_items=[{"task": "Prepare slide deck", "assignee": "Alex", "deadline": "2026-11-01", "status": "pending"}],
        duration=120.0,
        language="vi"
    )

    client = TestClient(app)
    response = client.get(f"/api/meetings/{meeting_id}/export/docx")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers["content-type"]
    assert len(response.content) > 1000


def test_global_chat_endpoint():
    meeting_id = create_meeting(
        filename="Q4_Project_X_Strategy.mp3",
        raw_transcript="Sarah: We decided to allocate 100,000 USD to Project X.",
        executive_summary="- Approved 100,000 USD budget for Project X.",
        action_items=[],
        duration=300.0,
        language="vi"
    )

    client = TestClient(app)
    response = client.post("/api/chat/global", json={
        "question": "Ngân sách của Project X là bao nhiêu?",
        "language": "vi"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "answer" in data
    assert len(data.get("citations", [])) > 0


def test_lan_share_lifecycle():
    meeting_id = create_meeting(
        filename="Q4_Financial_Sync.mp3",
        raw_transcript="Bob: Financial sync complete.",
        executive_summary="- Financial figures confirmed.",
        action_items=[],
        duration=180.0,
        language="vi"
    )

    client = TestClient(app)
    # 1. Create share token
    share_res = client.post(f"/api/meetings/{meeting_id}/share", json={"hours": 48})
    assert share_res.status_code == 200
    share_data = share_res.json()
    token = share_data["token"]
    assert token
    assert "share_url" in share_data
    assert "lan_ip" in share_data

    # 2. Access shared meeting read-only without authentication
    access_res = client.get(f"/api/share/{token}")
    assert access_res.status_code == 200
    meeting_payload = access_res.json()["meeting"]
    assert meeting_payload["filename"] == "Q4_Financial_Sync.mp3"

    # 3. Revoke share token
    revoke_res = client.delete(f"/api/share/{token}")
    assert revoke_res.status_code == 200

    # 4. Access after revocation should return 404
    access_revoked = client.get(f"/api/share/{token}")
    assert access_revoked.status_code == 404
