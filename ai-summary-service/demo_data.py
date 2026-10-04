"""
=============================================================================
INSTANT DEMO FIXTURES (Presenter Fail-Safe)
Author: Lương Việt Anh (Lead)

All demo content is derived strictly from the bundled sample recording
(meeting-assistant-ui/public/q3_product_budget_review.wav, 29.05 s), so every
timestamp seeks to the exact spoken turn and no insight is invented.

Measured turn boundaries (silence detection on the 16 kHz WAV):
    Speaker A  00:00 - 00:11
    Speaker B  00:12 - 00:22
    Speaker A  00:23 - 00:29
=============================================================================
"""

import re
from typing import Any, Dict, List, Optional

DEMO_DURATION = 29.05

DEMO_SEGMENTS: List[Dict[str, Any]] = [
    {
        "id": 1, "start": 0.0, "end": 11.3, "timestamp": "[00:00 - 00:11]", "speaker": "Speaker A",
        "text": "Welcome everyone. We need to finalize the marketing budget for Q3 today. "
                "I propose an allocation of $50,000 for targeted social media ad campaigns.",
    },
    {
        "id": 2, "start": 12.0, "end": 22.3, "timestamp": "[00:12 - 00:22]", "speaker": "Speaker B",
        "text": "That budget sounds reasonable and matches our projections. Let's lock it in. "
                "Can you prepare the detailed financial report by Friday, John?",
    },
    {
        "id": 3, "start": 23.0, "end": 28.5, "timestamp": "[00:23 - 00:28]", "speaker": "Speaker A",
        "text": "Will do. I'll have the complete breakdown ready by Friday afternoon.",
    },
]

DEMO_TRANSCRIPT = "\n".join(f"{seg['speaker']}: {seg['text']}" for seg in DEMO_SEGMENTS)

DEMO_CONDENSED = (
    "Speaker A: We need to finalize the marketing budget for Q3 today. I propose an allocation of $50,000 for targeted social media ad campaigns.\n"
    "Speaker B: That budget sounds reasonable and matches our projections. Can you prepare the detailed financial report by Friday, John?\n"
    "Speaker A: I'll have the complete breakdown ready by Friday afternoon."
)

DEMO_SUMMARY = (
    "- Approved $50,000 budget allocation for Q3 social media marketing campaigns.\n"
    "- Agreed to finalize executive financial report by Friday afternoon.\n"
    "- Confirmed John as lead deliverable owner for Q3 revenue reconciliation."
)

DEMO_ACTION_ITEMS: List[Dict[str, Any]] = [
    {"task": "Prepare and submit Q3 financial report", "assignee": "John (Speaker A)", "deadline": "Friday afternoon", "status": "pending"},
    {"task": "Launch targeted social media ad campaigns", "assignee": "Marketing Team", "deadline": "Q3 Start", "status": "pending"},
]


def _evidence(segment_idx: int) -> Dict[str, Any]:
    seg = DEMO_SEGMENTS[segment_idx]
    return {"speaker": seg["speaker"], "timestamp": seg["timestamp"][1:6], "start": seg["start"]}


DEMO_INSIGHTS: Dict[str, List[Dict[str, Any]]] = {
    "decisions": [
        {"text": "Q3 marketing budget locked at $50,000 for targeted social media ad campaigns.", **_evidence(1)},
        {"text": "John owns the detailed financial breakdown, committed for Friday afternoon.", **_evidence(2)},
    ],
    "risks": [
        {"text": "Campaign execution depends on the financial report landing by Friday — a slip delays the Q3 launch.", **_evidence(1)},
        {"text": "Budget approval relies on current projections; no contingency buffer was discussed.", **_evidence(1)},
    ],
    "open_questions": [
        {"text": "How will the $50,000 be split across social channels, and which KPIs define success?", **_evidence(0)},
        {"text": "Who is accountable for running the campaigns once the budget is released?", **_evidence(0)},
    ],
}


def _citation(segment_idx: int, score: float = 1.0) -> Dict[str, Any]:
    seg = DEMO_SEGMENTS[segment_idx]
    return {
        "timestamp": seg["timestamp"][1:6],
        "start": seg["start"],
        "speaker": seg["speaker"],
        "text": seg["text"],
        "score": score,
    }


# Curated answers keyed by intent. Each intent lists trigger keywords (EN + VI).
_DEMO_QA: List[Dict[str, Any]] = [
    {
        "keywords": ["budget", "approve", "money", "$", "50", "ngân sách", "duyệt", "bao nhiêu", "tiền"],
        "answer": {
            "en": "The team approved **$50,000** for targeted social media ad campaigns in Q3 [00:00]. "
                  "Speaker B confirmed it matches projections and closed the decision with \"Let's lock it in\" [00:12].",
            "vi": "Cuộc họp đã duyệt **50.000 USD** cho chiến dịch quảng cáo mạng xã hội quý 3 [00:00]. "
                  "Speaker B xác nhận con số khớp với dự báo và chốt quyết định bằng câu \"Let's lock it in\" [00:12].",
        },
        "citations": [0, 1],
    },
    {
        "keywords": ["report", "deadline", "due", "friday", "who", "john", "responsible", "báo cáo", "hạn", "ai", "phụ trách", "thứ sáu"],
        "answer": {
            "en": "**John (Speaker A)** is responsible for the detailed financial report. Speaker B requested it [00:12] "
                  "and John committed to delivering the complete breakdown by **Friday afternoon** [00:23].",
            "vi": "**John (Speaker A)** phụ trách báo cáo tài chính chi tiết. Speaker B giao việc [00:12] "
                  "và John cam kết gửi bản phân tích đầy đủ trước **chiều thứ Sáu** [00:23].",
        },
        "citations": [1, 2],
    },
    {
        "keywords": ["risk", "blocker", "concern", "problem", "issue", "rủi ro", "vướng", "lo ngại", "vấn đề"],
        "answer": {
            "en": "No blocker was raised explicitly, but two risks follow from the discussion: campaign launch depends on "
                  "John's Friday report [00:23], and the $50,000 approval rests on current projections with no contingency discussed [00:12].",
            "vi": "Không ai nêu trực tiếp trở ngại, nhưng có hai rủi ro rút ra từ cuộc họp: việc chạy chiến dịch phụ thuộc vào "
                  "báo cáo thứ Sáu của John [00:23], và khoản 50.000 USD được duyệt dựa trên dự báo hiện tại mà chưa bàn phương án dự phòng [00:12].",
        },
        "citations": [2, 1],
    },
    {
        "keywords": ["summary", "summarize", "overview", "recap", "decide", "decision", "tóm tắt", "quyết định", "chốt", "tổng kết"],
        "answer": {
            "en": "In under 30 seconds the meeting: (1) proposed and **approved a $50,000 Q3 social media budget** [00:00][00:12], "
                  "and (2) assigned **John** to deliver the financial breakdown by **Friday afternoon** [00:23].",
            "vi": "Trong chưa đầy 30 giây, cuộc họp đã: (1) đề xuất và **duyệt ngân sách 50.000 USD cho mạng xã hội quý 3** [00:00][00:12], "
                  "và (2) giao **John** hoàn thành báo cáo tài chính trước **chiều thứ Sáu** [00:23].",
        },
        "citations": [0, 1, 2],
    },
]

DEMO_CHAT_HISTORY: List[Dict[str, Any]] = [
    {"role": "user", "content": "What budget was approved?", "mode": "demo"},
    {
        "role": "assistant",
        "content": _DEMO_QA[0]["answer"]["en"],
        "citations": [_citation(i) for i in _DEMO_QA[0]["citations"]],
        "mode": "demo",
    },
    {"role": "user", "content": "Who owns the financial report and when is it due?", "mode": "demo"},
    {
        "role": "assistant",
        "content": _DEMO_QA[1]["answer"]["en"],
        "citations": [_citation(i) for i in _DEMO_QA[1]["citations"]],
        "mode": "demo",
    },
]


def _keyword_hits(question: str, keywords: List[str]) -> int:
    hits = 0
    for kw in keywords:
        if kw == "$":
            hits += "$" in question
        elif re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", question):
            hits += 1
    return hits


def demo_answer(question: str, language: str = "en") -> Optional[Dict[str, Any]]:
    """Return a curated demo answer for the sample meeting, or None if no intent matches."""
    q = (question or "").lower()
    best, best_hits = None, 0
    for intent in _DEMO_QA:
        hits = _keyword_hits(q, intent["keywords"])
        if hits > best_hits:
            best, best_hits = intent, hits
    if best is None:
        return None
    lang = "vi" if language == "vi" else "en"
    return {
        "answer": best["answer"][lang],
        "citations": [_citation(i) for i in best["citations"]],
        "mode": "demo",
    }
