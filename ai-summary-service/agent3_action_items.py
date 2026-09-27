"""
=====================================================
AGENT 3: ACTION ITEMS EXTRACTION
Owner: Member 3
Task: Design specialized prompt for Llama 3 to extract
      actionable tasks and assignees in standardized JSON format.
=====================================================
"""

import json
import os
import re
from typing import List, Dict, Optional, Any
import ollama


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

    try:
        # 2. Query local Llama 3 via Ollama
        response = ollama.chat(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract action items from this transcript:\n{transcript}"}
            ],
            format="json"  # Forces Ollama to constrain Llama 3 output to JSON
        )
        
        raw_content = response['message']['content'].strip()

        # 3. Clean up formatting issues (Regex sanitation)
        json_match = re.search(r'\[.*\]', raw_content, re.DOTALL)
        clean_json_str = json_match.group(0) if json_match else raw_content

        # 4. Parse into Python List of Dicts with fallback tolerance
        parsed = json.loads(clean_json_str)
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