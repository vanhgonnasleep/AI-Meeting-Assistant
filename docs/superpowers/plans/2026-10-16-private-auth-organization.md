# Private Sign-in and Application Organization Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the primary implementation; independent frontend/build and Docker investigations may use superpowers:dispatching-parallel-agents. Track each deliverable below and preserve existing meeting data.

**Goal:** Finish runtime verification, private Google/GitHub sign-in and a coherent source tree.

**Architecture:** Server-side OAuth and opaque sessions; account-specific SQLite storage selected by request context. Feature-oriented React files and modular Python application code preserve current APIs and development commands.

**Tech Stack:** FastAPI, SQLite, Authlib, React, Vite, Tailwind, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-16-private-auth-organization.md`

## Global Constraints

- Each account has a separate library, including projects/chat/voice profiles.
- Never claim legacy local data automatically or test against the working database.
- Never persist provider tokens or expose OAuth secrets to frontend code.
- Keep existing route contracts and local startup commands working.
- Record unavailable external verification honestly; do not add fake provider success paths.

## Review Focus

- State replay/browser substitution must fail before exchanging a code.
- Session expiry/logout must reject reads and writes and clear the mounted browser workspace.
- Concurrent request contexts and SSE execution must not select another account's database.
- Direct record/project IDs, FTS results and voice names must remain account-local.
- Source moves must update dynamic imports, CSS URLs, Node test discovery, Python monkeypatch targets, CLI paths and Docker copies.

## Deliverables

### 1. Baseline and environment
- [x] Verify baseline tests, Docker executable/engine and preserve a clean Git branch.
- [x] Read current Authlib/provider/Tailwind documentation before implementation.

### 2. Frontend source groups and patched build tooling
- [x] Move app shell to `src/app`, functionality to `src/features`, reusable UI/hooks to `src/shared`, global CSS to `src/styles`; update imports and recursive test discovery.
- [x] Migrate Tailwind build dependencies with compatibility styling; run tests, lint, production build and complete npm audit.

### 3. Backend modules, account storage and OAuth
- [x] Group implementation in `ai-summary-service/app`, retaining compatibility entry points when imported by existing tooling.
- [x] Add identity/session/state storage and request-selected database path. Write failing tests for isolation before implementing it.
- [x] Implement Google/GitHub adapters, PKCE/state binding, callback identity checks, opaque sessions, status/logout and CSRF middleware. Mock provider HTTP only in tests.
- [x] Verify private access controls and the legacy local workflow with focused and full tests.

### 4. Sign-in UI and setup
- [x] Add a gated account workspace, provider availability, credentialed API helper, CSRF mutation headers and logout/session-expiry cleanup.
- [x] Add local environment example, OAuth callback setup and folder map; update startup, CI and smoke scripts for explicit local/private modes.

### 5. Verification and integration
- [x] Run isolated Compose build/start, nginx/API/SSE/audio checks and persistence restart when Docker is available.
- [x] Run full model-enabled backend, lightweight backend, frontend tests/lint/build/dependency audit and browser flows.
- [x] Review integration, fix validated findings, update benchmark/report and integrate locally. Report exact remaining owner/environment prerequisites.

Completed locally on `main` through merge `9d0e7fa`. Post-merge verification: 312 backend tests passed with model integration, 116 frontend tests passed, lint/build succeeded and the complete npm audit reported zero vulnerabilities. The owner subsequently configured both OAuth clients in the private `.env` and completed actual Google/GitHub sign-in/consent; local callbacks, account workspaces, session persistence and GitHub logout were verified. See [the acceptance report](../../PRIVATE_AUTH_ACCEPTANCE_2026-10-16.md) for evidence and the remaining Docker/public-deployment boundaries.
