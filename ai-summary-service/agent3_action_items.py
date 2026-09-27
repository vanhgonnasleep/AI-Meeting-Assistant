"""
=====================================================
AGENT 3: ACTION ITEMS EXTRACTION
Owner: Member 3
Task: Design specialized prompt for Llama 3 to extract
      actionable tasks and assignees in standardized JSON format.
=====================================================
"""

import json
import re
from typing import List, Dict
import ollama  # Make sure ollama library is installed (pip install ollama)

def extract_action_items(transcript: str) -> List[Dict[str, str]]:
    """
    Receives raw meeting transcript and extracts actionable work items.
    
    Args:
        transcript (str): Raw meeting transcript text.
        
    Returns:
        List[Dict[str, str]]: Action items in standardized JSON format:
            [
                {"task": "Prepare Q3 financial report", "assignee": "John (Speaker A)"},
                ...
            ]
    """
    # 1. System prompt forcing strict JSON array output format
    system_prompt = (
        "You are an AI assistant that extracts actionable work items from meeting transcripts.\n"
    "You MUST respond ONLY with a valid JSON ARRAY of objects enclosed in square brackets [].\n"
    "Do NOT return a single object, do NOT include markdown formatting or extra conversational text.\n"
    "Each object in the array must have exactly two keys: 'task' and 'assignee'.\n"
    "Example:\n"
    '[{"task": "Update database schema", "assignee": "John"}]'
    )

    try:
        # 2. Query local Llama 3 via Ollama[cite: 1, 2]
        response = ollama.chat(
            model="llama3",
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

        # 4. Parse into Python List of Dicts
        action_items = json.loads(clean_json_str)
        return action_items

    except Exception as e:
        print(f"Error during action item extraction: {e}")
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