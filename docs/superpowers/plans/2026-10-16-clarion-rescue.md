# Clarion rescue implementation plan

**Goal:** Complete the user's nine-task Master Prompt sequentially on the three named branches, then merge locally into main after regression checks.

**Architecture:** Preserve existing APIs and storage. Add an external-content FTS5 index, a shared grounded chat event generator, deterministic deadline parsing, acoustic profile matching and an in-memory chunk decoder. Keep library filtering on the server so pagination remains correct.

**Spec:** The Master Sequential Execution Prompt supplied in this chat on 2026-10-16.

**Execution:** Inline, sequential execution authorized by the user's “làm đi”. Existing checkout and explicitly named branches are used. Preserve the pre-existing benchmark edit in a named stash and temporary backup; regenerate the report only at final acceptance. No remote push is requested.

## Constraints and review focus

- Preserve source grounding, chat-generation guards, upload limits and existing endpoints.
- Migrate existing databases without deleting meetings; rebuild FTS once when first created.
- Literal punctuation searches must not become FTS operators or SQL wildcards.
- Stream interruption must not persist a partial answer or silently combine a fallback with partial LLM text.
- Ambiguous sprint dates remain null without an explicit sprint end date.
- Voiceprints use named enrollment, finite vectors and cosine > 0.82; acoustic centroids are approximate identification.
- Apply library filters before counting, sorting and paginating, with stable tie breaks.

## Phase 1 — feat/be-streaming-fts

- [ ] Write and run failing tests for legacy FTS rebuild, insert/update/delete sync, punctuation fallback and pagination.
- [ ] Implement database/db.py and database/crud.py FTS migration/search.
- [ ] Write and run failing tests for live token delivery, citations, interrupted upstream, and saved-history generation conflicts.
- [ ] Implement shared chat events in meeting_chat.py and POST /api/chat/stream with StreamingResponse in main.py; include stream routes in compute limits.
- [ ] Add Dockerfile.backend, Dockerfile.frontend, compose, nginx and dockerignore. Host persistence uses a data directory, model cache volume and host Ollama URL.
- [ ] Run backend suite and commit phase.

## Phase 2 — feat/ai-speech-pipeline

- [ ] Start from integrated main; write failing deadline tests for Vietnamese/English weekdays, month boundaries, explicit dates and ambiguous sprint.
- [ ] Add deadline_iso to ActionItem and editable task schemas, persisted in the existing SQLite action_items JSON; normalize at extraction and preserve through CRUD.
- [ ] Write failing profile validation, enrollment and threshold matching tests; implement speaker_profiles migration, CRUD and centroid matching in diarization.
- [ ] Write failing audio-chunk tests for RAM decoding, input limits, silence and inference; implement bounded FFmpeg pipe decoding and POST /api/transcribe-chunk.
- [ ] Run backend and model STT tests; commit phase.

## Phase 3 — feat/fe-ui-interactions

- [ ] Start from integrated main; implement accessible drawer and wrapping mobile dock.
- [ ] Write failing SSE parser tests for split UTF-8, frame boundaries, errors and premature EOF; implement fetch streaming, cancellation, cursor and auto-scroll in existing chat UI.
- [ ] Write failing backend library filter/sort tests; implement query parameters in CRUD/API and dropdown state in App/MeetingLibrary.
- [ ] Run frontend tests, lint, production build and backend regression; inspect mobile UI if browser available. Commit phase.

## Phase 4 — acceptance

- [ ] Review final changes and fix material findings with regression tests.
- [ ] Merge each verified branch locally with explicit merge commits, run full backend/model and frontend checks, run npm run benchmark.
- [ ] Record actual counts and environment limitations in docs/CLARION_RESCUE_REPORT.md. Preserve prior benchmark version; no fabricated results.
