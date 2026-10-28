import pytest
from database.models import MeetingRecord
from app.pipeline.cross_meeting_rag import rank_cross_meeting_evidence, _sanitize_fts_query


def test_sanitize_fts_query():
    q = "Trong tất cả các cuộc họp quý 3, ngân sách dự án X là bao nhiêu?"
    fts = _sanitize_fts_query(q)
    assert "ngân" in fts
    assert "sách" in fts
    assert "OR" in fts


def test_rank_cross_meeting_evidence():
    m1 = MeetingRecord(
        filename="Q2_Review.mp3",
        id=1,
        created_at="2026-06-15",
        segments=[
            {"id": 0, "speaker": "Alex", "timestamp": "02:15", "start": 135.0, "text": "Dự án Alpha hoàn thành tốt."},
            {"id": 1, "speaker": "Sarah", "timestamp": "05:40", "start": 340.0, "text": "Ngân sách ban đầu là 10 ngàn đô."}
        ]
    )
    m2 = MeetingRecord(
        filename="Q3_Budget_Planning.mp3",
        id=2,
        created_at="2026-09-01",
        segments=[
            {"id": 0, "speaker": "Bob", "timestamp": "01:10", "start": 70.0, "text": "Hôm nay chúng ta bàn về ngân sách dự án Alpha."},
            {"id": 1, "speaker": "Alex", "timestamp": "04:30", "start": 270.0, "text": "Chúng tôi chốt tăng ngân sách Alpha lên 25 ngàn đô."}
        ]
    )

    evidence = rank_cross_meeting_evidence("ngân sách dự án Alpha", [m1, m2], top_k=3)
    assert len(evidence) >= 2
    # The segment in m2 with both 'ngân sách' and 'Alpha' should rank near top
    assert any(e["meeting_id"] == 2 for e in evidence)
    assert any("25 ngàn đô" in e["text"] for e in evidence)
