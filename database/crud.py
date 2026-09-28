"""
=====================================================
AGENT 4: DATABASE & STORAGE
Owner: Đoàn Hoàng Long (Agent 4)
Task: SQLite CRUD operations and meeting history management
=====================================================
"""

import json
from typing import Any, Optional

from .db import get_connection, init_db
from .models import MeetingRecord, ActionItem


# Make sure the database exists
init_db()


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
                            assignee=item.get("assignee"),
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


def create_meeting(
    filename: str,
    raw_transcript: Optional[str] = None,
    executive_summary: Optional[str] = None,
    action_items: Any = None,
    duration: Optional[float] = None,
    language: Optional[str] = None,
) -> int:
    """
    Create a new meeting and return its ID.
    """
    connection = get_connection()

    action_items_json = action_items_to_json(action_items)

    cursor = connection.execute(
        """
        INSERT INTO meetings (
            filename,
            raw_transcript,
            executive_summary,
            action_items,
            duration,
            language
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            filename,
            raw_transcript,
            executive_summary,
            action_items_json,
            duration,
            language,
        ),
    )

    connection.commit()

    meeting_id = cursor.lastrowid

    connection.close()

    return meeting_id


def get_meeting(meeting_id: int) -> Optional[MeetingRecord]:
    """
    Get one meeting by ID.
    """
    connection = get_connection()

    row = connection.execute(
        """
        SELECT *
        FROM meetings
        WHERE id = ?
        """,
        (meeting_id,),
    ).fetchone()

    connection.close()

    return row_to_meeting(row)


def get_all_meetings(search: Optional[str] = None) -> list[MeetingRecord]:
    """
    Get all meetings, newest first. Optionally filter by keyword.
    """
    connection = get_connection()

    if search and search.strip():
        q = f"%{search.strip()}%"
        rows = connection.execute(
            """
            SELECT *
            FROM meetings
            WHERE filename LIKE ? OR executive_summary LIKE ? OR raw_transcript LIKE ? OR action_items LIKE ?
            ORDER BY created_at DESC
            """,
            (q, q, q, q),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM meetings
            ORDER BY created_at DESC
            """
        ).fetchall()

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
    """
    existing = get_meeting(meeting_id)

    if existing is None:
        return False

    new_filename = (
        filename if filename is not None else existing.filename
    )

    new_transcript = (
        raw_transcript
        if raw_transcript is not None
        else existing.raw_transcript
    )

    new_summary = (
        executive_summary
        if executive_summary is not None
        else existing.executive_summary
    )

    if action_items is not None:
        new_action_items = action_items_to_json(action_items)
    else:
        new_action_items = action_items_to_json(existing.action_items)

    new_duration = duration if duration is not None else existing.duration
    new_language = language if language is not None else existing.language

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


def delete_meeting(meeting_id: int) -> bool:
    """
    Delete a meeting by ID.
    """
    connection = get_connection()

    cursor = connection.execute(
        """
        DELETE FROM meetings
        WHERE id = ?
        """,
        (meeting_id,),
    )

    connection.commit()

    deleted = cursor.rowcount > 0

    connection.close()

    return deleted


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
            if item.status.lower() in ("completed", "done"):
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