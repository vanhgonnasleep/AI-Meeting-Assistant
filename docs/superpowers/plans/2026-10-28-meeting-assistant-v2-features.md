# AI Meeting Assistant v2: Enterprise Feature Expansion Plan

> **Goal:** Upgrade the AI Meeting Assistant with 5 key enterprise features: Agent 4 Glossary Resolver, Incremental Speaker Clustering UI & Confidence, Bi-directional Linking, Cross-Meeting RAG, and Corporate Export (.docx & LAN Share).
> **Architecture Principle:** 100% Local, zero-leak privacy, strict backward compatibility, preserving all 168 UI tests and 430+ backend tests.

---

## Task Map & Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1 (Sprint 1): Core Intelligence & Document Workspace Linking    │
├────────────────────────────────────────────────────────────────────────┤
│ [Task 1] Agent 4: Glossary & Acronym Resolver (pipeline/glossary.py)   │
│ [Task 2] Speaker Profile Management API & Confidence Tracking           │
│ [Task 3] Bi-directional Hover Linking (Summary/Decisions ↔ Transcript) │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2 (Sprint 2): Knowledge Synthesis & Corporate Delivery           │
├────────────────────────────────────────────────────────────────────────┤
│ [Task 4] Cross-Meeting RAG (Global Library RAG over SQLite FTS5)        │
│ [Task 5] Corporate Export Engine (.docx Meeting Minutes & Notion .md)  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3 (Sprint 3): Network Sharing & Live Streaming Ingestion         │
├────────────────────────────────────────────────────────────────────────┤
│ [Task 6] Local Web Share (Capability Token + Read-Only LAN Portal + QR)│
│ [Task 7] Real-time Rolling Audio Ingestion & Live Captioning           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Task Breakdown

### Task 1: Agent 4 — Glossary & Acronym Resolver
- **Files to create/modify:**
  - `ai-summary-service/app/fixtures/default_glossary.json`: Baseline Vietnamese/English IT, business, and acronym mappings (e.g., "zi ra" -> "Jira", "ba bồ" -> "Bubble", "ku bơ nét" -> "Kubernetes", "tét xơ" -> "Tester", "pi ô" -> "PO", "sờ cram" -> "Scrum").
  - `ai-summary-service/app/pipeline/glossary.py`: Regex boundary matcher + normalized Levenshtein sliding n-gram fuzzy phonetic matcher.
  - `ai-summary-service/app/main.py`: Inject `resolve_glossary_terms(segments)` right after STT diarization and before MMR / Agent 2 / Agent 3.
  - `ai-summary-service/tests/test_glossary.py`: Pytest suite testing exact match, case insensitivity, boundary protection, and segment mutation.
- **Verification:** Run `pytest ai-summary-service/tests/test_glossary.py`.

### Task 2: Incremental Speaker Clustering Registry & Confidence Badges
- **Files to create/modify:**
  - `database/voiceprints.py`: Enhance `match_speaker_profile` to return `(matched_name, similarity_score)`. Add `delete_speaker_profile(profile_id)`.
  - `ai-summary-service/app/pipeline/transcription.py`: Decorate segments with `speaker_confidence` (0.00-1.00) and `speaker_auto_identified: bool`.
  - `ai-summary-service/app/main.py`: Add `GET /api/speaker-profiles` and `DELETE /api/speaker-profiles/{profile_id}`.
  - `meeting-assistant-ui/src/components/TranscriptReview.jsx`: Render confidence pill (e.g. `🎯 Auto-ID 88%`) next to automatically enrolled speakers.
  - `ai-summary-service/tests/test_speaker_profiles.py`: Backend test verifying profile enrollment, running centroid calculation, and delete API.
- **Verification:** Run pytest for speaker profile endpoints and `npm --prefix meeting-assistant-ui test`.

### Task 3: Bi-directional Linking (Executive Summary / Decisions ↔ Transcript)
- **Files to create/modify:**
  - `ai-summary-service/app/pipeline/summarization.py`: Add `align_summary_bullet_provenance(summary_text, segments)` that maps each bullet to 1-2 source segments using cosine TF-IDF overlap.
  - `ai-summary-service/app/pipeline/insights.py`: Ensure `decisions` and `risks` output canonical `source_segment_ids`.
  - `meeting-assistant-ui/src/components/DocumentWorkspace.jsx`: Add shared hover state `hoveredSourceSegmentIds`.
  - `meeting-assistant-ui/src/components/TranscriptReview.jsx`: Highlight matching `#segment-{id}` card with amber ring and smooth scroll on hover.
  - `meeting-assistant-ui/src/features/meetings/session.js`: Support bi-directional citation mapping.
- **Verification:** Run frontend tests to ensure no regressions in DocumentWorkspace.

### Task 4: Cross-Meeting RAG (Global Library Search in Clarion Assistant)
- **Files to create/modify:**
  - `ai-summary-service/app/pipeline/chat.py`: Implement `answer_global_library_question` using SQLite FTS5 `meetings_fts` ranking followed by segment-level RRF retrieval.
  - `ai-summary-service/app/main.py`: Add `POST /api/chat/global` endpoint with optional `project_id` filter.
  - `meeting-assistant-ui/src/components/ChatDrawer.jsx`: Add toggle switch: `[Cuộc họp này | Toàn bộ thư viện (Global)]`. Render citation badge with `[Meeting Title · MM:SS]` clickable to load meeting and seek audio.
  - `ai-summary-service/tests/test_cross_meeting_rag.py`: Unit test verifying FTS5 meeting filtering and cross-meeting citation formatting.
- **Verification:** Run backend chat tests and frontend test suite.

### Task 5: Corporate Export Engine (.docx Meeting Minutes & Notion .md)
- **Files to create/modify:**
  - `ai-summary-service/app/pipeline/exporter.py`: Build corporate `.docx` generator using `python-docx` (with header metadata table, executive summary, bordered action items table with checkmarks, and signature block).
  - `ai-summary-service/app/main.py`: Add endpoint `GET /api/meetings/{id}/export/docx`.
  - `meeting-assistant-ui/src/components/DocumentWorkspace.jsx`: Add `.docx` download button and "Copy Notion Markdown" option.
  - `ai-summary-service/tests/test_export.py`: Backend test ensuring `.docx` binary generation without corruption.
- **Verification:** Test export route directly via pytest.

### Task 6: Local Web Share (LAN Read-Only Viewer + QR Code)
- **Files to create/modify:**
  - `database/db.py`: Create table `meeting_shares(token TEXT PRIMARY KEY, meeting_id INTEGER, expires_at TIMESTAMP, revoked INTEGER DEFAULT 0)`.
  - `database/crud.py`: Functions `create_meeting_share(meeting_id, hours_valid=24)`, `get_shared_meeting(token)`, `revoke_meeting_share(token)`.
  - `ai-summary-service/app/api/share.py` & `ai-summary-service/app/main.py`: Public read-only endpoint `GET /api/share/{token}`.
  - `meeting-assistant-ui/src/components/ShareModal.jsx`: Modal displaying LAN URL (`http://<LAN-IP>:8002/share/<token>`) and clean SVG QR Code.
  - Frontend standalone read-only view `#share/<token>`.
- **Verification:** End-to-end token validation test and frontend unit test.

### Task 7: Real-time Rolling Audio Ingestion
- **Files to create/modify:**
  - `meeting-assistant-ui/src/features/recording/recording.js`: Add sliced PCM chunk streaming option via AudioContext.
  - `ai-summary-service/app/main.py`: Add `/api/live-sessions/chunk` and `/api/live-sessions/finalize`.
- **Verification:** Full pipeline verification.
