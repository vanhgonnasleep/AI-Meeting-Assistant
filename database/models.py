"""
=====================================================
DATA MODELS FOR SQLITE PERSISTENCE
Owner: Đoàn Hoàng Long (Agent 4 / Database)
Implementation: Native Python standard library dataclasses
=====================================================
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Union, Dict, Any
from datetime import datetime


@dataclass
class ActionItem:
    task: str
    assignee: Optional[str] = "Unassigned"
    deadline: Optional[str] = None
    status: str = "pending"

    def to_dict(self) -> Dict[str, Any]:
        """Convert dataclass instance to standard dictionary."""
        return asdict(self)

    # Backward compatibility with callers expecting model_dump() / dict()
    def model_dump(self, *args, **kwargs) -> Dict[str, Any]:
        return asdict(self)

    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        return asdict(self)


INSIGHT_CATEGORIES = ("decisions", "risks", "open_questions")


def empty_insights() -> Dict[str, List[Dict[str, Any]]]:
    """Canonical empty shape for meeting insights."""
    return {category: [] for category in INSIGHT_CATEGORIES}


@dataclass
class MeetingRecord:
    filename: str
    raw_transcript: str = ""
    executive_summary: str = ""
    action_items: List[ActionItem] = field(default_factory=list)
    id: Optional[Union[int, str]] = None
    duration: Optional[float] = None
    language: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    processed_at: Optional[str] = None
    # Timestamped transcript segments: [{start, end, timestamp, speaker, text}]
    segments: List[Dict[str, Any]] = field(default_factory=list)
    # Meeting intelligence: {decisions: [...], risks: [...], open_questions: [...]}
    insights: Dict[str, List[Dict[str, Any]]] = field(default_factory=empty_insights)
    # Persisted Q&A: [{role, content, citations, mode, created_at}]
    chat_history: List[Dict[str, Any]] = field(default_factory=list)
    chat_generation: int = 0

    def __post_init__(self):
        # Guarantee backward and forward compatibility between created_at and processed_at
        now_str = datetime.now().isoformat()
        if not self.created_at and not self.processed_at:
            self.created_at = now_str
            self.processed_at = now_str
        elif self.created_at and not self.processed_at:
            self.processed_at = self.created_at
        elif self.processed_at and not self.created_at:
            self.created_at = self.processed_at

        # Coerce raw dict items to ActionItem dataclass if passed as dicts
        if self.action_items:
            coerced: List[ActionItem] = []
            for item in self.action_items:
                if isinstance(item, ActionItem):
                    coerced.append(item)
                elif isinstance(item, dict):
                    coerced.append(ActionItem(
                        task=str(item.get("task", "")).strip(),
                        assignee=item.get("assignee") or "Unassigned",
                        deadline=item.get("deadline"),
                        status=item.get("status", "pending")
                    ))
                elif isinstance(item, str) and item.strip():
                    coerced.append(ActionItem(task=item.strip()))
                else:
                    coerced.append(item)
            self.action_items = coerced

        # Normalize optional collections (tolerate None / malformed values from storage)
        self.segments = [dict(segment, text=str(segment.get("text") or ""))
                         for segment in (self.segments if isinstance(self.segments, list) else [])
                         if isinstance(segment, dict)]
        self.chat_history = [dict(message, content=str(message.get("content") or ""),
                                  citations=[item for item in message.get("citations", []) if isinstance(item, (str, dict))]
                                  if isinstance(message.get("citations"), list) else [])
                             for message in (self.chat_history if isinstance(self.chat_history, list) else [])
                             if isinstance(message, dict) and message.get("role") in ("user", "assistant")]
        normalized = empty_insights()
        if isinstance(self.insights, dict):
            for category in INSIGHT_CATEGORIES:
                values = self.insights.get(category)
                if isinstance(values, list):
                    normalized[category] = [v for v in values if isinstance(v, dict)]
        self.insights = normalized

    def to_dict(self) -> Dict[str, Any]:
        """Convert dataclass instance to standard dictionary."""
        return asdict(self)

    # Backward compatibility with callers expecting model_dump() / dict()
    def model_dump(self, *args, **kwargs) -> Dict[str, Any]:
        return asdict(self)

    def dict(self, *args, **kwargs) -> Dict[str, Any]:
        return asdict(self)
