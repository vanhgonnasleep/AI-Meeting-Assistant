import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "meeting.db"


def get_connection():
    connection = sqlite3.connect(DB_PATH, timeout=15.0, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    connection = get_connection()

    connection.execute("PRAGMA journal_mode=WAL;")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            raw_transcript TEXT,
            executive_summary TEXT,
            action_items TEXT,
            duration REAL,
            language TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Non-destructive migration for existing tables created with older schemas
    cursor = connection.execute("PRAGMA table_info(meetings);")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "duration" not in existing_columns:
        try:
            connection.execute("ALTER TABLE meetings ADD COLUMN duration REAL;")
        except Exception:
            pass  # Column may already exist (concurrent startup race)
    if "language" not in existing_columns:
        try:
            connection.execute("ALTER TABLE meetings ADD COLUMN language TEXT;")
        except Exception:
            pass  # Column may already exist (concurrent startup race)

    connection.commit()
    connection.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized successfully: {DB_PATH}")