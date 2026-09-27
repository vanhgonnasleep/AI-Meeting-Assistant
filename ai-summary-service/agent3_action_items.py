"""
=====================================================
AGENT 3: ACTION ITEMS EXTRACTION
Owner: Member 3
Task: Design specialized prompt for Llama 3 to extract
      actionable tasks and assignees in standardized JSON format.
=====================================================
"""

from typing import List, Dict

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
    # TODO (Member 3): Implement Llama 3 prompt to extract JSON action items here
    # Tip: Call Ollama API with format="json" and structured prompt.

    raise NotImplementedError("Member 3 is implementing Agent 3 Action Items.")
