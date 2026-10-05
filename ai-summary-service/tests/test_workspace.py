"""Workspace behavior against a private database (never the owner's meeting data)."""
import importlib.util
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import database.db as db
from database import crud


def make_client(summary_function=lambda *a, **k: "Regenerated summary"):
    app = FastAPI()
    if importlib.util.find_spec("workspace_api"):
        from workspace_api import create_workspace_router
        app.include_router(create_workspace_router(summary_function))
    return TestClient(app)


def meeting():
    return crud.create_meeting(
        filename="review.wav", raw_transcript="Alice: Approve after review.",
        executive_summary="Original summary", language="vi",
        action_items=[{"task": "Review launch", "assignee": "Alice", "status": "pending"}],
        segments=[{"text": "Approve after review.", "speaker": "Alice", "start": 1, "end": 4}],
        insights={"decisions": [{"text": "Launch", "speaker": "Alice", "start": 1}]},
    )


def review(client, mid, revision=0, **changes):
    return client.patch(f"/api/meetings/{mid}/review", json={
        "expected_revision": revision, "review_status": "reviewed", **changes,
    })


def test_migration_preserves_legacy_data_and_defaults(tmp_path, monkeypatch):
    legacy = tmp_path / "legacy.db"
    with sqlite3.connect(legacy) as connection:
        connection.execute("CREATE TABLE meetings (id INTEGER PRIMARY KEY, filename TEXT NOT NULL, raw_transcript TEXT, executive_summary TEXT, action_items TEXT, created_at TEXT, updated_at TEXT)")
        connection.execute("INSERT INTO meetings VALUES (1, 'legacy.wav', 'Original', 'Summary', '[]', '2020-01-01', '2020-01-01')")
    monkeypatch.setattr(db, "DB_PATH", legacy)
    db.init_db()
    db.init_db()
    record = crud.get_meeting(1).to_dict()
    assert record["raw_transcript"] == "Original"
    assert record.get("revision") == 0
    assert record.get("review_status") == "draft"
    assert record.get("project_id") is None


def test_review_change_and_stale_write_are_atomic():
    client, mid = make_client(), meeting()
    response = review(client, mid)
    assert response.status_code == 200
    marked = response.json()["meeting"]
    assert marked["review_status"] == "reviewed" and marked["revision"] == 1
    response = review(client, mid, executive_summary="Lost overwrite")
    assert response.status_code == 409
    assert crud.get_meeting(mid).executive_summary == "Original summary"
    assert crud.get_meeting(mid).review_status == "reviewed"


def test_source_correction_invalidates_evidence_and_inflight_chat():
    client, mid = make_client(), meeting()
    crud.append_chat_messages(mid, [{"role": "assistant", "content": "Old answer"}])
    response = review(client, mid, raw_transcript="Corrected source")
    assert response.status_code == 200
    record = response.json()["meeting"]
    assert record["raw_transcript"] == "Corrected source"
    assert record["segments"] == [] and record["chat_history"] == []
    assert record["insights"] == {"decisions": [], "risks": [], "open_questions": []}
    assert record["review_status"] == "draft" and record["revision"] == 1
    assert not crud.append_chat_messages(mid, [{"role": "assistant", "content": "Late answer"}], expected_generation=0)


def test_segment_edit_preserves_metadata_and_defaults_decision_to_proposed():
    client, mid = make_client(), meeting()
    segments = [{"text": "Corrected", "speaker": "Bob", "start": 1, "end": 4, "timestamp": "[00:01 - 00:04]", "id": "turn-a"}]
    insights = {"decisions": [{"text": "Delay launch", "speaker": "Bob", "start": 1, "end": 4}]}
    response = review(client, mid, segments=segments, insights=insights)
    assert response.status_code == 200
    result = response.json()["meeting"]
    assert result["segments"] == segments
    assert result["raw_transcript"] == "[00:01 - 00:04] Bob: Corrected"
    assert result["insights"]["decisions"][0] == {**insights["decisions"][0], "status": "proposed"}


def test_summary_task_and_insight_changes_require_separate_review():
    client, mid = make_client(), meeting()
    assert review(client, mid).status_code == 200
    edited = review(client, mid, revision=1, executive_summary="Edited", action_items=[], insights={}).json()["meeting"]
    assert edited["review_status"] == "draft" and edited["revision"] == 2
    assert edited["action_items"] == []
    marked = review(client, mid, revision=2, executive_summary="Edited", action_items=[], insights={}).json()["meeting"]
    assert marked["review_status"] == "reviewed" and marked["revision"] == 3


@pytest.mark.parametrize("write", [
    lambda mid: crud.update_meeting(mid, executive_summary="Changed"),
    lambda mid: crud.update_action_item_status(mid, 0, "done"),
    lambda mid: crud.edit_meeting_speaker(mid, "Alice", "Bob"),
])
def test_existing_writers_invalidate_open_editor(write):
    client, mid = make_client(), meeting()
    assert review(client, mid).status_code == 200
    write(mid)
    record = crud.get_meeting(mid)
    assert record.revision == 2 and record.review_status == "draft"
    assert review(client, mid, revision=1).status_code == 409


def test_chat_changes_do_not_invalidate_content_revision():
    mid = meeting()
    crud.append_chat_messages(mid, [{"role": "user", "content": "Question"}])
    crud.clear_chat_history(mid)
    assert crud.get_meeting(mid).to_dict().get("revision") == 0


def test_legacy_raw_source_replacement_clears_stale_segments_and_answers():
    mid = meeting()
    crud.append_chat_messages(mid, [{"role": "assistant", "content": "Old answer"}])
    crud.update_meeting(mid, raw_transcript="Alice: Reject launch.")
    record = crud.get_meeting(mid)
    assert record.segments == []
    assert record.chat_history == []
    assert record.insights["decisions"] == []


@pytest.mark.parametrize("replacement", [
    "Bob: Approve launch.\nCarol: Review budget.",
    "Carol: Review budget.\nAlice: Approve launch.",
])
def test_legacy_attribution_or_turn_order_change_clears_stale_segments(replacement):
    mid = crud.create_meeting(
        filename="attribution.wav",
        raw_transcript="Alice: Approve launch.\nCarol: Review budget.",
        segments=[
            {"speaker": "Alice", "text": "Approve launch.", "start": 0, "end": 2},
            {"speaker": "Carol", "text": "Review budget.", "start": 2, "end": 4},
        ],
    )
    assert crud.update_meeting(mid, raw_transcript=replacement)
    record = crud.get_meeting(mid)
    assert record.raw_transcript == replacement
    assert record.segments == []


def test_task_unicode_search_filters_before_pagination_and_keeps_source_indices():
    client = make_client()
    old = crud.create_meeting(filename="old.wav", action_items=[{"task": "TÓM TẮT 50%_", "assignee": "ĐỨC", "status": "pending"}])
    new = crud.create_meeting(filename="new.wav", action_items=[{"task": "Other", "assignee": "Đức"}, {"task": "Tóm tắt 50%_", "assignee": "Đức", "status": "pending"}])
    for index in range(3):
        crud.create_meeting(filename=f"unrelated-{index}.wav", raw_transcript="Tóm tắt 50%_", action_items=[{"task": "Unrelated"}])
    response = client.get("/api/tasks", params={"q": "tóm tắt 50%_", "assignee": "đức", "status": "pending", "limit": 1})
    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 2 and page["has_more"] is True
    assert page["tasks"][0]["meeting_id"] == new and page["tasks"][0]["task_idx"] == 1
    assert page["tasks"][0]["revision"] == 0
    second = client.get("/api/tasks", params={"q": "TÓM TẮT 50%_", "limit": 1, "offset": 1}).json()
    assert second["tasks"][0]["meeting_id"] == old and second["has_more"] is False


def test_projects_assignment_duplicates_isolation_and_unassignment():
    client, first, second = make_client(), meeting(), meeting()
    response = client.post("/api/projects", json={"name": "  Dự Án  "})
    assert response.status_code == 200
    project = response.json()["project"]
    assert project["name"] == "Dự Án" and project["meeting_count"] == 0
    assert client.post("/api/projects", json={"name": "dỰ áN"}).status_code == 409
    assert review(client, first).status_code == 200
    assigned = client.patch(f"/api/meetings/{first}/project", json={"expected_revision": 1, "project_id": project["id"]})
    assert assigned.status_code == 200
    assert assigned.json()["meeting"]["review_status"] == "reviewed"
    assert assigned.json()["meeting"]["revision"] == 2
    assert client.get("/api/projects").json()["projects"][0]["meeting_count"] == 1
    assert [row["meeting_id"] for row in client.get("/api/tasks", params={"project_id": project["id"]}).json()["tasks"]] == [first]
    assert crud.get_meeting(second).project_id is None
    assert client.patch(f"/api/meetings/{first}/project", json={"expected_revision": 1, "project_id": None}).status_code == 409
    assert client.patch(f"/api/meetings/{first}/project", json={"expected_revision": 2, "project_id": 999}).status_code == 404
    assert crud.get_meeting(first).revision == 2
    assert client.patch(f"/api/meetings/{first}/project", json={"expected_revision": 2, "project_id": None}).status_code == 200
    assert client.get("/api/projects").json()["projects"][0]["meeting_count"] == 0


def test_project_name_limit_applies_after_trimming():
    response = make_client().post("/api/projects", json={"name": " " + "a" * 128 + " "})
    assert response.status_code == 200
    assert response.json()["project"]["name"] == "a" * 128


def test_nonfinite_extra_source_metadata_does_not_commit_invalid_json():
    client, mid = make_client(), meeting()
    response = client.patch(f"/api/meetings/{mid}/review", content=json.dumps({
        "expected_revision": 0, "review_status": "draft",
        "segments": [{"text": "Corrected", "confidence": float("nan")}],
    }), headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert crud.get_meeting(mid).revision == 0


def test_timeline_preserves_decision_history_and_source_metadata():
    client = make_client()
    project = client.post("/api/projects", json={"name": "Launch"})
    assert project.status_code == 200
    pid = project.json()["project"]["id"]
    first, second = meeting(), meeting()
    for mid, status in [(first, "superseded"), (second, "approved")]:
        assert review(client, mid, insights={"decisions": [{"text": "Launch", "status": status, "start": 1, "end": 4, "speaker": "Alice"}]}).status_code == 200
        assert client.patch(f"/api/meetings/{mid}/project", json={"expected_revision": 1, "project_id": pid}).status_code == 200
    page = client.get(f"/api/projects/{pid}/timeline", params={"limit": 1}).json()
    assert page["total"] == 2 and page["has_more"] is True
    entry = page["entries"][0]
    assert entry["meeting_id"] == second and entry["status"] == "approved"
    assert entry["start"] == 1 and entry["end"] == 4 and entry["speaker"] == "Alice"
    second_page = client.get(f"/api/projects/{pid}/timeline", params={"limit": 1, "offset": 1}).json()
    assert second_page["entries"][0]["status"] == "superseded"
    assert client.get("/api/projects/999/timeline").status_code == 404


def test_legacy_malformed_collections_do_not_break_workspace_pages():
    client, mid = make_client(), meeting()
    with db.get_connection() as connection:
        connection.execute("UPDATE meetings SET action_items=?, insights=? WHERE id=?", ('{"tasks":[null,"Legacy task",{"task":"Valid"}]}', '{"decisions":[null,"old",{"text":"Valid"}]}', mid))
    assert client.get("/api/tasks").status_code == 200
    assert [item["task"] for item in client.get("/api/tasks").json()["tasks"]] == ["Legacy task", "Valid"]


def test_summary_regeneration_preserves_source_and_other_extraction():
    calls = []
    def generate(source, **kwargs):
        calls.append((source, kwargs))
        return "  New summary  "
    client, mid = make_client(generate), meeting()
    response = client.post(f"/api/meetings/{mid}/regenerate-summary", json={"expected_revision": 0, "model": "test-model"})
    assert response.status_code == 200
    result = response.json()["meeting"]
    assert result["executive_summary"] == "New summary" and result["revision"] == 1
    assert result["raw_transcript"] == "Alice: Approve after review." and result["review_status"] == "draft"
    assert result["action_items"][0]["task"] == "Review launch"
    assert result["insights"]["decisions"][0]["text"] == "Launch"
    assert calls[0][0] == "Alice: Approve after review."
    assert calls[0][1]["model_name"] == "test-model" and calls[0][1]["language"] == "vi"


def test_regeneration_auto_resolution_uses_hardware_boolean():
    from workspace_api import create_workspace_router
    calls = []
    def resolve(model, has_gpu):
        calls.append((model, has_gpu))
        return "small-local-model"
    def generate(source, **kwargs):
        assert kwargs["has_gpu"] is False
        assert kwargs["model_name"] == "small-local-model"
        return "CPU summary"
    app = FastAPI()
    app.include_router(create_workspace_router(generate, model_resolver=resolve, hardware_detector=lambda: ("CPU Mode", False)))
    client, mid = TestClient(app), meeting()
    response = client.post(f"/api/meetings/{mid}/regenerate-summary", json={"expected_revision": 0})
    assert response.status_code == 200
    assert calls == [("auto", False)]


@pytest.mark.parametrize("output", ["", "   ", None, {"error": "failed"}])
def test_failed_summary_output_is_not_persisted(output):
    client, mid = make_client(lambda *a, **k: output), meeting()
    response = client.post(f"/api/meetings/{mid}/regenerate-summary", json={"expected_revision": 0})
    assert response.status_code == 503
    assert crud.get_meeting(mid).executive_summary == "Original summary"
    assert crud.get_meeting(mid).revision == 0


def test_concurrent_edit_during_generation_is_rejected():
    started, release = Event(), Event()
    def generate(*args, **kwargs):
        started.set()
        assert release.wait(5)
        return "Obsolete summary"
    client, mid = make_client(generate), meeting()
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(client.post, f"/api/meetings/{mid}/regenerate-summary", json={"expected_revision": 0})
        try:
            assert started.wait(5)
            crud.update_action_item_status(mid, 0, "completed")
        finally:
            release.set()
        assert future.result().status_code == 409
    assert crud.get_meeting(mid).executive_summary == "Original summary"
    assert crud.get_meeting(mid).action_items[0].status == "completed"


@pytest.mark.parametrize("changes", [
    {"raw_transcript": None}, {"segments": None}, {"action_items": None}, {"insights": None},
    {"raw_transcript": "x" * 1_000_001}, {"executive_summary": "x" * 50_001},
    {"segments": [{"text": "x" * 4001}]},
    {"action_items": [{"task": " "}]}, {"action_items": [{"task": "x", "status": "unknown"}]},
    {"segments": [{"text": "x", "start": float("inf")}]},
    {"insights": {"decisions": [{"text": "x", "status": "done"}]}},
])
def test_invalid_review_payload_leaves_record_unchanged(changes):
    client, mid = make_client(), meeting()
    # The test client JSON encoder rejects infinity before sending; use literal JSON for that case.
    response = client.patch(f"/api/meetings/{mid}/review", content=json.dumps({"expected_revision": 0, "review_status": "draft", **changes}), headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert crud.get_meeting(mid).revision == 0


@pytest.mark.parametrize("path", ["/api/tasks?limit=0", "/api/tasks?limit=101", "/api/tasks?offset=-1", "/api/tasks?status=unknown", "/api/projects/1/timeline?limit=0"])
def test_workspace_pagination_and_filters_are_bounded(path):
    assert make_client().get(path).status_code == 422
