from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime

class ActionItem(BaseModel):
    task: str
    assignee: str

class MeetingRecord(BaseModel):
    id: Optional[str] = None
    filename: str
    processed_at: datetime = Field(default_factory=datetime.now)
    raw_transcript: str
    executive_summary: str
    action_items: List[ActionItem]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "filename": "q3_budget_meeting.mp3",
                "raw_transcript": "Speaker A: Let's discuss the budget...",
                "executive_summary": "- Discussed Q3 budget\n- Approved $50k",
                "action_items": [{"task": "Prepare report", "assignee": "John"}]
            }
        }
    )
