"""Meeting updates, task revisions and speaker corrections."""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator
from app.api.schemas.workspace import EditableTask


class MeetingUpdateRequest(BaseModel):
    filename: Optional[str] = Field(None, max_length=255, strict=True)
    raw_transcript: Optional[str] = Field(None, max_length=1_000_000, strict=True)
    executive_summary: Optional[str] = Field(None, max_length=50_000, strict=True)
    action_items: Optional[List[EditableTask]] = Field(None, max_length=10_000)
    duration: Optional[float] = Field(None, ge=0, allow_inf_nan=False)
    language: Optional[str] = Field(None, max_length=128, strict=True)

class TaskStatusUpdateRequest(BaseModel):
    status: str
    expected_revision: int = Field(ge=0, strict=True)


class SpeakerEditRequest(BaseModel):
    old_name: str = Field(min_length=1, max_length=128)
    new_name: str = Field(min_length=1, max_length=128)
    segment_index: Optional[int] = Field(None, ge=0)

    @field_validator("old_name", "new_name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip() or any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("Speaker names must contain text and no control characters.")
        return value.strip()
