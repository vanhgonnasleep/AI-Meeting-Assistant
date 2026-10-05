"""Atomic workspace edits and bounded scans over task/decision columns."""
import json
import sqlite3

from .db import get_connection
from .crud import row_to_meeting, action_items_to_json, _load_json_column
from .models import empty_insights, INSIGHT_CATEGORIES


class WorkspaceError(Exception):
    def __init__(self, status_code, message):
        self.status_code = status_code
        super().__init__(message)


def _guard_record(connection, meeting_id, expected_revision):
    record = row_to_meeting(connection.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone())
    if record is None:
        raise WorkspaceError(404, "Meeting not found.")
    if record.revision != expected_revision:
        raise WorkspaceError(409, "Meeting changed. Reload the latest version before saving.")
    return record


def source_snapshot(meeting_id, expected_revision):
    connection = get_connection()
    try:
        return _guard_record(connection, meeting_id, expected_revision)
    finally:
        connection.close()


def _transcript_from_segments(segments):
    lines = []
    for segment in segments:
        text = segment.get("text", "")
        timestamp = segment.get("timestamp") or ""
        speaker = segment.get("speaker") or ""
        prefix = " ".join(str(value).strip() for value in (timestamp, f"{speaker}:" if speaker else "") if value)
        lines.append(f"{prefix} {text}".strip() if prefix else text)
    return "\n".join(lines)


def _edited_insights(value):
    normalized = empty_insights()
    for category in INSIGHT_CATEGORIES:
        normalized[category] = [dict(item) for item in value.get(category, [])]
    for decision in normalized["decisions"]:
        decision.setdefault("status", "proposed")
    return normalized


def review_meeting(meeting_id, expected_revision, review_status, **changes):
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        record = _guard_record(connection, meeting_id, expected_revision)
        before = record.to_dict()
        if "segments" in changes:
            segments = changes["segments"]
            # Re-submitting unchanged turns must preserve manual transcript
            # annotations and must still allow explicit human review.
            if segments != record.segments:
                record.segments = segments
                record.raw_transcript = _transcript_from_segments(segments)
            elif not segments and "raw_transcript" in changes:
                record.raw_transcript = changes["raw_transcript"]
        elif "raw_transcript" in changes and changes["raw_transcript"] != record.raw_transcript:
            record.raw_transcript = changes["raw_transcript"]
            record.segments = []
        source_changed = record.raw_transcript != before["raw_transcript"] or record.segments != before["segments"]
        if source_changed:
            record.insights = empty_insights()
            record.chat_history = []
            record.chat_generation += 1
        if "executive_summary" in changes:
            record.executive_summary = changes["executive_summary"]
        if "action_items" in changes:
            record.action_items = changes["action_items"]
        if "insights" in changes:
            record.insights = _edited_insights(changes["insights"])
        after = record.to_dict()
        content_changed = source_changed or any(before[key] != after[key] for key in ("executive_summary", "action_items", "insights"))
        record.review_status = "draft" if content_changed else review_status
        if content_changed or record.review_status != before["review_status"]:
            connection.execute("""UPDATE meetings SET raw_transcript=?, segments=?, executive_summary=?, action_items=?,
                insights=?, chat_history=?, chat_generation=?, revision=revision+1, review_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""", (
                record.raw_transcript, json.dumps(record.segments, ensure_ascii=False), record.executive_summary,
                action_items_to_json(record.action_items), json.dumps(record.insights, ensure_ascii=False),
                json.dumps(record.chat_history, ensure_ascii=False), record.chat_generation, record.review_status, meeting_id,
            ))
        result = row_to_meeting(connection.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone())
        connection.commit()
        return result
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def save_regenerated_summary(meeting_id, expected_revision, summary):
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        _guard_record(connection, meeting_id, expected_revision)
        connection.execute("UPDATE meetings SET executive_summary=?, revision=revision+1, review_status='draft', updated_at=CURRENT_TIMESTAMP WHERE id=?", (summary, meeting_id))
        result = row_to_meeting(connection.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone())
        connection.commit()
        return result
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def task_page(q=None, status=None, assignee=None, project_id=None, limit=50, offset=0):
    needle = (q or "").strip().casefold()
    owner = (assignee or "").strip().casefold()
    rows, total = [], 0
    connection = get_connection()
    try:
        connection.execute("BEGIN")
        where = " WHERE project_id=?" if project_id is not None else ""
        params = [project_id] if project_id is not None else []
        cursor = connection.execute("SELECT id, filename, revision, project_id, action_items, created_at, updated_at, '' AS raw_transcript, '' AS executive_summary FROM meetings" + where + " ORDER BY created_at DESC, id DESC", params)
        while batch := cursor.fetchmany(200):
            for row in batch:
                for index, item in enumerate(row_to_meeting(row).action_items):
                    task = item.to_dict()
                    if needle and not any(needle in str(task[key] or "").casefold() for key in ("task", "assignee", "deadline")):
                        continue
                    if status and str(item.status or "pending").casefold() != status:
                        continue
                    if owner and str(item.assignee or "Unassigned").strip().casefold() != owner:
                        continue
                    if offset <= total < offset + limit:
                        rows.append({"meeting_id": row["id"], "filename": row["filename"], "revision": row["revision"], "project_id": row["project_id"], "task_idx": index, **task})
                    total += 1
        return {"tasks": rows, "total": total, "has_more": offset + len(rows) < total, "offset": offset, "limit": limit}
    finally:
        connection.close()


def projects():
    connection = get_connection()
    try:
        rows = connection.execute("SELECT p.id, p.name, COUNT(m.id) AS meeting_count FROM projects p LEFT JOIN meetings m ON m.project_id=p.id GROUP BY p.id ORDER BY p.name_key, p.id").fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def create_project(name):
    name = name.strip()
    connection = get_connection()
    try:
        cursor = connection.execute("INSERT INTO projects (name,name_key) VALUES (?,?)", (name, name.casefold()))
        connection.commit()
        return {"id": cursor.lastrowid, "name": name, "meeting_count": 0}
    except sqlite3.IntegrityError as exc:
        connection.rollback()
        raise WorkspaceError(409, "A project with that name already exists.") from exc
    finally:
        connection.close()


def assign_project(meeting_id, expected_revision, project_id):
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        _guard_record(connection, meeting_id, expected_revision)
        if project_id is not None and connection.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone() is None:
            raise WorkspaceError(404, "Project not found.")
        connection.execute("UPDATE meetings SET project_id=?, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=?", (project_id, meeting_id))
        record = row_to_meeting(connection.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone())
        connection.commit()
        return record
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def timeline_page(project_id, limit=50, offset=0):
    entries, total = [], 0
    connection = get_connection()
    try:
        connection.execute("BEGIN")
        if connection.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone() is None:
            raise WorkspaceError(404, "Project not found.")
        cursor = connection.execute("SELECT id, filename, created_at, revision, review_status, insights FROM meetings WHERE project_id=? ORDER BY created_at DESC, id DESC", (project_id,))
        while batch := cursor.fetchmany(200):
            for row in batch:
                decisions = _load_json_column(row, "insights", {}).get("decisions", [])
                decisions = decisions if isinstance(decisions, list) else []
                for index, decision in enumerate(item for item in decisions if isinstance(item, dict)):
                    if offset <= total < offset + limit:
                        entry = {"meeting_id": row["id"], "filename": row["filename"], "created_at": row["created_at"], "revision": row["revision"], "review_status": row["review_status"], "decision_idx": index, "text": str(decision.get("text") or ""), "status": decision.get("status") or "proposed"}
                        entry.update({key: decision[key] for key in ("timestamp", "speaker", "start", "end") if key in decision})
                        entries.append(entry)
                    total += 1
        return {"entries": entries, "total": total, "has_more": offset + len(entries) < total, "offset": offset, "limit": limit}
    finally:
        connection.close()
