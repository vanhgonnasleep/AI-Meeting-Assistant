"""
=====================================================
AGENT 4: DATABASE & STORAGE
Owner: Đoàn Hoàng Long (Agent 4)
Task: SQLite CRUD operations and meeting history management
=====================================================
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from .db import get_connection, init_db
from .models import MeetingRecord, ActionItem, INSIGHT_CATEGORIES, empty_insights


# Make sure the database exists
init_db()

# Upper bound on persisted chat messages per meeting (oldest messages are trimmed)
MAX_CHAT_MESSAGES = 200


def _load_json_column(row, column: str, default: Any) -> Any:
    """Safely decode a JSON column that may be missing (older schema) or malformed."""
    try:
        if column not in row.keys() or not row[column]:
            return default
        value = json.loads(row[column])
        return value if isinstance(value, type(default)) else default
    except Exception:
        return default


def row_to_meeting(row) -> Optional[MeetingRecord]:
    """
    Convert a SQLite row into a MeetingRecord object.
    """
    if row is None:
        return None

    action_items = []

    if row["action_items"]:
        try:
            raw_items = json.loads(row["action_items"])

            # Normalize raw_items to a list if wrapped in a dict
            if isinstance(raw_items, dict):
                if "action_items" in raw_items and isinstance(raw_items["action_items"], list):
                    raw_items = raw_items["action_items"]
                elif "tasks" in raw_items and isinstance(raw_items["tasks"], list):
                    raw_items = raw_items["tasks"]
                else:
                    raw_items = [raw_items]
            elif not isinstance(raw_items, list):
                raw_items = [raw_items]

            for item in raw_items:
                if isinstance(item, dict):
                    action_items.append(
                        ActionItem(
                            task=str(item.get("task", "")).strip(),
                            assignee=item.get("assignee") or "Unassigned",
                            deadline=item.get("deadline"),
                            status=item.get("status", "pending"),
                        )
                    )
                elif isinstance(item, str) and item.strip():
                    action_items.append(
                        ActionItem(
                            task=item.strip(),
                            assignee="Unassigned",
                            status="pending"
                        )
                    )

        except Exception:
            action_items = []

    duration = None
    language = None
    try:
        if "duration" in row.keys() and row["duration"] is not None:
            duration = float(row["duration"])
        if "language" in row.keys() and row["language"] is not None:
            language = str(row["language"])
    except Exception:
        pass

    return MeetingRecord(
        filename=row["filename"],
        raw_transcript=row["raw_transcript"] or "",
        executive_summary=row["executive_summary"] or "",
        action_items=action_items,
        id=row["id"],
        duration=duration,
        language=language,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        segments=_load_json_column(row, "segments", []),
        insights=_load_json_column(row, "insights", {}),
        chat_history=_load_json_column(row, "chat_history", []),
        chat_generation=row["chat_generation"] if "chat_generation" in row.keys() else 0,
    )


def action_items_to_json(action_items: Any) -> Optional[str]:
    """
    Convert action items to JSON string for SQLite storage.
    Ensures output is always a standardized JSON array.
    """
    if action_items is None:
        return None

    if isinstance(action_items, str):
        # Validate that it is valid JSON, otherwise wrap as task string
        try:
            parsed = json.loads(action_items)
            if isinstance(parsed, list):
                return action_items
            return json.dumps([parsed], ensure_ascii=False)
        except Exception:
            return json.dumps([{"task": action_items, "assignee": "Unassigned", "status": "pending"}], ensure_ascii=False)

    if isinstance(action_items, ActionItem):
        return json.dumps([action_items.model_dump()], ensure_ascii=False)

    if isinstance(action_items, dict):
        return json.dumps([action_items], ensure_ascii=False)

    if isinstance(action_items, list):
        result = []

        for item in action_items:
            if isinstance(item, ActionItem):
                result.append({
                    "task": item.task,
                    "assignee": item.assignee,
                    "deadline": item.deadline,
                    "status": item.status,
                })
            elif isinstance(item, dict):
                result.append(item)
            elif isinstance(item, str) and item.strip():
                result.append({"task": item.strip(), "assignee": "Unassigned", "status": "pending"})
            elif hasattr(item, "model_dump"):
                result.append(item.model_dump())

        return json.dumps(result, ensure_ascii=False)

    try:
        return json.dumps(action_items, ensure_ascii=False)
    except Exception:
        return "[]"


def segments_to_json(segments: Any) -> Optional[str]:
    """Serialize timestamped transcript segments (list of dicts) for storage."""
    if not segments or not isinstance(segments, list):
        return None
    clean = [seg for seg in segments if isinstance(seg, dict)]
    return json.dumps(clean, ensure_ascii=False) if clean else None


def insights_to_json(insights: Any) -> Optional[str]:
    """Serialize meeting insights into the canonical {decisions, risks, open_questions} shape."""
    if not isinstance(insights, dict):
        return None
    normalized = empty_insights()
    for category in INSIGHT_CATEGORIES:
        values = insights.get(category)
        if isinstance(values, list):
            normalized[category] = [v for v in values if isinstance(v, dict)]
    return json.dumps(normalized, ensure_ascii=False)


def create_meeting(
    filename: str,
    raw_transcript: Optional[str] = None,
    executive_summary: Optional[str] = None,
    action_items: Any = None,
    duration: Optional[float] = None,
    language: Optional[str] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    insights: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Create a new meeting and return its ID.
    """
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO meetings (
                filename,
                raw_transcript,
                executive_summary,
                action_items,
                duration,
                language,
                segments,
                insights
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                filename,
                raw_transcript,
                executive_summary,
                action_items_to_json(action_items),
                duration,
                language,
                segments_to_json(segments),
                insights_to_json(insights),
            ),
        )
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_meeting(meeting_id: int) -> Optional[MeetingRecord]:
    """
    Get one meeting by ID.
    """
    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT *
            FROM meetings
            WHERE id = ?
            """,
            (meeting_id,),
        ).fetchone()
    finally:
        connection.close()

    return row_to_meeting(row)


def _escape_like(term: str) -> str:
    """Escape SQL LIKE wildcards so user input such as '50%' or 'q3_plan' matches literally."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def get_all_meetings(search: Optional[str] = None) -> list[MeetingRecord]:
    """
    Get all meetings, newest first. Optionally filter by keyword.
    """
    connection = get_connection()
    try:
        if search and search.strip():
            q = f"%{_escape_like(search.strip())}%"
            rows = connection.execute(
                """
                SELECT *
                FROM meetings
                WHERE filename LIKE ? ESCAPE '\\'
                   OR executive_summary LIKE ? ESCAPE '\\'
                   OR raw_transcript LIKE ? ESCAPE '\\'
                   OR action_items LIKE ? ESCAPE '\\'
                ORDER BY created_at DESC, id DESC
                """,
                (q, q, q, q),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT *
                FROM meetings
                ORDER BY created_at DESC, id DESC
                """
            ).fetchall()
    finally:
        connection.close()

    return [row_to_meeting(row) for row in rows]


def update_meeting(
    meeting_id: int,
    filename: Optional[str] = None,
    raw_transcript: Optional[str] = None,
    executive_summary: Optional[str] = None,
    action_items: Any = None,
    duration: Optional[float] = None,
    language: Optional[str] = None,
) -> bool:
    """
    Update an existing meeting.
    Reads and writes inside one BEGIN IMMEDIATE transaction so concurrent
    writers cannot interleave between the read and the update.
    """
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT * FROM meetings WHERE id = ?",
            (meeting_id,),
        ).fetchone()
        existing = row_to_meeting(row)
        if existing is None:
            connection.rollback()
            return False

        new_action_items = (
            action_items_to_json(action_items)
            if action_items is not None
            else action_items_to_json(existing.action_items)
        )
        cursor = connection.execute(
            """
            UPDATE meetings
            SET
                filename = ?,
                raw_transcript = ?,
                executive_summary = ?,
                action_items = ?,
                duration = ?,
                language = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                filename if filename is not None else existing.filename,
                raw_transcript if raw_transcript is not None else existing.raw_transcript,
                executive_summary if executive_summary is not None else existing.executive_summary,
                new_action_items,
                duration if duration is not None else existing.duration,
                language if language is not None else existing.language,
                meeting_id,
            ),
        )
        connection.commit()
        return cursor.rowcount > 0
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def update_action_item_status(meeting_id: int, item_idx: int, status: str) -> bool:
    """
    Toggle or update the status of a specific action item within a meeting record.
    Uses BEGIN IMMEDIATE transaction to prevent concurrent updates from overwriting each other.
    """
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT * FROM meetings WHERE id = ?",
            (meeting_id,),
        ).fetchone()
        meeting = row_to_meeting(row)
        if meeting is None or item_idx < 0 or item_idx >= len(meeting.action_items):
            connection.rollback()
            return False

        meeting.action_items[item_idx].status = status
        cursor = connection.execute(
            """
            UPDATE meetings
            SET action_items = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (action_items_to_json(meeting.action_items), meeting_id),
        )
        connection.commit()
        return cursor.rowcount > 0
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def append_chat_messages(meeting_id: int, messages: List[Dict[str, Any]], expected_generation: Optional[int] = None) -> bool:
    """
    Atomically append Q&A messages to a meeting's chat history.
    Uses BEGIN IMMEDIATE so two concurrent questions never drop each other's messages.
    """
    clean = [m for m in messages if isinstance(m, dict) and m.get("role") and m.get("content")]
    if not clean:
        return False

    now_str = datetime.now().isoformat(timespec="seconds")
    for message in clean:
        message.setdefault("created_at", now_str)

    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT chat_history, chat_generation FROM meetings WHERE id = ?",
            (meeting_id,),
        ).fetchone()
        if row is None:
            connection.rollback()
            return False

        if expected_generation is not None and row["chat_generation"] != expected_generation:
            connection.rollback()
            return False

        history = _load_json_column(row, "chat_history", [])
        history.extend(clean)
        history = history[-MAX_CHAT_MESSAGES:]
        connection.execute(
            "UPDATE meetings SET chat_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(history, ensure_ascii=False), meeting_id),
        )
        connection.commit()
        return True
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def get_chat_history(meeting_id: int) -> Optional[List[Dict[str, Any]]]:
    """Return the persisted chat history of a meeting, or None if the meeting does not exist."""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT chat_history FROM meetings WHERE id = ?",
            (meeting_id,),
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        return None
    return _load_json_column(row, "chat_history", [])


def clear_chat_history(meeting_id: int) -> bool:
    """Delete all chat messages of a meeting. Returns False if the meeting does not exist."""
    connection = get_connection()
    try:
        cursor = connection.execute(
            "UPDATE meetings SET chat_history = NULL, chat_generation = chat_generation + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (meeting_id,),
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()


def delete_meeting(meeting_id: int) -> bool:
    """
    Delete a meeting by ID.
    """
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            DELETE FROM meetings
            WHERE id = ?
            """,
            (meeting_id,),
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()


def get_action_items(meeting_id: int) -> Optional[list[ActionItem]]:
    """
    Return action items as ActionItem objects.
    """
    meeting = get_meeting(meeting_id)

    if meeting is None:
        return None

    return meeting.action_items


def get_analytics_summary() -> dict:
    """
    Computes system-wide meeting analytics: total meetings, total duration,
    action items completion rate, and distinct languages detected.
    """
    meetings = get_all_meetings()
    total_meetings = len(meetings)
    total_duration = sum(m.duration or 0.0 for m in meetings)
    
    total_tasks = 0
    completed_tasks = 0
    languages = set()

    for m in meetings:
        if m.language:
            languages.add(m.language)
        for item in m.action_items:
            total_tasks += 1
            if (item.status or "").lower() in ("completed", "done"):
                completed_tasks += 1

    pending_tasks = total_tasks - completed_tasks
    completion_rate = round((completed_tasks / max(total_tasks, 1)) * 100, 1)

    return {
        "total_meetings": total_meetings,
        "total_duration_seconds": round(total_duration, 1),
        "total_action_items": total_tasks,
        "completed_action_items": completed_tasks,
        "pending_action_items": pending_tasks,
        "completion_rate_percent": completion_rate,
        "detected_languages": list(sorted(languages))
    }
