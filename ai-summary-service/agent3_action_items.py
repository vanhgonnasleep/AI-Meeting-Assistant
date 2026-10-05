"""
=====================================================
AGENT 3: ACTION ITEMS EXTRACTION
Owner: Nguyễn Quang Minh (Agent 3)
Task: Design specialized prompt for Llama 3 to extract
      actionable tasks and assignees in standardized JSON format.
=====================================================
"""

import json
import os
import re
from typing import List, Dict, Optional, Any
try:
    import ollama
    OLLAMA_LIB_AVAILABLE = True
except ImportError:
    ollama = None
    OLLAMA_LIB_AVAILABLE = False

import requests



def extract_action_items_heuristic(transcript: str) -> List[Dict[str, Any]]:
    """
    Deterministic rule-based fallback extractor for action items.
    Used when Ollama is offline or times out, ensuring the pipeline never fails to find deliverables.
    Scans for commitment verbs and assignee markers.
    """
    if not transcript or not transcript.strip():
        return []

    commit_patterns = [
        (re.compile(r'\b([A-Z][a-z]+)\s+(?:will|shall|agreed to|is going to)\s+([^.?!;:\n]{10,})', re.IGNORECASE), 1, 2),
        (re.compile(r'\b([A-Z][a-z]+)\s+(?:needs to|must|should)\s+([^.?!;:\n]{10,})', re.IGNORECASE), 1, 2),
        (re.compile(r'(?:Can you|Please)\s+([^.?!;:\n]+),\s*([A-Z][a-z]+)\?', re.IGNORECASE), 2, 1),
        (re.compile(r'Confirmed\s+([A-Z][a-z]+)\s+as\s+lead\s+deliverable\s+owner\s+for\s+([^.?!;:\n]+)', re.IGNORECASE), 1, 2),
    ]

    items: List[Dict[str, Any]] = []
    lines = re.split(r'[.?!]\s+|\n+', transcript)

    for line in lines:
        line_str = line.strip()
        if not line_str or len(line_str) < 15:
            continue

        for pat, assignee_group, task_group in commit_patterns:
            m = pat.search(line_str)
            if m:
                assignee = m.group(assignee_group).strip()
                raw_task = m.group(task_group).strip()

                # Look for deadline phrases (e.g. by Friday, by tomorrow)
                deadline = None
                dl_match = re.search(r'\b(?:by|before|until)\s+([A-Za-z0-9\s]+?)(?:\s*$|\.|\,)', raw_task, re.IGNORECASE)
                if dl_match:
                    deadline = dl_match.group(1).strip()

                items.append({
                    "task": raw_task,
                    "assignee": assignee if assignee else "Unassigned",
                    "deadline": deadline,
                    "status": "pending"
                })
                break

    # Deduplicate by task
    seen = set()
    deduped = []
    for it in items:
        k = it["task"].lower()
        if k not in seen:
            seen.add(k)
            deduped.append(it)

    return deduped


def extract_action_items(transcript: str, model_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Receives raw meeting transcript and extracts actionable work items.
    
    Args:
        transcript (str): Raw meeting transcript text.
        model_name (str, optional): Target Ollama model name. Defaults to 'llama3'.
        
    Returns:
        List[Dict[str, Any]]: Action items in standardized JSON format:
            [
                {"task": "Prepare Q3 financial report", "assignee": "John", "deadline": "Friday", "status": "pending"},
                ...
            ]
    """
    if not transcript or not transcript.strip():
        return []

    target_model = model_name or os.getenv("OLLAMA_MODEL", "llama3")

    # 1. System prompt forcing strict JSON array output format with deadline and status
    system_prompt = (
        "You are an AI assistant that extracts actionable work items from meeting transcripts.\n"
        "You MUST respond ONLY with a valid JSON ARRAY of objects enclosed in square brackets [].\n"
        "Do NOT return a single object, do NOT include markdown formatting or extra conversational text.\n"
        "Each object in the array must contain:\n"
        "- 'task': A concise, actionable description of the task (string)\n"
        "- 'assignee': The designated owner or team, or 'Unassigned' if unspecified (string)\n"
        "- 'deadline': Delivery deadline mentioned (e.g., 'Friday afternoon', 'tomorrow') or null (string/null)\n"
        "- 'status': Current execution status ('pending' or 'completed')\n"
        "Example:\n"
        '[{"task": "Update database schema", "assignee": "John", "deadline": "Friday", "status": "pending"}]'
    )

    # Guard against context window overflow on long transcripts
    words = transcript.split()
    if len(words) > 2000:
        clean_transcript = " ".join(words[:1200]) + "\n\n... [discussion continues] ...\n\n" + " ".join(words[-800:])
    else:
        clean_transcript = transcript

    try:
        # 2. Query local Llama 3 via Ollama package or direct HTTP fallback
        if OLLAMA_LIB_AVAILABLE and ollama is not None:
            with ollama.Client(timeout=35) as client:
                response = client.chat(
                    model=target_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Extract action items from this transcript:\n{clean_transcript}"}
                    ],
                    format="json"
                )
            # Support both Ollama SDK object (response.message.content) and dict (response['message']['content'])
            msg = response.message if hasattr(response, 'message') else response.get('message', {})
            raw_content = (msg.content if hasattr(msg, 'content') else msg.get('content', '')).strip()
        else:
            http_res = requests.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": target_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Extract action items from this transcript:\n{clean_transcript}"}
                    ],
                    "format": "json",
                    "stream": False
                },
                timeout=35
            )
            http_res.raise_for_status()
            raw_content = http_res.json().get("message", {}).get("content", "").strip()

        # 3. Robust JSON array extraction: scan for outermost '[' ... ']' boundary
        def extract_first_json_array(text: str) -> str:
            start = text.find('[')
            if start == -1:
                return text  # no array found, try to parse the whole thing
            depth = 0
            quote = None
            escaped = False
            for i, ch in enumerate(text[start:], start=start):
                if quote:
                    if escaped:
                        escaped = False
                    elif ch == '\\':
                        escaped = True
                    elif ch == quote:
                        quote = None
                    continue
                if ch in ('"', "'"):
                    quote = ch
                    continue
                if ch == '[':
                    depth += 1
                elif ch == ']':
                    depth -= 1
                    if depth == 0:
                        return text[start:i + 1]
            return text[start:]

        clean_json_str = extract_first_json_array(raw_content)

        # 4. Sanitize trailing commas before closing brackets/braces (common LLM glitch)
        # Remove only syntax commas outside quoted text; task punctuation is data.
        clean_json_str = re.sub(r'''("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|,\s*(?=[\]}])''',
                                lambda match: match.group(1) or '', clean_json_str)

        # 5. Parse into Python List of Dicts with fallback tolerance
        try:
            parsed = json.loads(clean_json_str)
        except Exception:
            # Fallback: convert single quotes to double quotes if LLM used Python syntax
            try:
                single_to_double = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", r'"\1"', clean_json_str)
                parsed = json.loads(single_to_double)
            except Exception:
                parsed = []

        if isinstance(parsed, dict):
            if "action_items" in parsed and isinstance(parsed["action_items"], list):
                items = parsed["action_items"]
            elif "tasks" in parsed and isinstance(parsed["tasks"], list):
                items = parsed["tasks"]
            else:
                items = [parsed]
        elif isinstance(parsed, list):
            items = parsed
        else:
            items = []

        valid_items: List[Dict[str, Any]] = []
        for item in items:
            if isinstance(item, dict) and item.get("task"):
                valid_items.append({
                    "task": str(item.get("task", "")).strip(),
                    "assignee": str(item.get("assignee") or "Unassigned").strip(),
                    "deadline": str(item.get("deadline")).strip() if item.get("deadline") else None,
                    "status": str(item.get("status", "pending")).strip()
                })

        if valid_items:
            return valid_items

        # If LLM returned empty list, fall back to heuristic extraction
        return extract_action_items_heuristic(transcript)

    except Exception as e:
        print(f"[Agent 3] Warning during LLM action item extraction: {e}. Running heuristic fallback.")
        return extract_action_items_heuristic(transcript)


# --- Quick Local Test ---
if __name__ == "__main__":
    sample_transcript = (
        "John said he will update the database schema by tomorrow. "
        "Alice needs to write the documentation for the API endpoints."
    )
    
    print("Testing Action Item Extraction...")
    results = extract_action_items(sample_transcript)
    print("Result:")
    print(json.dumps(results, indent=2))
