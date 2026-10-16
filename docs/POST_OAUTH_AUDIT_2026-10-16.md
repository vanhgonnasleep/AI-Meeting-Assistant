# Post-OAuth regression audit — 2026-10-16

One additional audit of baseline `d8d5b31`, after actual Google/GitHub login verification. Two independent read-only reviews covered backend/data boundaries and frontend workflows; the parent reproduced findings, reviewed corrections and ran integration checks. This is a scoped source/runtime review, not an exhaustive security certification.

## Findings corrected

| Finding | Trigger and resulting correction |
| --- | --- |
| JSON export failed | The real export callback passed the complete result object to an array helper. It now exports the task array. A React DOM regression clicks the actual button and checks the downloadable JSON. |
| Project filter showed only demo names | Library now loads the signed-in account's projects, refreshes on return/focus, exposes retry on failure and discards responses after unmount/account changes. |
| Logout could restore an obsolete signed-in shell | Focus/timer session refreshes are fenced during logout and pending refreshes are cancelled. Session invalidation during an expired-session logout queues an immediate recheck rather than leaving a loading screen. Deferred-response regressions exercise both cases. |
| A stale task checkbox could complete another task | Removing/reordering tasks in another tab changed the meaning of a positional index. Status updates now require the loaded revision and compare it inside the database write transaction. A conflict returns 409 without changing the task; the UI retains its prior checkbox state and explains how to reopen the record. |
| A saved long meeting could not save corrections | Storage/transcription accepted 20,000 segments while review/chat accepted only 10,000; review snapshots also had a smaller body allowance. Review/chat now accept 20,000 segments. Review snapshots share the 16 MiB save budget; combined text and other JSON request limits remain bounded. The regression saves and corrects all 20,000 segments with preserved metadata. |
| JSON chat returned an invalidated answer | The JSON route ignored a failed generation-checked append. It now returns 409 if source edits, history clearing or meeting deletion invalidate inference, matching streaming semantics. |
| Owner configuration polluted tests | Creating the private `.env` made 115 baseline tests fail with `Invalid host header`; these were one collection-time configuration issue, not 115 application defects. Test collection now disables personal dotenv loading and sets isolated hosts, origins, blank provider credentials and temporary storage. A subprocess regression deliberately supplies conflicting owner settings before collection. |

The required task-status body is now `{ "status": "completed", "expected_revision": 0 }`, with the revision from the loaded meeting. Missing/invalid revisions return 422; stale revisions return 409. External callers must adopt this safety contract. The bundled frontend and regression callers have been updated.

## Verification

- Full backend with actual model integrations: **326 passed**, zero skipped; one existing upstream Starlette/AnyIO deprecation warning.
- Lightweight Python 3.11 test environment: **314 passed, 11 skipped** for optional model/tensor dependencies.
- Frontend: **123 passed**, including seven new real React DOM/jsdom workflow regressions. Four SSR fixtures disable unneeded WebSocket listeners so parallel tests do not compete for a fixed port.
- ESLint and production Vite build passed. Main entry: **488.80 kB**, gzip **152.30 kB**. Full npm audit, including the new test-only jsdom dependency: **0 vulnerabilities**.
- Both Python environments passed `pip check`. `git diff --check` passed.
- Regression failures were observed before their fixes. The full test suites use disposable databases and provider fixtures; real account libraries and credentials were not used for automated regression runs.

Logs are retained locally as `%TEMP%/clarion-post-oauth-fixed-backend.log`, `clarion-post-oauth-lite.log` and `clarion-post-oauth-fixed-frontend.log`. Earlier OAuth and container evidence remains in [the private-account acceptance report](PRIVATE_AUTH_ACCEPTANCE_2026-10-16.md). Container recipes were unchanged by this patch; ARM runtime, public HTTPS deployment and physical microphone capture were not repeated in this audit.

No account-isolation bypass was validated in the reviewed OAuth/session/storage/streaming paths. Automated account-boundary coverage remains supplemented by the prior live provider checks. This conclusion is limited to the reviewed paths and exercised cases.

## Suggested next work

1. Build a representative Vietnamese/mixed-language audio evaluation set. Measure transcription errors, speaker attribution, action-item precision and deadline correctness separately; compression ratio and processing speed do not measure these outcomes. Use the existing human review/citation UI to diagnose errors.
2. Add durable, account-owned processing jobs with progress, retry and cancellation. Processing currently occupies a synchronous request and shares two admission slots per process; persisted jobs would support page reloads and restarts. Separate heavy worker execution is consistent with the [FastAPI background-work guidance](https://fastapi.tiangolo.com/tutorial/background-tasks/#caveat); select infrastructure only after measuring actual load.
3. Add an account data-management page for backup/restore and explicit import of the unassigned local library, with preview and a clear destination account. The current workflow requires administrative file/path selection.
4. Extend end-to-end coverage to upload → save → reopen → correct → chat → export, including conflicting tabs and long recordings. Add public-deployment checks for HTTPS/callback origins, per-account fairness and request throttling before exposing a shared service.

These are recommendations, not features added by this audit.
