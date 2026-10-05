"""Explicit persistence of an otherwise temporary meeting session."""
import json
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field, UUID4, field_validator, model_validator

from database import crud
from workspace_api import EditableTask, EditableInsights, SourceEntry

router = APIRouter()


class StoredChatMessage(BaseModel):
    model_config = ConfigDict(extra='allow')
    role: Literal['user', 'assistant']
    content: str = Field(max_length=50_000, strict=True)
    citations: list[str | dict[str, Any]] = Field(default_factory=list, max_length=100)

    @model_validator(mode='after')
    def finite_metadata(self):
        json.dumps(self.model_dump(), allow_nan=False)
        return self


class MeetingSaveRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    save_key: UUID4
    filename: str = Field(min_length=1, max_length=255, strict=True)
    raw_transcript: str = Field('', max_length=1_000_000, strict=True)
    executive_summary: str = Field('', max_length=50_000, strict=True)
    duration: float | None = Field(None, ge=0, allow_inf_nan=False)
    language: str | None = Field(None, max_length=128, strict=True)
    action_items: list[EditableTask] = Field(default_factory=list, max_length=10_000)
    # Match the recognizer/diarization's maximum source-segment count.
    segments: list[SourceEntry] = Field(default_factory=list, max_length=20_000)
    insights: EditableInsights = Field(default_factory=EditableInsights)
    chat_history: list[StoredChatMessage] = Field(default_factory=list, max_length=crud.MAX_CHAT_MESSAGES)

    @field_validator('filename')
    @classmethod
    def filename_text(cls, value):
        value = value.replace('\\', '/').rsplit('/', 1)[-1].strip()
        if not value:
            raise ValueError('Filename must contain text.')
        return value


@router.post('/api/meetings', status_code=201)
def save_session(payload: MeetingSaveRequest):
    values = payload.model_dump(mode='json')
    try:
        meeting_id = crud.create_meeting(**values)
    except crud.SavedSessionConflict as error:
        raise HTTPException(409, detail=str(error)) from error
    return {'status': 'success', 'meeting': jsonable_encoder(crud.get_meeting(meeting_id))}
