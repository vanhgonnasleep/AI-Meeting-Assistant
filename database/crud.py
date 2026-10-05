"""
=====================================================
AGENT 4: DATABASE & STORAGE
Owner: Đoàn Hoàng Long (Agent 4)
Task: SQLite CRUD operations and meeting history management
=====================================================
"""

import json
import hashlib
import math
import re
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
        value = json.loads(row[column], parse_constant=lambda _: None)
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
            raw_items = json.loads(row["action_items"], parse_constant=lambda _: None)

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
                            task=str(item.get("task") or "").strip(),
                            assignee=str(item.get("assignee") or "Unassigned"),
                            deadline=str(item["deadline"]) if item.get("deadline") is not None else None,
                            status=str(item.get("status") or "pending"),
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
            if not math.isfinite(duration) or duration < 0:
                duration = None
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
        revision=row["revision"] if "revision" in row.keys() else 0,
        review_status=row["review_status"] if "review_status" in row.keys() else "draft",
        project_id=row["project_id"] if "project_id" in row.keys() else None,
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


class SavedSessionConflict(ValueError):
    def __init__(self, meeting_id):
        super().__init__(f"This session is already saved as meeting #{meeting_id}. Open it from the library to review changes, or export your current notes.")


def create_meeting(
    filename: str,
    raw_transcript: Optional[str] = None,
    executive_summary: Optional[str] = None,
    action_items: Any = None,
    duration: Optional[float] = None,
    language: Optional[str] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    insights: Optional[Dict[str, Any]] = None,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    save_key: Optional[str] = None,
) -> int:
    """
    Create a new meeting and return its ID.
    """
    connection = get_connection()
    try:
        values = (filename, raw_transcript, executive_summary, action_items_to_json(action_items),
                  duration, language, segments_to_json(segments), insights_to_json(insights),
                  json.dumps((chat_history or [])[-MAX_CHAT_MESSAGES:], ensure_ascii=False, allow_nan=False))
        digest = hashlib.sha256(json.dumps(values, ensure_ascii=False, allow_nan=False).encode('utf-8')).hexdigest() if save_key else None
        if save_key:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute("SELECT id, save_digest FROM meetings WHERE save_key=?", (save_key,)).fetchone()
            if existing:
                if existing['save_digest'] != digest:
                    raise SavedSessionConflict(existing['id'])
                return existing['id']
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
                insights,
                chat_history,
                save_key,
                save_digest
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*values, save_key, digest),
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


def get_meeting_page(search=None, limit=50, offset=0, compact=False):
    """Search before pagination; compact rows exclude transcript, segments and chat."""
    where, params = "", []
    if search and search.strip():
        where = "WHERE instr(casefold(filename), ?) > 0 OR instr(casefold(executive_summary), ?) > 0 OR instr(casefold(raw_transcript), ?) > 0 OR instr(casefold(action_items), ?) > 0"
        params = [search.strip().casefold()] * 4
    projection = "*" if not compact else "id, filename, substr(executive_summary, 1, 600) AS executive_summary, '' AS raw_transcript, action_items, duration, language, created_at, updated_at"
    connection = get_connection()
    try:
        connection.execute("BEGIN")
        total = connection.execute(f"SELECT COUNT(*) FROM meetings {where}", params).fetchone()[0]
        rows = connection.execute(
            f"SELECT {projection} FROM meetings {where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
        if compact:
            records = []
            for row in rows:
                entry = {key: row[key] for key in ("id", "filename", "executive_summary", "duration", "language", "created_at", "updated_at")}
                record = row_to_meeting(row)
                entry["duration"] = record.duration
                entry["action_item_count"] = len(record.action_items)
                records.append(entry)
        else:
            records = [record.to_dict() for record in (row_to_meeting(row) for row in rows)]
        return {"meetings": records, "count": len(records), "total": total, "limit": limit, "offset": offset,
                "has_more": offset + len(records) < total}
    finally:
        connection.close()


def edit_meeting_speaker(meeting_id, old_name, new_name, segment_index=None):
    """Update only speaker attribution, atomically with transcript/evidence labels."""
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)).fetchone()
        record = row_to_meeting(row)
        if record is None:
            connection.rollback()
            return None
        indices = [i for i, segment in enumerate(record.segments)
                   if isinstance(segment, dict) and segment.get("speaker") == old_name
                   and (segment_index is None or i == segment_index)]
        if not indices:
            connection.rollback()
            return None
        affected_starts = {record.segments[i].get("start") for i in indices}
        for index in indices:
            record.segments[index]["speaker"] = new_name

        def update_evidence(item):
            if isinstance(item, dict) and item.get("speaker") == old_name:
                if segment_index is None or (item.get("start") is not None and item.get("start") in affected_starts):
                    item["speaker"] = new_name
        for items in record.insights.values():
            if isinstance(items, list):
                for item in items:
                    update_evidence(item)
        for message in record.chat_history:
            if isinstance(message, dict) and isinstance(message.get("citations"), list):
                for item in message["citations"]:
                    update_evidence(item)
        # Only rewrite attribution headers, preserving spoken names and manual annotations.
        pattern = re.compile(r"^(\[[^\r\n]*?\][ \t]*)?" + re.escape(old_name) + r":", re.MULTILINE)
        matches = list(pattern.finditer(record.raw_transcript))
        matching_turns = [i for i, segment in enumerate(record.segments)
                          if i in indices or segment.get("speaker") == old_name]
        ordinal = -1
        def replace_header(match):
            nonlocal ordinal
            ordinal += 1
            if segment_index is not None:
                timestamp = str(record.segments[segment_index].get("timestamp") or "").strip()
                same_timestamp = bool(timestamp and (match.group(1) or "").strip() == timestamp)
                same_turn = len(matches) == len(matching_turns) and matching_turns[ordinal] == segment_index
                if not (same_timestamp or same_turn):
                    return match.group(0)
            return (match.group(1) or "") + new_name + ":"
        transcript = pattern.sub(replace_header, record.raw_transcript)
        connection.execute(
            "UPDATE meetings SET segments=?, raw_transcript=?, insights=?, chat_history=?, chat_generation=chat_generation+1, revision=revision+1, review_status='draft', updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (segments_to_json(record.segments), transcript, insights_to_json(record.insights), json.dumps(record.chat_history, ensure_ascii=False), meeting_id),
        )
        connection.commit()
        return get_meeting(meeting_id)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


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
        source_changed = raw_transcript is not None and raw_transcript != existing.raw_transcript
        # Appending manual annotations leaves the timed speech valid. Replacing
        # speech, attribution or turn order removes segments so retrieval uses
        # the edited text rather than stale timed source evidence.
        preserved_segments = existing.segments
        original_source_preserved = bool(existing.raw_transcript.strip() and existing.raw_transcript.strip() in (raw_transcript or ""))
        if source_changed and not original_source_preserved:
            preserved_segments = []
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
                segments = ?,
                insights = ?,
                chat_history = ?,
                chat_generation = chat_generation + ?,
                revision = revision + 1,
                review_status = 'draft',
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
                segments_to_json(preserved_segments),
                insights_to_json(empty_insights() if source_changed else existing.insights),
                json.dumps([] if source_changed else existing.chat_history, ensure_ascii=False),
                int(source_changed),
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
            SET action_items = ?, revision = revision + 1, review_status = 'draft', updated_at = CURRENT_TIMESTAMP
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
    total_tasks = 0
    completed_tasks = 0
    connection = get_connection()
    try:
        connection.execute("BEGIN")
        total_meetings = connection.execute("SELECT COUNT(*) FROM meetings").fetchone()[0]
        total_duration = 0.0
        languages = {r[0] for r in connection.execute("SELECT DISTINCT language FROM meetings WHERE language IS NOT NULL AND language != ''")}
        # Stream task data only, without loading transcripts, segments or chat.
        cursor = connection.execute("SELECT id, '' AS filename, '' AS raw_transcript, '' AS executive_summary, action_items, duration, created_at, updated_at FROM meetings")
        while rows := cursor.fetchmany(200):
            for row in rows:
                record = row_to_meeting(row)
                if record.duration is not None and total_duration is not None:
                    candidate = total_duration + record.duration
                    total_duration = candidate if math.isfinite(candidate) else None
                for item in record.action_items:
                    total_tasks += 1
                    if (item.status or "").lower() in ("completed", "done"):
                        completed_tasks += 1
    finally:
        connection.close()

    pending_tasks = total_tasks - completed_tasks
    completion_rate = round((completed_tasks / max(total_tasks, 1)) * 100, 1)

    return {
        "total_meetings": total_meetings,
        "total_duration_seconds": round(total_duration, 1) if total_duration is not None else None,
        "total_action_items": total_tasks,
        "completed_action_items": completed_tasks,
        "pending_action_items": pending_tasks,
        "completion_rate_percent": completion_rate,
        "detected_languages": list(sorted(languages))
    }
