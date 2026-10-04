# Maintenance audit — 2026-10-04

This maintenance pass prioritizes correctness and predictable resource usage in the existing local application. It does not certify the repository as vulnerability-free or production-ready for public hosting.

## Repairs and improvements

- Demo content requires explicit demo mode. A matching filename or a budget-related question cannot silently substitute sample facts for real meeting data.
- Failed or empty AI responses produce a clearly labeled excerpt of the actual transcript and a warning. They no longer return a fabricated successful summary. Database-save failures also tell the user to export their result.
- Blocking transcription and AI calls run outside the API event loop. Two AI requests may be admitted per application process; excess requests receive `503` with `Retry-After`. Whisper inference is serialized, its cache retains one model, and action extraction has a finite SDK timeout.
- Request ingestion has limits before parsing, including streamed bodies: 4 MiB for JSON and 51 MiB for multipart requests, with a separate 50 MiB audio-file limit. Chat fields, segment sizes, timestamps, speaker counts and Whisper model names are validated.
- The default server binds to loopback. Host and browser-origin checks restrict access to local development addresses. CORS headers remain available on rejection responses so the UI can display the actual error.
- Session changes invalidate pending browser responses. Loading another meeting, clearing chat, resetting, or selecting another file cannot let an old response overwrite the current view. Clearing persisted chat also increments a database generation so an earlier answer cannot restore deleted messages.
- Object citations render safely, retain hour components, and seek only when an audio position is known. Text-only transcripts do not receive invented audio timestamps.
- MMR computes relevance once and updates redundancy incrementally instead of repeatedly rescanning all selected sentences. It preserves selection behavior; cosine-comparison count is `O(K*N)`, and remains quadratic when the number selected `K` scales with transcript size `N`.
- JSON export now includes insights, chat history, warnings and the demo flag. The UI accepts `VITE_API_BASE_URL` for a configurable backend address.
- Tests use a separate temporary SQLite database, including during collection. GitHub Actions runs backend regressions and frontend lint, tests, build and production-dependency audit on pushes and pull requests.

The database migration adds `chat_generation` with a default value for existing meetings. No meeting records need to be deleted or replaced.

## Validation

On Windows, Python 3.14.7 and Node 24.21.0:

```text
python -m pytest ai-summary-service/tests -q --run-model-tests
63 passed; 2 upstream deprecation warnings

cd meeting-assistant-ui
npm run lint
npm test              # 4 passed
npm run build
npm audit --omit=dev   # 0 vulnerabilities
```

The four Whisper integration tests require the full model dependencies and model weights. The default suite skips those tests so CI can use `ai-summary-service/requirements-test.txt` without downloading Whisper weights. CI uses Python 3.11; its remote result is separate from the local verification above.

Browser checks covered explicit demo processing, object citations, a suggested chat question, and chat clearing without console errors. An independent code review also compared MMR output against the previous algorithm over 144 parameter/input combinations and checked oversized JSON and multipart streams.

## Remaining limits

- The formal security scan examined the original commit `c738b6397afbc9da90a4865ce852a5cb4e39f83f` and reported partial coverage (24 of 50 tracked files). Its two medium-severity findings concerned unauthenticated network exposure and unbounded chat work. Local defaults and admission/input limits reduce these risks; the scan was not a full verification of the final patch.
- There is still no authentication or per-user authorization. Keep the service local. Public or team hosting requires authentication, ownership checks and a deployment-specific access policy. Origin checks are not authentication.
- Admission and Whisper locks are process-local. Multiple workers multiply resource usage. Stopping the browser's wait does not cancel server work; check meeting history for a completed result.
- Upload byte limits do not bound decoded audio duration. Long audio can still consume substantial CPU and memory. A queued job system with cancellation and duration limits is a follow-up design task.
- `npm audit` reports five high-severity development-tool findings through Tailwind 3 and `braces`. The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) currently has no patched `braces` version. Production dependencies pass the audit. A Tailwind 4 migration needs separate layout/build validation; an automatic forced major upgrade was not applied.
- Python dependency compatibility was checked with `pip check`; this is not a Python vulnerability audit. AI quality remains heuristic when Ollama is unavailable. Speaker diarization is approximate and has no representative accuracy evaluation in this pass.

## Feature priorities after this pass

1. Persist speaker-name edits and task metadata, with consistent behavior after reopening a meeting.
2. Add meeting search, pagination and filtered analytics so history does not load every transcript into memory.
3. Introduce background jobs with progress, cancellation, audio-duration limits and retry controls.
4. Add accounts and meeting ownership before enabling shared hosting.
5. Evaluate Vietnamese transcription, diarization and grounded answers on a representative set of meetings; migrate the styling toolchain after visual regression checks.

These larger features are follow-up proposals. This branch delivers the repairs, export additions, configuration and automated checks described above.
