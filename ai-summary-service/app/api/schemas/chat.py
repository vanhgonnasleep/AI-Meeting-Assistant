"""Bounded chat questions and supplied source context."""
import math
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ChatMessageRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    meeting_id: Optional[int] = None
    transcript: Optional[str] = Field(None, max_length=1_000_000)
    summary: Optional[str] = Field(None, max_length=50_000)
    segments: Optional[List[Dict[str, Any]]] = Field(None, max_length=20_000)
    model: Optional[str] = Field("auto", max_length=128)
    language: Optional[str] = None
    demo_mode: Optional[bool] = False
    semantic: bool = False
    embedding_model: str = Field('embeddinggemma', min_length=1, max_length=128)

    @field_validator("question")
    @classmethod
    def nonempty_question(cls, value):
        if not value.strip():
            raise ValueError("Question must contain text.")
        return value.strip()

    @field_validator("segments")
    @classmethod
    def bounded_segments(cls, values):
        total_text = 0
        for segment in values or []:
            text = segment.get("text", "")
            if not isinstance(text, str) or len(text) > 4000:
                raise ValueError("Each segment must contain at most 4000 text characters.")
            total_text += len(text)
            for key in ("start", "end"):
                value = segment.get(key)
                if value is not None and (not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
                    raise ValueError("Segment times must be finite and non-negative.")
            for key in ("speaker", "timestamp"):
                value = segment.get(key)
                if value is not None and (not isinstance(value, str) or len(value) > 128):
                    raise ValueError("Segment labels must be short strings.")
        if total_text > 1_000_000:
            raise ValueError("Segment context exceeds the text budget.")
        return values
