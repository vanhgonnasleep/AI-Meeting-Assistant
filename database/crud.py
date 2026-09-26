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

            action_items = [
                ActionItem(
                    task=item.get("task", ""),
                    assignee=item.get("assignee"),
                    deadline=item.get("deadline"),
                    status=item.get("status", "pending"),
                )
                for item in raw_items
            ]

        except (json.JSONDecodeError, TypeError):
            action_items = []

    return MeetingRecord(
        filename=row["filename"],
        raw_transcript=row["raw_transcript"] or "",
        executive_summary=row["executive_summary"] or "",
        action_items=action_items,
        id=row["id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def action_items_to_json(action_items: Any) -> Optional[str]:
    """
    Convert action items to JSON string for SQLite storage.
    """
    if action_items is None:
        return None

    if isinstance(action_items, str):
        return action_items

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

        return json.dumps(result, ensure_ascii=False)

    return json.dumps(action_items, ensure_ascii=False)


def create_meeting(
    filename: str,
    raw_transcript: Optional[str] = None,
    executive_summary: Optional[str] = None,
    action_items: Any = None,
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
            action_items
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            filename,
            raw_transcript,
            executive_summary,
            action_items_json,
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


def get_all_meetings() -> list[MeetingRecord]:
    """
    Get all meetings, newest first.
    """
    connection = get_connection()

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

    connection = get_connection()

    cursor = connection.execute(
        """
        UPDATE meetings
        SET
            filename = ?,
            raw_transcript = ?,
            executive_summary = ?,
            action_items = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            new_filename,
            new_transcript,
            new_summary,
            new_action_items,
            meeting_id,
        ),
    )

    connection.commit()

    updated = cursor.rowcount > 0

    connection.close()

    return updated


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