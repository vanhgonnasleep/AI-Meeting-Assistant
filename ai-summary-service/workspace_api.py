"""Meeting workspace routes, with inference supplied by the application."""
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from database import workspace


TaskStatus = Literal["pending", "in_progress", "completed", "done"]
DecisionStatus = Literal["proposed", "approved", "superseded", "cancelled"]


class WorkspaceRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        async def checked_request(request):
            try:
                return await handler(request)
            except RequestValidationError as exc:
                # Echoing malformed numeric input (Infinity/NaN) breaks JSON
                # error serialization; echoing a huge transcript is unnecessary.
                errors = [{key: item[key] for key in ("loc", "msg", "type") if key in item} for item in exc.errors()]
                raise HTTPException(422, detail=errors) from exc
        return checked_request


class EditableTask(BaseModel):
    task: str = Field(min_length=1, max_length=4000, strict=True)
    assignee: str | None = Field("Unassigned", max_length=128, strict=True)
    deadline: str | None = Field(None, max_length=128, strict=True)
    status: TaskStatus = "pending"

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
    segments: list[SourceEntry] | None = Field(None, max_length=10_000)
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
    project_id: int | None = Field(ge=1, strict=True)


def _call(operation, *args, **kwargs):
    try:
        return operation(*args, **kwargs)
    except workspace.WorkspaceError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


def create_workspace_router(summary_function, model_resolver=None, hardware_detector=None):
    router = APIRouter(prefix="/api", route_class=WorkspaceRoute)

    @router.patch("/meetings/{meeting_id}/review")
    def review(meeting_id: int, payload: ReviewRequest):
        record = _call(workspace.review_meeting, meeting_id, payload.expected_revision, payload.review_status, **payload.changes())
        return {"meeting": record.to_dict()}

    @router.post("/meetings/{meeting_id}/regenerate-summary")
    def regenerate(meeting_id: int, payload: RegenerateRequest):
        snapshot = _call(workspace.source_snapshot, meeting_id, payload.expected_revision)
        if not snapshot.raw_transcript.strip():
            raise HTTPException(422, "This meeting has no transcript to summarize.")
        if len(snapshot.raw_transcript) > 1_000_000:
            raise HTTPException(422, "Transcript exceeds the summary input limit.")
        try:
            hardware = hardware_detector() if hardware_detector else None
            has_gpu = bool(hardware[1]) if isinstance(hardware, tuple) else bool(hardware)
            selected_model = model_resolver(payload.model, has_gpu=has_gpu) if model_resolver else ("llama3" if payload.model == "auto" else payload.model)
            summary = summary_function(snapshot.raw_transcript, model_name=selected_model, has_gpu=has_gpu, language=snapshot.language or "en")
        except Exception as exc:
            raise HTTPException(503, "Summary generation is unavailable. Your saved meeting was preserved.") from exc
        if not isinstance(summary, str) or not summary.strip() or len(summary) > 50_000:
            raise HTTPException(503, "The model did not return a valid summary. Your saved meeting was preserved.")
        record = _call(workspace.save_regenerated_summary, meeting_id, payload.expected_revision, summary.strip())
        return {"meeting": record.to_dict()}

    @router.get("/tasks")
    def tasks(q: str | None = Query(None, max_length=500), status: TaskStatus | None = None,
              assignee: str | None = Query(None, max_length=128), project_id: int | None = Query(None, ge=1),
              limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        return workspace.task_page(q=q, status=status, assignee=assignee, project_id=project_id, limit=limit, offset=offset)

    @router.get("/projects")
    def projects():
        return {"projects": workspace.projects()}

    @router.post("/projects")
    def create_project(payload: ProjectRequest):
        return {"project": _call(workspace.create_project, payload.name)}

    @router.patch("/meetings/{meeting_id}/project")
    def assign_project(meeting_id: int, payload: ProjectAssignmentRequest):
        record = _call(workspace.assign_project, meeting_id, payload.expected_revision, payload.project_id)
        return {"meeting": record.to_dict()}

    @router.get("/projects/{project_id}/timeline")
    def timeline(project_id: int, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
        return _call(workspace.timeline_page, project_id, limit=limit, offset=offset)

    return router
