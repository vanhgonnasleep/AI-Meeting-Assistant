"""Local Network Share & Capability-Token Isolation for Meetings.

Allows ephemeral read-only sharing of meeting summaries and transcripts to
collaborators on the local Wi-Fi/LAN without exposing private account credentials.
"""
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from .db import get_connection
from .crud import get_meeting, row_to_meeting


def init_shares_schema() -> None:
    """Ensures the meeting_shares table exists."""
    connection = get_connection()
    try:
        connection.execute("""
        CREATE TABLE IF NOT EXISTS meeting_shares (
            token TEXT PRIMARY KEY,
            meeting_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            revoked INTEGER DEFAULT 0
        );
        """)
        connection.commit()
    finally:
        connection.close()


# Ensure table is initialized on module load
init_shares_schema()


def create_share_token(meeting_id: int, hours_valid: int = 24) -> Dict[str, Any]:
    """Generates an unguessable 256-bit URL-safe token valid for a specific duration."""
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(hours=hours_valid)).isoformat(timespec="seconds")

    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "INSERT INTO meeting_shares (token, meeting_id, expires_at, revoked) VALUES (?, ?, ?, 0)",
            (token, meeting_id, expires_at)
        )
        connection.commit()
        return {
            "token": token,
            "meeting_id": meeting_id,
            "expires_at": expires_at,
            "hours_valid": hours_valid
        }
    finally:
        connection.close()


def get_shared_meeting(token: str) -> Optional[Any]:
    """Retrieves the meeting record if token is valid, active, and unexpired."""
    if not token or not isinstance(token, str):
        return None

    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT meeting_id, expires_at, revoked FROM meeting_shares WHERE token = ?",
            (token,)
        ).fetchone()
        if not row:
            return None

        if row["revoked"]:
            return None

        try:
            expires = datetime.fromisoformat(row["expires_at"])
            if datetime.now() > expires:
                return None
        except Exception:
            return None

        meeting_id = row["meeting_id"]
    finally:
        connection.close()

    return get_meeting(meeting_id)


def revoke_share_token(token: str) -> bool:
    """Revokes an existing share token immediately."""
    connection = get_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        cursor = connection.execute(
            "UPDATE meeting_shares SET revoked = 1 WHERE token = ?",
            (token,)
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()
