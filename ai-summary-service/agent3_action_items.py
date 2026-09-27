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


def extract_action_items(transcript: str, model_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Receives raw meeting transcript and extracts actionable work items.
    
    Args:
        transcript (str): Raw meeting transcript text.
        model_name (str, optional): Target Ollama model name. Defaults to 'llama3'.
        
    Returns:
        List[Dict[str, Any]]: Action items in standardized JSON format:
            [
                {"task": "Prepare Q3 financial report", "assignee": "John", "status": "pending"},
                ...
            ]
    """
    if not transcript or not transcript.strip():
        return []

    target_model = model_name or os.getenv("OLLAMA_MODEL", "llama3")

    # 1. System prompt forcing strict JSON array output format
    system_prompt = (
        "You are an AI assistant that extracts actionable work items from meeting transcripts.\n"
        "You MUST respond ONLY with a valid JSON ARRAY of objects enclosed in square brackets [].\n"
        "Do NOT return a single object, do NOT include markdown formatting or extra conversational text.\n"
        "Each object in the array must have two keys: 'task' and 'assignee'.\n"
        "Example:\n"
        '[{"task": "Update database schema", "assignee": "John"}]'
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
            response = ollama.chat(
                model=target_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Extract action items from this transcript:\n{clean_transcript}"}
                ],
                format="json"  # Forces Ollama to constrain Llama 3 output to JSON
            )
            raw_content = response['message']['content'].strip()
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
        # Avoid greedy re.DOTALL which can corrupt output when LLM adds extra text between arrays
        def extract_first_json_array(text: str) -> str:
            start = text.find('[')
            if start == -1:
                return text  # no array found, try to parse the whole thing
            depth = 0
            for i, ch in enumerate(text[start:], start=start):
                if ch == '[':
                    depth += 1
                elif ch == ']':
                    depth -= 1
                    if depth == 0:
                        return text[start:i + 1]
            return text[start:]  # malformed but give it a shot

        clean_json_str = extract_first_json_array(raw_content)

        # 4. Sanitize trailing commas before closing brackets/braces (common LLM glitch)
        clean_json_str = re.sub(r',\s*([\]\}])', r'\1', clean_json_str)

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

        return valid_items

    except Exception as e:
        print(f"[Agent 3] Error during action item extraction: {e}")
        return []


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