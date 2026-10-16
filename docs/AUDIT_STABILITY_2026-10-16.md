# Clarion stability audit — 2026-10-16

Follow-up: [private accounts and Docker acceptance](PRIVATE_AUTH_ACCEPTANCE_2026-10-16.md) resolves the build-tool advisories and records actual container/multiplatform verification plus account isolation. Results below describe the earlier audit snapshot.

Follow-up to [the rescue acceptance](CLARION_RESCUE_REPORT.md), based on `8b2173f`.
Implementation branch: `codex/audit-rescue-stability`. Integration is local to `main`; no remote push is included. Gmail/GitHub authentication remains outside this change, as requested.

## Corrections

| Area | Failure and correction |
| --- | --- |
| Database startup | A late migration failure could leave partial schema changes. Startup and the maintenance CLI now share one schema initializer inside an explicit transaction, rolling back on failure. |
| Maintenance CLI | The CLI previously ignored `CLARION_DB_PATH`. Status, backup and maintenance now use the configured database; clean backs up and also clears voice profiles. Destructive maintenance was tested only against disposable fixtures. |
| Streaming chat | The terminal SSE frame repeated the entire saved chat history, which could exceed the browser frame limit after successful generation. It now contains completion metadata and citations without the redundant history. |
| Speech availability | Missing Whisper/FFmpeg now produces an actionable 503 response on the audio chunk endpoint. Silent chunks still bypass model loading. |
| Voice profiles | Oversized numeric embeddings are rejected consistently; corrupt existing profile metadata can be repaired on enrollment. Running means retain their actual magnitude between samples, avoiding incorrect weighting. Speaker corrections enroll the actual turn's features instead of a whole cluster's centroid. |
| Manual meeting save | `deadline_iso` survives the frontend save payload. |
| Recording lifecycle | A dedicated controller handles pending permissions, duplicate starts, constructor/start/runtime failures, final queued chunks, actual MIME type/filename and track cleanup. Session invalidation rejects old callbacks synchronously and remounts capture controls. |
| Navigation | Collapsed-sidebar history respects the same save/load guards as the expanded sidebar. |
| Loading and recovery | Dashboard, document workspace and presentation load on demand. Scoped error boundaries preserve the parent meeting state after a rejected import. Retry creates a fresh lazy component, and the presentation can be closed. |
| Presentation copy | Empty decision/risk collections no longer substitute invented positive conclusions; review prompts replace unsupported verification badges. |
| Test dependencies | NumPy is available in the lightweight CI environment. Optional Torch/Whisper tests skip explicitly when those packages are absent. `httpx2` removes the test client's obsolete httpx integration warning. |
| Container coverage | Backend images install CPU Torch and include maintenance scripts. A workflow now builds Compose, exercises nginx/API/FTS/SSE/audio, restarts the backend and verifies persistence. A manually dispatched job builds both images for amd64/arm64 without publishing them. |
| Build dependencies | Updated locked `source-map-js` from 1.2.1 to 1.2.2 using the compatible npm audit fix. |

An independent final review found an Important issue with unhandled lazy-import rejection. Before the fix, a real React browser harness reproduced a blank root after modifying unsaved state. After the fix, the fallback retained revision 22, retry rendered the recovered panel, and closing the failed panel retained the parent state.

## Verification

| Check | Result |
| --- | --- |
| Full backend, installed local models: `ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests --run-model-tests -q` | **290 passed**, zero skipped. One upstream Starlette/AnyIO deprecation warning remains. |
| Fresh Python 3.11 virtualenv, only `requirements-test.txt`: `python -m pytest ai-summary-service/tests -q` | **278 passed, 11 skipped**; skips are optional model/tensor dependencies. Collection-level optional skips account for the different total. |
| Frontend: `npm test` | **103 passed**, zero skipped. Includes 12 recording-controller behavioral tests. |
| Frontend: clean `npm ci` | Exit 0; tests, lint and production build repeated successfully after the clean installation. |
| Frontend: `npm run lint` | Exit 0, no ESLint errors. |
| Frontend: `npm run build` | Exit 0. Main entry **481.49 kB**, gzip **149.94 kB**; no large-chunk warning. Baseline main entry was 574.95 kB. |
| Python installed dependency consistency: `pip check` | No broken requirements in the full or lightweight environment. |
| Production frontend dependency advisories: `npm audit --omit=dev` | **0 vulnerabilities**. |
| All frontend dependency advisories: `npm audit` | **7 development/build dependency advisories**: 5 high, 2 moderate. Details below; this command does not pass. |
| Isolated live API smoke | Create/update FTS search, SSE tokens/citations/completion, RAM silence decode and configured-path CLI status passed. |
| Restart persistence smoke | Restarted the local backend against the same temporary database; verified transcript, ISO deadline and completed chat, then removed only the smoke fixture. |
| Real browser | Dashboard → document workspace → Zen Deck loaded. Error, retry and close recovery paths exercised with the actual React component. Empty decision state verified. |
| Compose/workflow YAML | Parsed successfully. This does not establish Docker runtime success. |
| Benchmark: `npm run benchmark` | Completed; [measurements](BENCHMARK_REPORT.md) regenerated, including actual local Whisper CPU inference. |

The full backend regressions include failed-migration rollback, configured DB paths, shared FTS schema, large chat history, unavailable STT, profile maintenance, centroid weighting, corrupt profile repair and turn-level voice features.

### Reproducing panel recovery

Run `npm run dev` in `meeting-assistant-ui`, then open `/tests/lazy-panel.html` on that Vite server. Increase the revision, open the panel, wait for the simulated failure, and retry. The heading and modified revision must remain while the recovered panel appears. Reload to test the Close panel path independently. This is a browser regression fixture, not one of the 103 Node tests.

![Recovered panel retains unsaved revision 22](audit-artifacts/lazy-panel-recovery.png)

## Outstanding limits and follow-up

- Docker is not installed and no Docker-capable WSL distribution is available here. Container build/start, nginx proxy behavior, Linux inference and ARM builds remain **unverified** until the added workflow runs on a Docker-enabled runner. The workflow has not been pushed or executed remotely.
- Physical microphone capture and browser permission prompts were not exercised. Capture failure/race/cleanup behavior is covered with controlled browser-API doubles. Actual Whisper inference and FFmpeg decoding were tested locally.
- The remaining npm alerts come from Tailwind 3's development dependency graph: `braces`, `chokidar`, `micromatch`, `fast-glob`, `postcss-selector-parser`, `postcss-nested` and Tailwind itself. The underlying issues are [nested brace patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [selector-parser CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). The brace advisory currently lists no patched release. npm proposes Tailwind 4 as a breaking change. A separate migration with visual regression checks is needed; the audit does not force that migration or claim these alerts are resolved. These packages are marked development-only in the lockfile; that does not eliminate risk when processing untrusted build inputs.
- The remaining deprecation warning originates in Starlette's use of `anyio.abc.BlockingPortal`; it is not suppressed.

These results establish the checks performed, not a guarantee that every possible input or deployment is defect-free. The user's working meeting database was not used for smoke fixtures; the pre-existing benchmark stash remains preserved.
