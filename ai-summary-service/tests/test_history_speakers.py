"""Persisted editing and bounded history regression tests."""
from fastapi.testclient import TestClient
import pytest

import main
import database.crud as crud

client = TestClient(main.app)


def create_segmented_meeting():
    return crud.create_meeting(
        filename="speaker-test.wav", raw_transcript="Speaker 1: Speaker 1 owns this item.",
        segments=[
            {"id": 0, "speaker": "Speaker 1", "text": "Speaker 1 owns this item.", "start": 1, "end": 3, "timestamp": "[00:01 - 00:03]"},
            {"id": 1, "speaker": "Speaker 2", "text": "I will review tomorrow.", "start": 3, "end": 5, "timestamp": "[00:03 - 00:05]"},
        ], insights={"decisions": [{"text": "Review tomorrow", "speaker": "Speaker 1", "start": 1}]},
    )


def test_speaker_rename_survives_reopen_without_replacing_spoken_text():
    mid = create_segmented_meeting()
    crud.append_chat_messages(mid, [{"role": "assistant", "content": "Speaker 1 owns this item.", "citations": [{"speaker": "Speaker 1", "start": 1}]}])
    response = client.patch(f"/api/meetings/{mid}/speakers", json={"old_name": "Speaker 1", "new_name": "Alice"})
    assert response.status_code == 200
    record = client.get(f"/api/meetings/{mid}").json()["meeting"]
    assert record["segments"][0]["speaker"] == "Alice"
    assert record["segments"][0]["text"] == "Speaker 1 owns this item."
    assert "Alice: Speaker 1 owns this item." in record["raw_transcript"]
    assert record["insights"]["decisions"][0]["speaker"] == "Alice"
    assert record["chat_history"][0]["citations"][0]["speaker"] == "Alice"
    assert record["chat_generation"] == 1  # Inflight answers carrying old labels cannot be appended.


def test_single_turn_correction_preserves_other_turns():
    mid = create_segmented_meeting()
    response = client.patch(f"/api/meetings/{mid}/speakers", json={"old_name": "Speaker 1", "new_name": "Speaker 2", "segment_index": 0})
    assert response.status_code == 200
    record = crud.get_meeting(mid)
    assert [s["speaker"] for s in record.segments] == ["Speaker 2", "Speaker 2"]


@pytest.mark.parametrize("payload", [
    {"old_name": "Speaker 1", "new_name": " "},
    {"old_name": "Speaker 1", "new_name": "x" * 129},
    {"old_name": "Speaker 1", "new_name": "Alice\nBob"},
    {"old_name": "Speaker 1", "new_name": "Alice", "segment_index": -1},
])
def test_invalid_speaker_edit_is_rejected(payload):
    assert client.patch(f"/api/meetings/{create_segmented_meeting()}/speakers", json=payload).status_code == 422


def test_unknown_speaker_does_not_change_record():
    mid = create_segmented_meeting()
    response = client.patch(f"/api/meetings/{mid}/speakers", json={"old_name": "Missing", "new_name": "Alice"})
    assert response.status_code == 404
    assert crud.get_meeting(mid).chat_generation == 0


def test_speaker_rename_preserves_manual_transcript_annotations():
    mid = create_segmented_meeting()
    crud.update_meeting(mid, raw_transcript="Speaker 1: Speaker 1 owns this item.\nManual annotation: approve only after review.")
    response = client.patch(f"/api/meetings/{mid}/speakers", json={"old_name": "Speaker 1", "new_name": "Alice"})
    assert response.status_code == 200
    assert crud.get_meeting(mid).raw_transcript == "Alice: Speaker 1 owns this item.\nManual annotation: approve only after review."


def test_history_paginates_without_shipping_transcripts():
    ids = [crud.create_meeting(filename=f"meeting-{i}.wav", raw_transcript="private transcript " * 2000,
                               action_items=[{"task": "Review", "status": "completed"}]) for i in range(5)]
    first = client.get("/api/meetings?compact=true&limit=2&offset=0").json()
    second = client.get("/api/meetings?compact=true&limit=2&offset=2").json()
    assert first["total"] == 5 and first["count"] == 2
    assert [r["id"] for r in first["meetings"]] == ids[::-1][:2]
    assert [r["id"] for r in second["meetings"]] == ids[::-1][2:4]
    assert first["has_more"] is True
    assert "raw_transcript" not in first["meetings"][0]
    assert "segments" not in first["meetings"][0]
    assert first["meetings"][0]["action_item_count"] == 1


def test_history_search_is_global_and_escapes_wildcards():
    crud.create_meeting(filename="match.wav", raw_transcript="Literal 50% increase")
    for i in range(4):
        crud.create_meeting(filename=f"newer-{i}.wav", raw_transcript="Other material")
    result = client.get("/api/meetings?compact=true&limit=2&q=50%25").json()
    assert result["total"] == 1
    assert result["meetings"][0]["filename"] == "match.wav"


def test_history_search_is_case_insensitive_for_vietnamese():
    crud.create_meeting(filename="Tiếng Việt.wav", raw_transcript="Tóm tắt cuộc họp và ngân sách.")
    assert client.get("/api/meetings", params={"q": "TÓM TẮT", "compact": True}).json()["total"] == 1


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1"])
def test_history_page_parameters_are_bounded(query):
    assert client.get(f"/api/meetings?{query}").status_code == 422


def test_analytics_does_not_load_full_meeting_records(monkeypatch):
    crud.create_meeting(filename="analytics.wav", raw_transcript="x" * 100_000, duration=60, language="vi",
                        action_items=[{"task": "Review", "status": "done"}, {"task": "Ship", "status": "pending"}])
    monkeypatch.setattr(crud, "get_all_meetings", lambda *a, **k: pytest.fail("Analytics must not load transcripts"))
    result = crud.get_analytics_summary()
    assert result["total_meetings"] == 1 and result["total_duration_seconds"] == 60
    assert result["completed_action_items"] == 1 and result["completion_rate_percent"] == 50
    assert result["detected_languages"] == ["vi"]


def test_legacy_segment_and_chat_items_are_normalized_before_detail_and_edit():
    import json
    from database.db import get_connection
    mid = create_segmented_meeting()
    connection = get_connection()
    try:
        connection.execute("UPDATE meetings SET segments=?, chat_history=? WHERE id=?", (
            json.dumps([None, {"speaker": "Speaker 1", "text": 42, "start": 1, "end": 2}]),
            json.dumps([None, "old message", {"role": "assistant", "content": 7, "citations": [None, {"speaker": "Speaker 1", "start": 1}]}]), mid,
        ))
        connection.commit()
    finally:
        connection.close()
    detail = client.get(f"/api/meetings/{mid}").json()["meeting"]
    assert len(detail["segments"]) == 1 and detail["segments"][0]["text"] == "42"
    assert len(detail["chat_history"]) == 1 and detail["chat_history"][0]["content"] == "7"
    response = client.patch(f"/api/meetings/{mid}/speakers", json={"old_name": "Speaker 1", "new_name": "Alice"})
    assert response.status_code == 200
