"""
=============================================================================
MEETING INTELLIGENCE & GOVERNANCE: KEY DECISIONS, RISKS & OPEN QUESTIONS
Author: Lương Việt Anh (Lead AI & Orchestration)

Extracts structured organizational intelligence from meeting context:
  1. Key Decisions (Strategic consensus, budget approvals, architecture choices)
  2. Risks & Blockers (Dependencies, delivery bottlenecks, unresolved hazards)
  3. Open Questions (Unanswered inquiries, pending executive guidance)

Provides both:
  - High-precision LLM extraction via Ollama (Llama 3 structured JSON)
  - 100% offline deterministic rule-based heuristic extractor for fail-safe resilience
=============================================================================
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple
import requests

from mmr_extractor import MMRExtractor


def _match_segment_evidence(text: str, segments: Optional[List[Dict[str, Any]]]) -> Tuple[Optional[str], Optional[str], Optional[float]]:
    """
    Finds the best matching transcript segment for a given insight text.
    Returns (speaker, timestamp_str, start_seconds).
    """
    if not segments:
        return None, None, None

    text_words = set(re.findall(r'\w+', text.lower()))
    if not text_words:
        return None, None, None

    best_seg = None
    best_overlap = 0

    for seg in segments:
        seg_words = set(re.findall(r'\w+', str(seg.get("text", "")).lower()))
        overlap = len(text_words & seg_words)
        if overlap > best_overlap:
            best_overlap = overlap
            best_seg = seg

    if best_seg and best_overlap >= 2:
        speaker = best_seg.get("speaker")
        ts = best_seg.get("timestamp")
        # Extract [MM:SS] format
        clean_ts = None
        if ts:
            m = re.search(r'(\d{2}:\d{2})', str(ts))
            if m:
                clean_ts = m.group(1)
            else:
                clean_ts = str(ts)
        start = best_seg.get("start")
        return speaker, clean_ts, start

    return None, None, None


def extract_insights_heuristic(
    transcript: str,
    summary: Optional[str] = None,
    segments: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Deterministic rule-based fallback extractor for meeting intelligence.
    Scans transcript and summary using linguistic patterns in English & Vietnamese.
    Guarantees no crash and returns valid {decisions, risks, open_questions}.
    """
    decisions: List[Dict[str, Any]] = []
    risks: List[Dict[str, Any]] = []
    open_questions: List[Dict[str, Any]] = []

    if not transcript or not transcript.strip():
        return {"decisions": [], "risks": [], "open_questions": []}

    # Split transcript into sentences
    sentences = MMRExtractor.split_into_sentences(transcript)
    if summary:
        summary_sentences = [s.strip("- *• \t\r\n") for s in summary.split("\n") if len(s.strip("- *• \t\r\n")) >= 10]
        sentences = summary_sentences + sentences

    # Pattern definitions (bilingual EN + VI)
    decision_keywords = [
        r'\b(?:approved|agreed|decided|finalize|locked in|confirmed|settled|concluded|adopted|resolved)\b',
        r'\b(?:thống nhất|quyết định|phê duyệt|chốt|đồng ý|thông qua|cam kết|lựa chọn|kế hoạch)\b',
        r'\b(?:we will|we shall|allocation of|budget of)\b',
        r'\b(?:let\'s lock it in|propose an allocation)\b'
    ]

    risk_keywords = [
        r'\b(?:risk|blocker|concern|hazard|threat|delay|bottleneck|vulnerability|uncertainty|contingency|slip)\b',
        r'\b(?:depends on|reliant on|contingent on|without|cannot|unable to|tight deadline)\b',
        r'\b(?:rủi ro|nguy cơ|trễ hạn|chậm tiến độ|vướng mắc|trở ngại|lo ngại|phụ thuộc|nghẽn|khó khăn)\b',
        r'\b(?:thiếu nhân sự|chưa kịp|quá tải)\b'
    ]

    question_keywords = [
        r'\?',
        r'\b(?:how|what|who|when|where|why|which|can you|could you|should we)\b.*\?',
        r'\b(?:tại sao|như thế nào|ai sẽ|khi nào|ở đâu|liệu có|bao giờ|phải không|chưa rõ|cần làm rõ)\b'
    ]

    seen_texts = set()

    for sentence in sentences:
        s = sentence.strip()
        if len(s) < 12 or s.lower() in seen_texts:
            continue

        clean_lower = s.lower()

        # 1. Check open questions
        is_question = any(re.search(pat, s, re.IGNORECASE) for pat in question_keywords)
        if is_question and len(open_questions) < 4:
            seen_texts.add(clean_lower)
            spk, ts, start = _match_segment_evidence(s, segments)
            item = {"text": s}
            if spk: item["speaker"] = spk
            if ts: item["timestamp"] = ts
            if start is not None: item["start"] = start
            open_questions.append(item)
            continue

        # 2. Check risks & blockers
        is_risk = any(re.search(pat, s, re.IGNORECASE) for pat in risk_keywords)
        if is_risk and len(risks) < 4:
            seen_texts.add(clean_lower)
            spk, ts, start = _match_segment_evidence(s, segments)
            item = {"text": s}
            if spk: item["speaker"] = spk
            if ts: item["timestamp"] = ts
            if start is not None: item["start"] = start
            risks.append(item)
            continue

        # 3. Check decisions
        is_decision = any(re.search(pat, s, re.IGNORECASE) for pat in decision_keywords)
        if is_decision and len(decisions) < 5:
            seen_texts.add(clean_lower)
            spk, ts, start = _match_segment_evidence(s, segments)
            item = {"text": s}
            if spk: item["speaker"] = spk
            if ts: item["timestamp"] = ts
            if start is not None: item["start"] = start
            decisions.append(item)

    # If transcript mentions budget/commitments, guarantee at least 1 decision/risk if available
    if not decisions and summary:
        first_sum_line = summary.split("\n")[0].strip("- *• ")
        if first_sum_line:
            decisions.append({"text": first_sum_line})

    return {
        "decisions": decisions,
        "risks": risks,
        "open_questions": open_questions
    }


def extract_insights(
    transcript: str,
    summary: Optional[str] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    model_name: str = "llama3",
    has_gpu: bool = False,
    language: str = "en",
    timeout_sec: int = 25
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Extracts meeting intelligence (decisions, risks, open questions) using Ollama LLM,
    with automatic fallback to deterministic heuristic analysis on failure or timeout.
    """
    if not transcript or not transcript.strip():
        return {"decisions": [], "risks": [], "open_questions": []}

    lang_inst = "Use professional Vietnamese for all descriptions." if language == "vi" else "Use clear professional English."

    system_prompt = f"""You are a Strategic Executive Secretary extracting key meeting governance items.
Analyze the provided meeting content and return ONLY a valid JSON object with EXACTLY three array keys:
1. "decisions": Array of objects [{{"text": "concise description of finalized decision or commitment"}}]
2. "risks": Array of objects [{{"text": "identified project risk, technical blocker, or delivery hazard"}}]
3. "open_questions": Array of objects [{{"text": "unresolved issue, question, or topic pending clarification"}}]

Rules:
- Strictly return valid JSON. Do NOT include markdown code blocks, backticks, or conversational text.
- Be objective and factual. Base findings strictly on the meeting discussion.
- Limit to top 2-4 items per category.
- {lang_inst}
Example:
{{"decisions": [{{"text": "Approved $50,000 for Q3 marketing"}}], "risks": [{{"text": "Delay in report submission"}}], "open_questions": [{{"text": "Which channels will be prioritized?"}}]}}"""

    # Prepare context excerpt (keep concise for fast edge processing)
    words = transcript.split()
    context_sample = " ".join(words[:1200])
    if summary:
        user_prompt = f"Executive Summary:\n{summary}\n\nTranscript Excerpt:\n{context_sample}"
    else:
        user_prompt = f"Transcript:\n{context_sample}"

    try:
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "num_ctx": 4096 if has_gpu else 2048,
                    "num_predict": 512
                }
            },
            timeout=timeout_sec
        )
        response.raise_for_status()
        raw_content = response.json().get("message", {}).get("content", "").strip()

        # Extract JSON object boundary
        start = raw_content.find("{")
        end = raw_content.rfind("}")
        if start != -1 and end != -1 and end > start:
            clean_json = raw_content[start:end+1]
            data = json.loads(clean_json)

            def sanitize_list(lst: Any) -> List[Dict[str, Any]]:
                out = []
                if isinstance(lst, list):
                    for item in lst:
                        if isinstance(item, dict) and item.get("text"):
                            txt = str(item["text"]).strip()
                            spk, ts, start_sec = _match_segment_evidence(txt, segments)
                            entry: Dict[str, Any] = {"text": txt}
                            if spk: entry["speaker"] = spk
                            if ts: entry["timestamp"] = ts
                            if start_sec is not None: entry["start"] = start_sec
                            out.append(entry)
                        elif isinstance(item, str) and item.strip():
                            txt = item.strip()
                            spk, ts, start_sec = _match_segment_evidence(txt, segments)
                            entry = {"text": txt}
                            if spk: entry["speaker"] = spk
                            if ts: entry["timestamp"] = ts
                            if start_sec is not None: entry["start"] = start_sec
                            out.append(entry)
                return out

            decisions = sanitize_list(data.get("decisions"))
            risks = sanitize_list(data.get("risks"))
            open_questions = sanitize_list(data.get("open_questions"))

            if decisions or risks or open_questions:
                return {
                    "decisions": decisions,
                    "risks": risks,
                    "open_questions": open_questions
                }
    except Exception as e:
        print(f"[MeetingInsights] LLM extraction error ({e}). Falling back to heuristic extractor.")

    # Fallback to deterministic heuristic
    return extract_insights_heuristic(transcript, summary, segments)
