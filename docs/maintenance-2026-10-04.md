# Maintenance audit — 2026-10-04

Historical notes for the October 4 pass. The October 5 upload/duration/chunking changes supersede the original 50 MiB limit and duration follow-up below; see [current media configuration](media-limits.md). Current validation is recorded with the latest release, rather than retroactively changing this pass's results.

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
- History now uses bounded pages with deterministic ordering and a recent-meeting index. Compact UI pages exclude transcripts, segments and chat. Search runs across the database, handles Vietnamese casing, and treats wildcard characters literally. Analytics reads task data in batches rather than loading every full meeting.
- Speaker corrections persist in a single transaction and update structured insight/chat attributions. Renaming changes attribution headers, preserving spoken words and manual transcript annotations. Reopening a meeting restores speaker controls; legacy null entries and numeric text are normalized. Generated summary and chat prose are not rewritten.
- History detail requests are invalidated when the dialog closes. Failed loading keeps the previous result's demo label and warnings. An in-app rename form replaces the browser prompt.
- Speaker refinement accepts line numbers only inside its current chunk. The final Map-Reduce prompt uses the same data boundary as the direct/partial prompts. Neither prompt boundaries nor low temperature guarantee factual accuracy.
- The Windows launcher checks the project virtual environment and frontend dependencies, works from the repository directory, and binds the UI to a fixed local port. The low-spec setup reports failed model downloads correctly.
- Chat suggestions now quote the current transcript instead of reusing budget/financial-report examples. Empty source text produces no suggestions. Switching meetings recomputes them; summaries and extracted tasks are not used as evidence for their topics.
- Chat retrieval focuses on quoted source text and removes generic question framing from keyword scoring. An unrelated question receives `no_matching_context` with no citations or model call instead of arbitrary chronological excerpts. Whole-meeting overview requests use an explicit sample across the transcript; the sample is not complete coverage.
- Generated executive summaries are excluded from the chat model's evidence. Offline answers are labeled source excerpts rather than synthesized answers. Saved-meeting chat requests send the question and record ID, avoiding redundant large transcripts; the server reads the stored source.
- Raw transcript times, ratios and URLs retain their colons. Inline chat seek buttons are disabled when the original audio is unavailable. An empty extracted-question list no longer claims that all questions were resolved.

The database migration adds `chat_generation` with a default value for existing meetings and a recent-meeting index. No meeting records need to be deleted or replaced. The history API now defaults to 50 records (maximum 100); clients needing the whole history must paginate.

## Validation

On Windows, Python 3.14.7 and Node 24.21.0:

```text
python -m pytest ai-summary-service/tests -q --run-model-tests
90 passed; 2 upstream deprecation warnings

cd meeting-assistant-ui
npm run lint
npm test              # 16 passed
npm run build
npm audit --omit=dev   # 0 vulnerabilities
```

The four Whisper integration tests require the full model dependencies and model weights. The default suite skips those tests so CI can use `ai-summary-service/requirements-test.txt` without downloading Whisper weights. CI uses Python 3.11; its remote result is separate from the local verification above.

Browser checks covered explicit demo processing, object citations, a suggested chat question, and chat clearing. A second preview used a separate synthetic database to check history pagination, a transcript search outside the first page, speaker correction surviving reopening, and retained demo labeling after a failed detail request. The unsupported browser rename prompt discovered during this check was replaced and verified. An independent code review also compared MMR output against the previous algorithm over 144 parameter/input combinations and checked oversized JSON and multipart streams.

A third isolated preview verified that engineering and gardening meetings produce different source-based chat suggestions. An unavailable model returned clearly labeled relevant excerpts, and a budget question against the gardening meeting returned no matching context despite the word “approved” in its transcript. Independent review found an overbroad speaker-header rule that could discard times, ratios and URLs; regression tests now cover those cases.

## Remaining limits

- The formal security scan examined the original commit `c738b6397afbc9da90a4865ce852a5cb4e39f83f` and reported partial coverage (24 of 50 tracked files). Its two medium-severity findings concerned unauthenticated network exposure and unbounded chat work. Local defaults and admission/input limits reduce these risks; the scan was not a full verification of the final patch.
- There is still no authentication or per-user authorization. Keep the service local. Public or team hosting requires authentication, ownership checks and a deployment-specific access policy. Origin checks are not authentication.
- Admission and Whisper locks are process-local. Multiple workers multiply resource usage. Stopping the browser's wait does not cancel server work; check meeting history for a completed result.
- Upload byte limits do not bound decoded audio duration. Long audio can still consume substantial CPU and memory. A queued job system with cancellation and duration limits is a follow-up design task.
- `npm audit` reports five high-severity development-tool findings through Tailwind 3 and `braces`. The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) currently has no patched `braces` version. Production dependencies pass the audit. A Tailwind 4 migration needs separate layout/build validation; an automatic forced major upgrade was not applied.
- Python dependency compatibility passed `pip check`. An OSV query of 46 installed backend packages returned no known findings, including paginated responses; this covers that environment and database, not every future installation. AI quality remains heuristic when Ollama is unavailable. Speaker diarization is approximate and has no representative accuracy evaluation in this pass.
- Search still scans matching text; it is not an FTS index. Analytics remains proportional to task count. Large-scale use needs measured benchmarks and a separate indexing design.
- Speaker corrections update structured labels. Previously generated narrative prose may still mention old names; review or regenerate it separately. Original audio is not persisted with history, and response warnings are not stored as separate database fields.
- Suggestions use bounded excerpts and simple topic heuristics, not a new AI question-generation service. Chat retrieval remains lexical: synonyms and translations can miss useful context, and word overlap can still select insufficient evidence. Model instructions and displayed citations do not verify every generated claim. New feature work is deferred.

## Feature priorities after this pass

1. Introduce background jobs with progress, cancellation, audio-duration limits and retry controls.
2. Add accounts and meeting ownership before enabling shared hosting.
3. Evaluate Vietnamese transcription, diarization and grounded answers on a representative set of meetings.
4. Add durable warning/provenance fields and richer task editing; plan safe audio retention before enabling playback of stored meetings.
5. Benchmark FTS search and analytics at scale; migrate the styling toolchain after visual regression checks.

These remaining features are follow-up proposals. This pass delivers the repairs, persistent speaker corrections, paginated history search, lighter analytics, exports, configuration and automated checks described above.
