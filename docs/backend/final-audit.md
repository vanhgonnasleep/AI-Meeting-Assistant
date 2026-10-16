# Backend correctness audit — 17 October 2026

This pass reviewed request contracts, account/session boundaries, database writes, saved chat and SSE lifetimes, audio limits, and AI failure handling. It follows the [frontend/sign-in audit](../ui/signin-final/README.md).

## Confirmed defects and fixes

| Trigger | Previous behavior | Corrected behavior |
| --- | --- | --- |
| A SQLite operation fails while opening, reading or changing a workspace | A plain 500 could bypass the application's CORS/account response headers, appearing as a connection failure in the browser | A safe JSON 503 identifies `workspace_unavailable`; permitted origins receive CORS, known accounts retain their header, and the response is not cached |
| Preparing the identity or account directory fails | A filesystem exception escaped the SQLite error boundary | Storage initialization converts its filesystem failures to a specific storage exception handled by the same recovery boundary |
| A request supplies an ID or pagination offset outside SQLite's integer range | Python accepted the integer and SQLite could raise an overflow error | Request validation rejects it with 422 before database access; valid saved IDs are positive signed 64-bit integers |
| Transcription or another processing stage raises an internal exception | Its diagnostic text could be included in the response body | The response gives a recording-related recovery action without exposing internal paths or exception text |
| An authenticated mutation supplies a non-ASCII CSRF header | Constant-time string comparison raised a TypeError and produced a plain 500 | The request is denied with 403 before any write |

The storage boundary sits outside session middleware and inside CORS. Route exception handlers alone cannot handle failures that happen in session lookup or account initialization. It handles known storage failures rather than disguising unrelated programming exceptions. It never attempts to replace a response after streaming headers have been sent. See [Starlette's middleware documentation](https://github.com/kludex/starlette/blob/main/docs/middleware.md).

No automatic write retries were added. A browser connection failure can leave the result of a write uncertain; existing frontend recovery copy tells the user to preserve edits and check the library. Detailed storage diagnostics remain in server logs, not in user notifications.

## Review and regression evidence

The new regressions use disposable databases and synthetic identities. The original failure cases were observed failing before the fixes. Tests cover real read-only SQLite writes, retained records after a failed delete, identity and workspace initialization failures, CORS/account headers, ContextVar cleanup, invalid integer contracts, internal-error sanitization, malformed CSRF input and already-started stream behavior.

An independent read-only reviewer approved code revision `6177645` after running 60 focused audit/authentication/SSE tests. The reviewer identified the directory-permission case above; it was reproduced, fixed and rechecked before integration. The surrounding review found no confirmed unresolved account-isolation or chat-persistence defect. Existing transactions, stale-edit revisions and chat-generation guards remain in place.

Final local verification after all fixes:

- Model-enabled backend: **413 passed**, with one upstream Starlette/AnyIO deprecation warning; `%TEMP%/clarion-be-full-final.log`.
- Lightweight Python 3.11 backend: **401 passed, 11 optional skips**; `%TEMP%/clarion-be-lite-final.log`.
- Frontend regression: **152 passed**; no frontend code changed in this pass; `%TEMP%/clarion-be-fe-regression.log`.
- Backend `pip check`: no broken requirements found.
- `git diff --check`: clean.

## Reproduce

From the repository root, using the backend's provisioned Python environment:

```powershell
python -m pytest ai-summary-service/tests --run-model-tests -q
python -m pip check
npm --prefix meeting-assistant-ui test
```

For the lightweight CI environment, install `ai-summary-service/requirements-test.txt` and omit `--run-model-tests`. Optional speech/model integrations deliberately skip when their dependencies or weights are absent.

## Limits

This is a correctness audit with regression evidence, not an exhaustive security assessment or a guarantee of zero defects. Provider exchanges were not repeated, private `.env` values/account databases were not inspected, and no user recording was used for the audit. Passing model integration tests does not measure ASR, speaker identification or summarization accuracy. The frozen [AI pilot](../defense/evaluation/2026-10-16-pilot/README.en.md) retains its original provenance and limitations; human NLP scoring remains unfinished.
