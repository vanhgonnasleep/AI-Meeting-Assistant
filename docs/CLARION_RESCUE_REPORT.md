# Clarion rescue acceptance — 2026-10-16

The nine tasks in the supplied Master Prompt are implemented. Changes were committed sequentially on `feat/be-streaming-fts`, `feat/ai-speech-pipeline`, and `feat/fe-ui-interactions`, with later branches incorporating earlier verified work. Integration uses explicit local merge commits into `main`. No remote push is part of this operation.

| Task | Delivered behavior |
| --- | --- |
| 1.1 FTS5 | External-content index over transcript, summary and action items; insert/delete/update triggers; initial rebuild for existing meetings; bounded `search_meetings_fts`; API searches before pagination, keeps filename search and literal Unicode LIKE fallback for punctuation. |
| 1.2 SSE | `POST /api/chat/stream` forwards Ollama tokens as `data: {"token":"…","done":false}` and ends with `done`, citations and mode. JSON endpoints remain supported. Incomplete answers are not persisted; saved chat checks the original generation before appending. |
| 1.3 Docker | Python 3.11 backend with FFmpeg, Node 20 build plus nginx frontend on 5173, compose health dependency, host database mount and Whisper cache. Images do not force a CPU architecture. **Runtime/build across architectures remains unverified: Docker is absent on this machine.** |
| 2.1 Dates | Conservative Vietnamese/English normalization with explicit calendar validation. `deadline_iso` is stored per task in SQLite's existing `meetings.action_items` JSON array, alongside the human wording. Existing rows are backfilled against `created_at`. Edits recompute changed dates, preserve previously resolved unchanged dates, and use the meeting day for relative dates. |
| 2.2 Voiceprints | `speaker_profiles` schema, normalized vector validation, transactional enrollment and centroid matching at cosine strictly above 0.82. Diarization attaches acoustic centroids; correcting a speaker name enrolls that name for future recordings. Approximate acoustic matching needs human review; it is not validated biometric identification. |
| 2.3 Audio chunks | `POST /api/transcribe-chunk` accepts standalone audio chunks and decodes mono 16 kHz float32 samples through FFmpeg stdin/stdout. Limit: 8 MiB and 30 seconds; decoding has a timeout. Silent chunks bypass model loading. Whisper inference shares the existing admission lock. No application-created audio temporary files. |
| 3.1 Mobile | Sidebar hidden below 768px, hamburger toggle, blur backdrop, Escape, focus containment/restoration, inert background and scroll lock. Dock wraps and accounts for safe areas. |
| 3.2 Streaming UI | Fetch SSE parser handles split UTF-8 and frame boundaries, terminal errors and premature EOF. The existing CommandCenter chat displays incremental text, a blinking cursor and auto-scroll. Session invalidation cannot insert stale placeholders. |
| 3.3 Library | Project: All / Clarion Core Platform / Enterprise Compliance; date: All / 7 / 30 days; sort: newest / oldest / duration / task count. Backend applies controls before totals and pagination. |

“Next Monday” means Monday of the following calendar week. A bare weekday uses the next occurrence including today; “thứ 6 tuần này” uses Friday in the reference week. “End of sprint” stays null unless `sprint_end` is explicitly supplied to the normalizer.

## Verification

- Backend: `ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests --run-model-tests -q` — **280 passed, zero skipped**. Includes actual local Whisper integration, the new RAM chunk path on the bundled spoken sample, migrations, CRUD and API regressions.
- Frontend: `npm test` in `meeting-assistant-ui` — **89 passed**.
- `npm run lint` — exit 0, no ESLint errors.
- `npm run build` — exit 0. Vite reports the existing large main-bundle warning; this is not a build failure.
- Browser: 375 × 812 and 768 × 1024 checks showed no horizontal overflow. Verified drawer opening, keyboard focus containment, Escape/restore, library controls and a real local Ollama answer with `rag_llm` mode and source citations. Browser testing used an isolated temporary database, leaving the user's meeting database untouched.
- Compose configuration and referenced Dockerfiles were reviewed. Docker CLI validation, container launch, actual nginx proxying and Linux/ARM inference require a Docker-enabled machine; a standalone YAML parser is also unavailable in this Python environment.
- Two existing dependency deprecation warnings remain from FastAPI/Starlette's test client integration.

An independent read-only review identified three Important defects: stale ISO dates after editing, underscore query tokenization and a stale browser chat placeholder race. Each was reproduced with a failing regression, fixed, and verified with the full suite. No Critical findings or deferred code-review minors.

## Measurements

`npm run benchmark` completed and regenerated [BENCHMARK_REPORT.md](BENCHMARK_REPORT.md), which contains the final measured values. These are fixture-specific measurements, not end-to-end latency or accuracy guarantees.

The pre-existing uncommitted benchmark report is preserved in the Git stash named `clarion-rescue: preserve pre-existing benchmark report`, plus a temporary backup `clarion-benchmark-before-rescue.md` in the Windows temporary directory. The final report intentionally replaces its generated measurements with this run's values.

## Running the containers

From the repository root, on a Docker-enabled machine:

```sh
docker compose config
docker compose up --build -d
```

Open `http://localhost:5173`. Backend binds host loopback port 8002. SQLite persists as `database/meeting.db`, with WAL sidecars in the same mounted directory. Do not delete that directory when restarting containers. Model weights persist in the `whisper-cache` volume.

Ollama runs separately and must be reachable from the backend container. Compose uses `OLLAMA_BASE_URL=http://host.docker.internal:11434` with a Linux host-gateway mapping; adjust the environment value for another Ollama host. Every inference module honors that setting. Keep the host's required Ollama models available. The frontend uses same-origin `/api` requests through nginx; buffering is disabled for SSE.

Documentation checked via Context7: [FastAPI streaming](https://fastapi.tiangolo.com/advanced/custom-response/), [SQLite FTS5](https://www.sqlite.org/fts5.html), [Whisper](https://github.com/openai/whisper), [React Effects](https://react.dev/reference/react/useEffect), [Docker Compose](https://docs.docker.com/compose/).
