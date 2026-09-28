from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Union, Any
from datetime import datetime


class ActionItem(BaseModel):
    task: str
    assignee: Optional[str] = "Unassigned"
    deadline: Optional[str] = None
    status: str = "pending"

    model_config = ConfigDict(extra="ignore")


class MeetingRecord(BaseModel):
    filename: str
    raw_transcript: str = ""
    executive_summary: str = ""
    action_items: List[ActionItem] = Field(default_factory=list)
    id: Optional[Union[int, str]] = None
    duration: Optional[float] = None
    language: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    processed_at: Optional[str] = None

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "id": 1,
                "filename": "q3_budget_meeting.mp3",
                "raw_transcript": "Speaker A: Let's discuss the budget...",
                "executive_summary": "- Discussed Q3 budget\n- Approved $50k",
                "action_items": [{"task": "Prepare report", "assignee": "John", "status": "pending"}],
                "created_at": "2026-09-27 10:00:00"
            }
        }
    )

    def model_post_init(self, __context: Any) -> None:
        # Guarantee backward and forward compatibility between created_at and processed_at
        now_str = datetime.now().isoformat()
        if not self.created_at and not self.processed_at:
            self.created_at = now_str
            self.processed_at = now_str
        elif self.created_at and not self.processed_at:
            self.processed_at = self.created_at
        elif self.processed_at and not self.created_at:
            self.created_at = self.processed_at