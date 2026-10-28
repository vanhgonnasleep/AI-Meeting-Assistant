"""Cross-Meeting RAG Engine (Global Library Knowledge Synthesis).

Enables natural language querying across all saved meetings in the user's workspace
using SQLite FTS5 BM25 candidate filtering followed by cross-meeting segment ranking
and synthesized multi-meeting answers with provenance citations.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional
import requests

from database.db import get_connection
from database.crud import row_to_meeting
from database.models import MeetingRecord
from app.pipeline.mmr import MMRExtractor

logger = logging.getLogger("clarion.cross_meeting_rag")


def _sanitize_fts_query(query: str) -> str:
    """Prepares safe SQLite FTS5 query syntax from user natural language question."""
    words = re.findall(r'[\w]+', query)
    stopwords = MMRExtractor.DEFAULT_STOPWORDS | {
        "trong", "tất", "cả", "các", "cuộc", "họp", "buổi", "gì", "nào", "bao", "nhiêu",
        "all", "meeting", "meetings", "what", "where", "when", "how", "who", "which"
    }
    keywords = [w for w in words if len(w) > 1 and w.lower() not in stopwords]
    if not keywords:
        keywords = [w for w in words if len(w) > 1]
    if not keywords:
        return ""
    # Join with OR for recall, escape double quotes
    return " OR ".join(f'"{k}"' for k in keywords[:8])


def get_candidate_meetings(query: str, max_meetings: int = 5, project_id: Optional[int] = None) -> List[MeetingRecord]:
    """Finds top relevant meetings using SQLite FTS5 inverted index."""
    fts_query = _sanitize_fts_query(query)
    connection = get_connection()
    try:
        meeting_ids = []
        if fts_query:
            try:
                sql = "SELECT rowid FROM meetings_fts WHERE meetings_fts MATCH ? ORDER BY rank LIMIT ?"
                cursor = connection.execute(sql, (fts_query, max_meetings * 2))
                meeting_ids = [row[0] for row in cursor.fetchall()]
            except Exception as exc:
                logger.warning("FTS query failed (%s), falling back to recent meetings.", exc)

        # Fallback if no FTS match or query empty
        if not meeting_ids:
            cursor = connection.execute("SELECT id FROM meetings ORDER BY id DESC LIMIT ?", (max_meetings,))
            meeting_ids = [row[0] for row in cursor.fetchall()]

        if not meeting_ids:
            return []

        # Fetch full meeting records
        placeholders = ",".join("?" for _ in meeting_ids)
        rows = connection.execute(f"SELECT * FROM meetings WHERE id IN ({placeholders})", meeting_ids).fetchall()
        meetings = [row_to_meeting(r) for r in rows if r]
        return [m for m in meetings if m is not None]
    finally:
        connection.close()


def rank_cross_meeting_evidence(
    query: str,
    meetings: List[MeetingRecord],
    top_k: int = 6
) -> List[Dict[str, Any]]:
    """Ranks and extracts candidate evidence segments across multiple meetings."""
    query_tokens = set(re.findall(r'\w+', query.lower()))
    if not query_tokens:
        return []

    scored_chunks: List[Tuple[float, Dict[str, Any]]] = []

    for m in meetings:
        title = m.filename or f"Meeting #{m.id}"
        m_id = m.id
        created = str(m.created_at or "")[:10]

        # 1. Check segments
        for seg in (m.segments or []):
            text = str(seg.get("text", "")).strip()
            if not text:
                continue
            seg_tokens = set(re.findall(r'\w+', text.lower()))
            overlap = len(query_tokens & seg_tokens)
            if overlap > 0:
                score = overlap + (0.5 if any(len(tok) > 4 for tok in (query_tokens & seg_tokens)) else 0.0)
                scored_chunks.append((
                    score,
                    {
                        "meeting_id": m_id,
                        "meeting_title": title,
                        "created_at": created,
                        "speaker": seg.get("speaker", "Speaker"),
                        "timestamp": seg.get("timestamp", "00:00"),
                        "start": seg.get("start", 0.0),
                        "text": text
                    }
                ))

        # 2. Check summary bullets as fallback context
        if m.executive_summary:
            for line in m.executive_summary.split("\n"):
                clean = line.strip("-*• \t\r\n")
                if len(clean) < 15:
                    continue
                line_tokens = set(re.findall(r'\w+', clean.lower()))
                overlap = len(query_tokens & line_tokens)
                if overlap > 1:
                    scored_chunks.append((
                        overlap * 0.9,
                        {
                            "meeting_id": m_id,
                            "meeting_title": title,
                            "created_at": created,
                            "speaker": "Executive Summary",
                            "timestamp": "Summary",
                            "start": 0.0,
                            "text": clean
                        }
                    ))

    scored_chunks.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored_chunks[:top_k]]


def answer_global_library_question(
    question: str,
    model_name: str = "llama3",
    has_gpu: bool = False,
    language: str = "vi",
    project_id: Optional[int] = None,
    api_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Synthesizes answers across all meetings in the user's library with exact provenance.
    """
    meetings = get_candidate_meetings(question, max_meetings=6, project_id=project_id)
    if not meetings:
        return {
            "status": "success",
            "answer": "Chưa có cuộc họp nào trong thư viện phù hợp với câu hỏi của bạn." if language == "vi" else "No meetings found in your library matching this query.",
            "citations": [],
            "meetings_searched": 0,
            "mode": "empty_library"
        }

    evidence = rank_cross_meeting_evidence(question, meetings, top_k=6)
    if not evidence:
        return {
            "status": "success",
            "answer": f"Đã tìm kiếm qua {len(meetings)} cuộc họp nhưng không tìm thấy thông tin trả lời cho câu hỏi này." if language == "vi" else f"Searched across {len(meetings)} meetings, but found no matching information.",
            "citations": [],
            "meetings_searched": len(meetings),
            "mode": "no_match"
        }

    # Format grounded context
    context_lines = []
    for idx, e in enumerate(evidence, 1):
        context_lines.append(f"[{idx}] Cuộc họp: \"{e['meeting_title']}\" (ID: {e['meeting_id']}, Ngày: {e['created_at']}) | Người nói: {e['speaker']} | Giây: {e['timestamp']}:\n\"{e['text']}\"")
    context_str = "\n\n".join(context_lines)

    lang_req = "Trả lời bằng Tiếng Việt súc tích, khách quan, luôn ghi rõ tên cuộc họp và thời điểm tương ứng." if language == "vi" else "Answer clearly in English, citing the meeting name and timestamp."

    prompt = f"""Bạn là Trợ lý Tổng hợp Tri thức Đa Cuộc họp Clarion AI.
Nhiệm vụ: Trả lời câu hỏi của người dùng DỰA HOÀN TOÀN vào các đoạn trích từ các cuộc họp sau đây:

<context>
{context_str}
</context>

Câu hỏi của người dùng: "{question}"

Yêu cầu nghiêm ngặt:
1. {lang_req}
2. Ghi rõ trích dẫn từ cuộc họp nào (Ví dụ: Theo cuộc họp 'Kế hoạch Q3', ...).
3. Không bịa đặt hoặc suy diễn vượt quá các thông tin được cung cấp trong <context>.

Câu trả lời:"""

    answer_text = ""
    api_url = api_url or "http://localhost:11434/api/generate"
    try:
        resp = requests.post(
            api_url,
            json={"model": model_name, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}},
            timeout=25
        )
        if resp.status_code == 200:
            answer_text = resp.json().get("response", "").strip()
    except Exception as exc:
        logger.warning("LLM generation failed for global RAG (%s), using deterministic fallback.", exc)

    if not answer_text:
        # High-transparency deterministic synthesis fallback
        lines = [f"Dựa trên {len(meetings)} cuộc họp được rà soát trong thư viện:" if language == "vi" else f"Synthesized from {len(meetings)} library meetings:"]
        for e in evidence[:4]:
            lines.append(f"• Trong cuộc họp \"{e['meeting_title']}\" ({e['speaker']}, {e['timestamp']}): \"{e['text']}\"")
        answer_text = "\n".join(lines)

    return {
        "status": "success",
        "answer": answer_text,
        "citations": evidence,
        "meetings_searched": len(meetings),
        "mode": "cross_meeting_rag"
    }
