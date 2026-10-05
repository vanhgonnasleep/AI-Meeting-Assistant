# Meeting workspace implementation plan

> For agentic workers: use superpowers:executing-plans for integration and superpowers:dispatching-parallel-agents for independent file ownership. Steps use checkboxes for tracking.

**Goal:** Deliver reviewable minutes, cross-meeting tasks, local semantic retrieval and project decision timelines.

**Architecture:** SQLite additive migration and guarded updates; separate workspace router/components; opt-in local embeddings with bounded cache and lexical fallback.

**Tech Stack:** Existing Python/FastAPI/SQLite, React/Vite, Ollama; no additional runtime dependency.

**Spec:** docs/superpowers/specs/2026-10-05-meeting-workspace-design.md

## Global constraints

Keep existing data; use temporary test/preview DBs. Single-user loopback only. Direct main integration after checks; no force push. Human review never inferred from AI. UI errors are actionable, preserve drafts on conflicts. Semantic similarity is not confidence.

## Review focus

Concurrent task/speaker edits while minutes editor open must invalidate revision. Source edits cannot retain stale citations. Missing embeddings never silently masquerade as semantic search. Filter changes cannot show old task/project responses. Legacy malformed/null collections cannot break workspace views. Pin these to backend and frontend test tasks below.

### Task 1: Workspace persistence and API

Files: database/{db,models,crud,workspace}.py; ai-summary-service/workspace_api.py; tests/test_workspace.py. Interfaces: exact contracts in spec. Root handles router inclusion and admission paths.

- [x] Write failing temporary DB/API tests for revisions, review/source edits, task pagination, project isolation and regeneration conflicts.
- [x] Run focused tests, confirm behavior failure.
- [x] Implement migration, guarded transactions, bounded task/timeline scans and validated router.
- [x] Run focused tests and existing database/API regressions.

### Task 2: Workspace UI

Files: src/Workspace.jsx, MeetingEditor.jsx, workspace.js and workspace.test.js, App.jsx, session.js. Consumes Task 1 HTTP contracts.

- [x] Write failing helper tests for metadata preservation, conflict-safe drafts and review payloads.
- [x] Implement accessible editor and workspace/project views with request gates, limits and error/busy states.
- [x] Integrate source opening, updated-record replacement, project assignment and semantic controls into App.
- [x] Run lint/tests/build; browser review with synthetic DB during integration.

### Task 3: Hybrid retrieval

Files: ai-summary-service/semantic_retrieval.py, meeting_chat.py, main.py and request_limits.py; tests/test_semantic_retrieval.py. Interfaces: semantic/embedding_model optional payload fields; retrieval_warning optional response.

- [x] Write failing model-mocked tests for synonym recall, irrelevant vectors, cache and malformed/offline fallback.
- [x] Implement batch embeddings, bounded cache, cosine ranking and fusion; retain original source citations.
- [x] Integrate both chat endpoints and workspace router, extend admitted AI route list for regeneration.
- [x] Run chat and request-limit regressions.

### Task 4: Whole-product delivery

- [x] Full backend/model suite; frontend lint/test/build/prod audit.
- [x] Browser checks of saved edits/review/tasks/projects and semantic fallback on isolated synthetic data.
- [x] Independent review and fix material issues; update public usage/limitations.
- [x] Prepare verified tree for direct main integration; no force push or PR.

The resulting commit SHA, exact-commit CI result, private report update and preview cleanup are recorded separately in the owner's delivery report after integration.
