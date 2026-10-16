"""Workspace review, project and source-editing contracts."""
import json
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .identifiers import StoredId


TaskStatus = Literal["pending", "in_progress", "completed", "done"]
DecisionStatus = Literal["proposed", "approved", "superseded", "cancelled"]


class EditableTask(BaseModel):
    task: str = Field(min_length=1, max_length=4000, strict=True)
    assignee: str | None = Field("Unassigned", max_length=128, strict=True)
    deadline: str | None = Field(None, max_length=128, strict=True)
    deadline_iso: str | None = Field(None, max_length=10, strict=True)
    status: TaskStatus = "pending"

    @field_validator('deadline_iso')
    @classmethod
    def iso_calendar_date(cls, value):
        if value is not None and (len(value) != 10 or date.fromisoformat(value).isoformat() != value):
            raise ValueError('deadline_iso must be YYYY-MM-DD')
        return value

    @field_validator("task")
    @classmethod
    def nonempty_task(cls, value):
        if not value.strip():
            raise ValueError("Task text must contain text.")
        return value.strip()

    @field_validator("assignee")
    @classmethod
    def normalize_owner(cls, value):
        return (value or "").strip() or "Unassigned"


class SourceEntry(BaseModel):
    model_config = ConfigDict(extra="allow")
    text: str = Field(max_length=4000, strict=True)
    speaker: str | None = Field(None, max_length=128, strict=True)
    timestamp: str | None = Field(None, max_length=128, strict=True)
    start: float | None = Field(None, ge=0, allow_inf_nan=False)
    end: float | None = Field(None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered_time(self):
        if self.start is not None and self.end is not None and self.end < self.start:
            raise ValueError("Segment end must not precede start.")
        # Unknown source metadata is preserved, but must still be safe JSON.
        json.dumps(self.model_dump(), allow_nan=False)
        return self


class InsightEntry(SourceEntry):
    text: str = Field(min_length=1, max_length=50_000, strict=True)


class DecisionEntry(InsightEntry):
    status: DecisionStatus = "proposed"


class EditableInsights(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decisions: list[DecisionEntry] = Field(default_factory=list, max_length=10_000)
    risks: list[InsightEntry] = Field(default_factory=list, max_length=10_000)
    open_questions: list[InsightEntry] = Field(default_factory=list, max_length=10_000)


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    review_status: Literal["draft", "reviewed"]
    raw_transcript: str | None = Field(None, max_length=1_000_000, strict=True)
    executive_summary: str | None = Field(None, max_length=50_000, strict=True)
    segments: list[SourceEntry] | None = Field(None, max_length=20_000)
    action_items: list[EditableTask] | None = Field(None, max_length=10_000)
    insights: EditableInsights | None = None

    @field_validator("raw_transcript", "executive_summary", "segments", "action_items", "insights")
    @classmethod
    def explicit_null_is_not_edit(cls, value):
        if value is None:
            raise ValueError("Use an empty string or collection to clear this field.")
        return value

    @model_validator(mode="after")
    def bounded_content(self):
        if self.segments is not None:
            size = sum(len(segment.text) + len(segment.speaker or "") + len(segment.timestamp or "") + 3 for segment in self.segments)
            if size > 1_000_000:
                raise ValueError("Combined transcript segments exceed the transcript limit.")
        if self.insights is not None:
            if sum(len(item.text) for values in (self.insights.decisions, self.insights.risks, self.insights.open_questions) for item in values) > 1_000_000:
                raise ValueError("Combined insights exceed the content limit.")
        return self

    def changes(self):
        result = self.model_dump(exclude_unset=True, exclude={"expected_revision", "review_status"})
        if self.action_items is not None:
            result["action_items"] = [item.model_dump() for item in self.action_items]
        return result


class RegenerateRequest(BaseModel):
    expected_revision: int = Field(ge=0, strict=True)
    model: str = Field("auto", min_length=1, max_length=128, strict=True)

    @field_validator("model")
    @classmethod
    def nonempty_model(cls, value):
        if not value.strip():
            raise ValueError("Model name must contain text.")
        return value.strip()


class ProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128, strict=True)

    @field_validator("name", mode="before")
    @classmethod
    def project_name(cls, value):
        if not isinstance(value, str):
            return value
        if not value.strip():
            raise ValueError("Project name must contain text.")
        return value.strip()


class ProjectAssignmentRequest(BaseModel):
    expected_revision: int = Field(ge=0, strict=True)
    project_id: StoredId | None = Field(strict=True)
