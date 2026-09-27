from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class ActionItem:
    task: str
    assignee: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "pending"


@dataclass
class MeetingRecord:
    filename: str
    raw_transcript: str
    executive_summary: str
    action_items: List[ActionItem] = field(default_factory=list)

    id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None