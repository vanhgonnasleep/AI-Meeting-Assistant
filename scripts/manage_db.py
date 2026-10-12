#!/usr/bin/env python3
"""
Clarion Workspace & Database Management Utility
Author: Clarion Engineering Team (Lead)

Provides safe, deterministic database hygiene:
  - Backup: Creates timestamped backups in database/backups/
  - Clean: Empties test records for a pristine fresh-user experience
  - Seed: Populates realistic, boardroom-grade demo meetings & projects
  - Reset-Demo: Backs up current DB, cleans, and seeds demo records
  - Restore: Restores database from a previous backup file
  - Status: Prints record counts and table metrics
"""

import argparse
import datetime
import json
import os
import shutil
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_DIR = REPO_ROOT / "database"
DB_FILE = DB_DIR / "meeting.db"
BACKUP_DIR = DB_DIR / "backups"

# Ensure database directory exists
DB_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def get_db_connection():
    conn = sqlite3.connect(DB_FILE, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.create_function("casefold", 1, lambda val: str(val or "").casefold(), deterministic=True)
    return conn


def ensure_schema(conn):
    """Ensures tables, columns, and indexes exist according to system schema."""
    conn.execute("""
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
            chat_generation INTEGER NOT NULL DEFAULT 0,
            revision INTEGER NOT NULL DEFAULT 0,
            review_status TEXT NOT NULL DEFAULT 'draft',
            project_id INTEGER,
            save_key TEXT,
            save_digest TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_meetings_recent ON meetings(created_at DESC, id DESC)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_save_key ON meetings(save_key) WHERE save_key IS NOT NULL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_key TEXT NOT NULL UNIQUE
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id, created_at DESC, id DESC)")
    conn.commit()


def backup_database():
    """Creates a timestamped copy of meeting.db."""
    if not DB_FILE.exists():
        print(f"[!] Database file does not exist yet: {DB_FILE}")
        return None

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"meeting_backup_{timestamp}.db"
    
    # Use SQLite backup API for online safe copy
    src = sqlite3.connect(DB_FILE)
    dst = sqlite3.connect(backup_file)
    src.backup(dst)
    src.close()
    dst.close()

    size_kb = backup_file.stat().st_size / 1024
    print(f"[OK] Backup created successfully: {backup_file} ({size_kb:.1f} KB)")
    return backup_file


def get_status():
    """Prints current database statistics."""
    if not DB_FILE.exists():
        print(f"Database file does not exist at {DB_FILE}")
        return

    conn = get_db_connection()
    ensure_schema(conn)

    meeting_count = conn.execute("SELECT count(*) FROM meetings").fetchone()[0]
    project_count = conn.execute("SELECT count(*) FROM projects").fetchone()[0]
    recent = conn.execute("SELECT id, filename, duration, review_status, created_at FROM meetings ORDER BY id DESC LIMIT 5").fetchall()
    conn.close()

    size_kb = DB_FILE.stat().st_size / 1024
    print("=" * 60)
    print(f"CLARION DATABASE STATUS: {DB_FILE.name} ({size_kb:.1f} KB)")
    print(f"  * Total Meetings: {meeting_count}")
    print(f"  * Total Projects: {project_count}")
    if recent:
        print("\n  Recent Records:")
        for r in recent:
            dur = f"{int(r['duration'])}s" if r['duration'] else "N/A"
            print(f"    - [{r['id']}] {r['filename'][:45]:<45} | {dur:<6} | {r['review_status']:<8} | {r['created_at']}")
    else:
        print("  * Records: (Workspace is empty)")
    print("=" * 60)


def clean_database(perform_backup=True):
    """Wipes all meetings and projects, resetting auto-increment sequences."""
    if perform_backup and DB_FILE.exists():
        backup_database()

    conn = get_db_connection()
    ensure_schema(conn)
    conn.execute("DELETE FROM meetings")
    conn.execute("DELETE FROM projects")
    try:
        conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('meetings', 'projects')")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    print("[OK] Database cleaned: All meetings and projects wiped to pristine state.")


def seed_database():
    """Seeds 3 realistic, boardroom-grade meetings and 2 projects."""
    conn = get_db_connection()
    ensure_schema(conn)

    # 1. Projects
    conn.execute("INSERT OR IGNORE INTO projects (id, name, name_key) VALUES (1, 'Clarion Core Platform', 'clarion core platform')")
    conn.execute("INSERT OR IGNORE INTO projects (id, name, name_key) VALUES (2, 'Enterprise Compliance', 'enterprise compliance')")
    conn.commit()

    # 2. Meeting 1: Bundled Audio WAV Meeting (Exact match to public/q3_product_budget_review.wav)
    m1_filename = "q3_product_budget_review.wav"
    m1_duration = 29.05
    m1_segments = [
        {
            "id": 1, "start": 0.0, "end": 11.3, "timestamp": "[00:00 - 00:11]", "speaker": "Speaker A",
            "text": "Welcome everyone. We need to finalize the marketing budget for Q3 today. I propose an allocation of $50,000 for targeted social media ad campaigns."
        },
        {
            "id": 2, "start": 12.0, "end": 22.3, "timestamp": "[00:12 - 00:22]", "speaker": "Speaker B",
            "text": "That budget sounds reasonable and matches our projections. Let's lock it in. Can you prepare the detailed financial report by Friday, John?"
        },
        {
            "id": 3, "start": 23.0, "end": 28.5, "timestamp": "[00:23 - 00:28]", "speaker": "Speaker A",
            "text": "Will do. I'll have the complete breakdown ready by Friday afternoon."
        }
    ]
    m1_raw = "\n".join(f"{s['speaker']}: {s['text']}" for s in m1_segments)
    m1_summary = (
        "### Executive Summary\n\n"
        "The leadership team finalized the Q3 operational budget and marketing allocations.\n\n"
        "**Key Decisions & Commitments:**\n"
        "- **Budget Allocation:** Officially approved **$50,000** for targeted social media acquisition campaigns.\n"
        "- **Financial Deliverable:** John (Speaker A) committed to delivering the detailed financial breakdown by Friday afternoon.\n"
        "- **Execution Alignment:** Budget matches internal quarterly forecasts with full committee buy-in."
    )
    m1_action_items = [
        {"task": "Prepare and submit detailed Q3 financial report", "assignee": "John (Speaker A)", "deadline": "Friday afternoon", "status": "completed"},
        {"task": "Launch targeted social media ad campaigns", "assignee": "Marketing Team", "deadline": "Q3 Start", "status": "pending"}
    ]
    m1_insights = {
        "decisions": [
            {"text": "Q3 marketing budget locked at $50,000 for targeted social media ad campaigns.", "speaker": "Speaker B", "timestamp": "00:12", "start": 12.0, "status": "approved"},
            {"text": "John owns the detailed financial breakdown, committed for Friday afternoon.", "speaker": "Speaker A", "timestamp": "00:23", "start": 23.0, "status": "approved"}
        ],
        "risks": [
            {"text": "Campaign execution depends on the financial report landing by Friday — a slip delays the Q3 launch.", "speaker": "Speaker B", "timestamp": "00:12", "start": 12.0},
            {"text": "Budget approval relies on current projections; no contingency buffer was discussed.", "speaker": "Speaker B", "timestamp": "00:12", "start": 12.0}
        ],
        "open_questions": [
            {"text": "How will the $50,000 be split across social channels, and which KPIs define success?", "speaker": "Speaker A", "timestamp": "00:00", "start": 0.0},
            {"text": "Who is accountable for running the campaigns once the budget is released?", "speaker": "Speaker A", "timestamp": "00:00", "start": 0.0}
        ]
    }
    m1_chat = [
        {"role": "user", "content": "What budget was approved for marketing in Q3?"},
        {
            "role": "assistant",
            "content": "The team officially approved **$50,000** for targeted social media ad campaigns in Q3 [00:00]. Speaker B confirmed it matches forecasts and locked it in [00:12].",
            "citations": [{"speaker": "Speaker A", "timestamp": "00:00", "start": 0.0, "text": "I propose an allocation of $50,000 for targeted social media ad campaigns."}]
        }
    ]

    # 2. Meeting 2: Clarion Q4 Architecture & Streaming Sync
    m2_filename = "Clarion_Q4_Architecture_Sync.mp3"
    m2_duration = 1380.0
    m2_segments = [
        {
            "id": 1, "start": 0.0, "end": 165.0, "timestamp": "[00:00 - 02:45]", "speaker": "Alex Rivera",
            "text": "Good morning team. Today our objective is to review Clarion's core streaming pipeline and address the latency bottleneck we observed during high-concurrency ingestion tests."
        },
        {
            "id": 2, "start": 166.0, "end": 372.0, "timestamp": "[02:46 - 06:12]", "speaker": "Liam Chen",
            "text": "Under heavy payload bursts, buffering raw audio chunks in memory was causing GC spikes. We refactored the chunk handler to stream direct binary frames over WebSocket with backpressure flow control."
        },
        {
            "id": 3, "start": 373.0, "end": 630.0, "timestamp": "[06:13 - 10:30]", "speaker": "Sarah Vance",
            "text": "On the storage side, switching SQLite to Write-Ahead Logging (WAL) and setting the busy timeout to 15 seconds eliminated the database lock contention we saw when multiple background tasks wrote simultaneously."
        },
        {
            "id": 4, "start": 631.0, "end": 940.0, "timestamp": "[10:31 - 15:40]", "speaker": "Alex Rivera",
            "text": "Excellent. With WAL enabled, our p95 write latency dropped from 120ms to under 24ms. Let's make sure the migration script executes cleanly on legacy database instances."
        },
        {
            "id": 5, "start": 941.0, "end": 1215.0, "timestamp": "[15:41 - 20:15]", "speaker": "Liam Chen",
            "text": "The regression suite is passing across all 216 test cases. I'll package the benchmark suite so Alex can test on Intel and Apple Silicon hardware by next Monday."
        },
        {
            "id": 6, "start": 1216.0, "end": 1380.0, "timestamp": "[20:16 - 23:00]", "speaker": "Alex Rivera",
            "text": "Agreed. Let's lock this in as our baseline architecture for the upcoming final defense demonstration."
        }
    ]
    m2_raw = "\n".join(f"{s['speaker']}: {s['text']}" for s in m2_segments)
    m2_summary = (
        "### Clarion Architecture Sync: Streaming & Storage Latency\n\n"
        "Technical review of real-time audio chunk processing and concurrent database write performance.\n\n"
        "**Architectural Achievements:**\n"
        "- **WebSocket Binary Streaming:** Transitioned from HTTP chunk buffering to WebSocket binary streaming with backpressure flow control.\n"
        "- **SQLite Concurrency Optimization:** Configured Write-Ahead Logging (WAL) with 15-second busy timeout handlers, reducing p95 write latency from **120ms to 24ms**.\n"
        "- **Regression Verification:** Verified 100% green status across 216 test cases in the backend test suite."
    )
    m2_action_items = [
        {"task": "Implement WebSocket chunk streaming backpressure guard in FastAPI", "assignee": "Liam Chen", "deadline": "Sprint 4", "status": "completed"},
        {"task": "Enable SQLite WAL mode and tune busy_timeout to 15s across worker pools", "assignee": "Sarah Vance", "deadline": "Oct 18", "status": "completed"},
        {"task": "Benchmark p95 latency under 5 concurrent audio streams on target defense laptops", "assignee": "Alex Rivera", "deadline": "Next Monday", "status": "pending"}
    ]
    m2_insights = {
        "decisions": [
            {"text": "Adopted WebSocket binary streaming with backpressure flow control for real-time audio chunking.", "speaker": "Liam Chen", "timestamp": "02:46", "start": 166.0, "status": "approved"},
            {"text": "Standardized SQLite WAL mode and 15s busy timeout across all concurrent service connections.", "speaker": "Sarah Vance", "timestamp": "06:13", "start": 373.0, "status": "approved"}
        ],
        "risks": [
            {"text": "Legacy databases missing the WAL pragma could hit locking errors if updated during active transcription.", "speaker": "Alex Rivera", "timestamp": "10:31", "start": 631.0}
        ],
        "open_questions": [
            {"text": "What is the memory threshold on systems with 8GB RAM when handling 10+ concurrent meeting tabs?", "speaker": "Liam Chen", "timestamp": "15:41", "start": 941.0}
        ]
    }
    m2_chat = []

    # 3. Meeting 3: Executive Strategy 2026 Enterprise Readiness
    m3_filename = "Executive_Strategy_2026_Enterprise_Readiness.mp3"
    m3_duration = 2100.0
    m3_segments = [
        {
            "id": 1, "start": 0.0, "end": 320.0, "timestamp": "[00:00 - 05:20]", "speaker": "Marcus Vance",
            "text": "Welcome everyone. Today's executive review centers on Clarion's enterprise security posture and our zero-cloud, privacy-first commitment for enterprise deployments."
        },
        {
            "id": 2, "start": 321.0, "end": 760.0, "timestamp": "[05:21 - 12:40]", "speaker": "Elena Rostova",
            "text": "Enterprise legal and compliance teams require full proof that internal meeting audio, transcripts, and decision memos never leave the local boundary. Our local Whisper and Ollama pipeline satisfies these zero-retention criteria."
        },
        {
            "id": 3, "start": 761.0, "end": 1335.0, "timestamp": "[12:41 - 22:15]", "speaker": "David Kim",
            "text": "From a product adoption standpoint, hospital systems and legal firms cite privacy as the primary reason for rejecting cloud SaaS like Otter or Copilot. Clarion's on-device execution is our core differentiator."
        },
        {
            "id": 4, "start": 1336.0, "end": 1770.0, "timestamp": "[22:16 - 29:30]", "speaker": "Marcus Vance",
            "text": "We must ensure our documentation highlights SOC 2 Type II compatibility and air-gapped container readiness before next month's advisory board meeting."
        },
        {
            "id": 5, "start": 1771.0, "end": 2100.0, "timestamp": "[29:31 - 35:00]", "speaker": "Elena Rostova",
            "text": "I will deliver the complete data retention audit package by November 1st, alongside the model verification checksums."
        }
    ]
    m3_raw = "\n".join(f"{s['speaker']}: {s['text']}" for s in m3_segments)
    m3_summary = (
        "### Enterprise Strategy: Zero-Cloud Privacy & SOC 2 Compliance\n\n"
        "Executive alignment on Clarion's core competitive positioning as an on-premises, privacy-first alternative to cloud transcription SaaS.\n\n"
        "**Strategic Key Takeaways:**\n"
        "- **Privacy-First Market Differentiator:** Regulated verticals (legal, healthcare, financial audit) require local AI execution without cloud data egress.\n"
        "- **Zero-Retention Assurance:** Local Whisper and Ollama inference guaranteed 100% on-device data sovereignty.\n"
        "- **Enterprise Deliverables:** Legal audit documentation and model SHA-256 verification package assigned for Nov 1."
    )
    m3_action_items = [
        {"task": "Finalize SOC 2 Type II air-gapped data retention protocol documentation", "assignee": "Elena Rostova", "deadline": "Nov 01", "status": "pending"},
        {"task": "Audit local Ollama model integrity signatures against internal hashes", "assignee": "David Kim", "deadline": "Nov 05", "status": "pending"},
        {"task": "Prepare executive slide deck for board presentation on zero-cloud privacy architecture", "assignee": "Marcus Vance", "deadline": "Oct 25", "status": "completed"}
    ]
    m3_insights = {
        "decisions": [
            {"text": "Approved positioning Clarion strictly as an on-device, zero-cloud privacy solution for regulated industries.", "speaker": "Marcus Vance", "timestamp": "00:00", "start": 0.0, "status": "approved"},
            {"text": "Mandated local model hash verification before enterprise bundle deployment.", "speaker": "Elena Rostova", "timestamp": "29:31", "start": 1771.0, "status": "approved"}
        ],
        "risks": [
            {"text": "Without automated checksum validation, users might inadvertently download unverified third-party weights.", "speaker": "David Kim", "timestamp": "12:41", "start": 761.0}
        ],
        "open_questions": [
            {"text": "Will enterprise clients require LDAP/Active Directory integration for team multi-tenancy in future releases?", "speaker": "David Kim", "timestamp": "22:16", "start": 1336.0}
        ]
    }
    m3_chat = []

    meetings_to_insert = [
        (m1_filename, m1_raw, m1_summary, json.dumps(m1_action_items), m1_duration, "en", json.dumps(m1_segments), json.dumps(m1_insights), json.dumps(m1_chat), 1, "reviewed"),
        (m2_filename, m2_raw, m2_summary, json.dumps(m2_action_items), m2_duration, "en", json.dumps(m2_segments), json.dumps(m2_insights), json.dumps(m2_chat), 1, "reviewed"),
        (m3_filename, m3_raw, m3_summary, json.dumps(m3_action_items), m3_duration, "en", json.dumps(m3_segments), json.dumps(m3_insights), json.dumps(m3_chat), 2, "reviewed"),
    ]

    for m in meetings_to_insert:
        conn.execute("""
            INSERT INTO meetings (
                filename, raw_transcript, executive_summary, action_items,
                duration, language, segments, insights, chat_history,
                project_id, review_status, revision
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, m)

    conn.commit()
    conn.close()
    print("[OK] Seed completed: 3 pristine showcase meetings and 2 projects populated.")


def reset_demo():
    """One-shot command: Backs up existing records, wipes database, and seeds demo records."""
    print("\n--- Resetting Clarion Workspace to Clean Demo State ---")
    clean_database(perform_backup=True)
    seed_database()
    print("\n[OK] Clarion Workspace is now in 100% board-ready showcase state!\n")
    get_status()


def restore_backup(backup_path_str):
    """Restores database from a specified backup file."""
    backup_file = Path(backup_path_str)
    if not backup_file.exists():
        print(f"[ERROR] Backup file not found: {backup_file}")
        sys.exit(1)

    print(f"Restoring database from: {backup_file}")
    backup_database()  # Backup current state before restoring
    
    src = sqlite3.connect(backup_file)
    dst = sqlite3.connect(DB_FILE)
    src.backup(dst)
    src.close()
    dst.close()
    print(f"[OK] Restored successfully from {backup_file}")
    get_status()


def main():
    parser = argparse.ArgumentParser(description="Clarion Database & Workspace Manager")
    parser.add_argument("--status", action="store_true", help="Display current database statistics")
    parser.add_argument("--backup", action="store_true", help="Create a timestamped backup of the current database")
    parser.add_argument("--clean", action="store_true", help="Wipe all meeting and project records (fresh user state)")
    parser.add_argument("--seed", action="store_true", help="Seed pristine demo meetings and projects")
    parser.add_argument("--reset-demo", action="store_true", help="Backup, clean, and seed 3 pristine demo meetings")
    parser.add_argument("--restore", type=str, metavar="FILE", help="Restore database from a backup file")

    args = parser.parse_args()

    if args.status:
        get_status()
    elif args.backup:
        backup_database()
    elif args.clean:
        clean_database(perform_backup=True)
    elif args.seed:
        seed_database()
    elif args.reset_demo:
        reset_demo()
    elif args.restore:
        restore_backup(args.restore)
    else:
        # Default behavior if run without flags: print status and instructions
        get_status()
        print("\nAvailable commands:")
        print("  py scripts/manage_db.py --status      (View current database records)")
        print("  py scripts/manage_db.py --backup      (Create timestamped backup)")
        print("  py scripts/manage_db.py --clean       (Wipe all records to fresh state)")
        print("  py scripts/manage_db.py --seed        (Seed pristine showcase meetings)")
        print("  py scripts/manage_db.py --reset-demo  (Backup + Clean + Seed in 1 step)")
        print("  py scripts/manage_db.py --restore <f> (Restore from backup file)")


if __name__ == "__main__":
    main()
