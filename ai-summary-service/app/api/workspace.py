"""Meeting workspace routes, with inference supplied by the application."""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from app.api.schemas.workspace import (
    EditableTask, SourceEntry, InsightEntry, DecisionEntry, EditableInsights,
    ReviewRequest, RegenerateRequest, ProjectRequest, ProjectAssignmentRequest,
    TaskStatus, DecisionStatus,
)

from database import workspace
from app.api.schemas.identifiers import StoredId, SQLITE_MAX_INTEGER


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


def _call(operation, *args, **kwargs):
    try:
        return operation(*args, **kwargs)
    except workspace.WorkspaceError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


def create_workspace_router(summary_function, model_resolver=None, hardware_detector=None):
    router = APIRouter(prefix="/api", route_class=WorkspaceRoute)

    @router.patch("/meetings/{meeting_id}/review")
    def review(meeting_id: StoredId, payload: ReviewRequest):
        record = _call(workspace.review_meeting, meeting_id, payload.expected_revision, payload.review_status, **payload.changes())
        return {"meeting": record.to_dict()}

    @router.post("/meetings/{meeting_id}/regenerate-summary")
    def regenerate(meeting_id: StoredId, payload: RegenerateRequest):
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
              assignee: str | None = Query(None, max_length=128), project_id: int | None = Query(None, ge=1, le=SQLITE_MAX_INTEGER),
              limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=SQLITE_MAX_INTEGER)):
        return workspace.task_page(q=q, status=status, assignee=assignee, project_id=project_id, limit=limit, offset=offset)

    @router.get("/projects")
    def projects():
        return {"projects": workspace.projects()}

    @router.post("/projects")
    def create_project(payload: ProjectRequest):
        return {"project": _call(workspace.create_project, payload.name)}

    @router.patch("/meetings/{meeting_id}/project")
    def assign_project(meeting_id: StoredId, payload: ProjectAssignmentRequest):
        record = _call(workspace.assign_project, meeting_id, payload.expected_revision, payload.project_id)
        return {"meeting": record.to_dict()}

    @router.get("/projects/{project_id}/timeline")
    def timeline(project_id: StoredId, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0, le=SQLITE_MAX_INTEGER)):
        return _call(workspace.timeline_page, project_id, limit=limit, offset=offset)

    return router
