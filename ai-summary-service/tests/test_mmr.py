import sys
from pathlib import Path
import pytest

SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from mmr_extractor import MMRExtractor, filter_meeting_transcript


def test_cosine_similarity_orthogonal_and_identical():
    """Verify sparse cosine similarity boundary conditions (0.0 for disjoint, 1.0 for identical)."""
    extractor = MMRExtractor()
    vec1 = {"budget": 1.0, "marketing": 0.5}
    vec2 = {"budget": 1.0, "marketing": 0.5}
    vec3 = {"engineering": 2.0, "server": 1.0}

    sim_identical = extractor._cosine_similarity(vec1, vec2)
    assert pytest.approx(sim_identical, 0.001) == 1.0

    sim_orthogonal = extractor._cosine_similarity(vec1, vec3)
    assert sim_orthogonal == 0.0

    sim_empty = extractor._cosine_similarity(vec1, {})
    assert sim_empty == 0.0


def test_short_transcript_passthrough():
    """Verify that compact transcripts (< 150 words) are returned untouched."""
    short_text = "Speaker A: Hello team. Let's start the call. Speaker B: Yes, let's begin."
    filtered, telemetry = filter_meeting_transcript(short_text)
    assert filtered == short_text
    assert telemetry["applied"] is False
    assert telemetry["reduction_percent"] == 0.0


def test_mmr_redundancy_elimination():
    """
    Verify that MMR removes conversational filler and duplicate repetitive phrases
    while preserving key strategic decisions.
    """
    redundant_transcript = (
        "Speaker A: Good morning everyone, can you hear me okay? Yes, loud and clear.\n"
        "Speaker B: Yeah, I hear you, um, perfectly fine. Great to be here today.\n"
        "Speaker A: As we discussed last week, our primary goal today is to approve the $50,000 Q3 budget.\n"
        "Speaker B: So yeah, the budget is really important. We really need to approve the budget.\n"
        "Speaker B: Approving the budget is our main thing today, like I said.\n"
        "Speaker A: John will lead the marketing campaign execution starting next Monday.\n"
        "Speaker B: Exactly, so the budget is 50k and we should approve it.\n"
        "Speaker A: Alice will prepare the compliance and audit checklist by Thursday afternoon.\n"
        "Speaker B: Yeah, totally agree on the audit checklist, Alice sounds good.\n"
        "Speaker A: Thanks everyone for joining today's meeting. Have a great afternoon."
    )

    extractor = MMRExtractor(lambda_param=0.65)
    filtered, telemetry = extractor.extract_key_sentences(redundant_transcript, target_ratio=0.5)

    assert telemetry["applied"] is True
    assert telemetry["filtered_words"] < telemetry["original_words"]
    assert telemetry["reduction_percent"] > 20.0
    assert "budget" in filtered.lower()
    assert "Alice will prepare the compliance and audit checklist" in filtered


def test_mmr_vietnamese_transcript():
    """Verify that MMR tokenization properly supports Vietnamese accented characters and removes redundancy."""
    vietnamese_transcript = (
        "Người nói A: Xin chào mọi người, hôm nay chúng ta họp về tiến độ dự án AI Meeting Assistant.\n"
        "Người nói B: Tôi đã hoàn thành module trích xuất văn bản từ âm thanh bằng Whisper.\n"
        "Người nói A: Rất tốt, chúng ta cần hoàn thành báo cáo ngân sách dự án trước thứ sáu.\n"
        "Người nói B: Báo cáo ngân sách dự án rất quan trọng, tôi đồng ý với ngân sách này.\n"
        "Người nói C: Tôi sẽ hỗ trợ kiểm thử giao diện React và tích hợp SQLite vào thứ năm.\n"
        "Người nói B: Vâng, ngân sách dự án và báo cáo cần được duyệt sớm như đã nói.\n"
        "Người nói A: Cảm ơn mọi người, buổi họp kết thúc tại đây."
    )
    extractor = MMRExtractor(lambda_param=0.65)
    filtered, telemetry = extractor.extract_key_sentences(vietnamese_transcript, target_ratio=0.6)

    assert telemetry["applied"] is True
    assert telemetry["filtered_words"] < telemetry["original_words"]
    assert "Whisper" in filtered
    assert "ngân sách" in filtered.lower()

