import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "meeting.db"

# Columns added after the initial schema. Each entry is applied with a
# non-destructive ALTER TABLE when missing, so existing databases keep their data.
MIGRATION_COLUMNS = {
    "duration": "REAL",
    "language": "TEXT",
    "segments": "TEXT",       # JSON array of timestamped transcript segments
    "insights": "TEXT",       # JSON object: decisions / risks / open_questions
    "chat_history": "TEXT",   # JSON array of persisted Q&A messages
    "chat_generation": "INTEGER NOT NULL DEFAULT 0",
}


def get_connection():
    connection = sqlite3.connect(DB_PATH, timeout=15.0, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.create_function("casefold", 1, lambda value: str(value or "").casefold(), deterministic=True)
    return connection


def init_db():
    connection = get_connection()
    try:
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
                segments TEXT,
                insights TEXT,
                chat_history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Non-destructive migration for existing tables created with older schemas
        cursor = connection.execute("PRAGMA table_info(meetings);")
        existing_columns = {row[1] for row in cursor.fetchall()}
        for column, column_type in MIGRATION_COLUMNS.items():
            if column not in existing_columns:
                try:
                    connection.execute(f"ALTER TABLE meetings ADD COLUMN {column} {column_type};")
                except Exception:
                    pass  # Column may already exist (concurrent startup race)

        connection.execute("CREATE INDEX IF NOT EXISTS idx_meetings_recent ON meetings(created_at DESC, id DESC)")
        connection.commit()
    finally:
        connection.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized successfully: {DB_PATH}")
