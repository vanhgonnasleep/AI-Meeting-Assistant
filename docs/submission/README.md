# Clarion submission guide

This is the starting point for handing in the code. Presentation slides belong to the presenting team; this package supplies source, run instructions and evidence.

## What to submit

| Deliverable | Contents | Purpose |
| --- | --- | --- |
| Source ZIP | All committed application code, tests, lockfile, Docker configuration, documentation, public samples and experimental evidence | Review and run the submitted implementation |
| `MANIFEST.json` | Full source commit, ZIP SHA-256 and per-file checksums | Identify the exact submission |
| `START_HERE.txt` | Entry points into the archive | Help the examiner find the instructions |
| Repository link | The repository URL and the same full commit as the manifest | Inspect development history separately |
| Department report and slides | Prepared by the team using the department's required format | Explain the implementation and measured results |

Create the first three files from a clean, committed checkout:

```powershell
python scripts/submission/package_source.py --output dist/submission
```

The packager uses Git's committed tree, not a copy of your working directory. It stops on uncommitted tracked edits or accidentally committed runtime paths. It performs a limited check for known credential patterns; it is not an exhaustive security audit. The ZIP contains no Git history. The original Git checkout is required to rebuild the archive; Git is not required just to run extracted application files.

Upload the ZIP, manifest and start-here file together. If the submission portal accepts only one file, place those three files in a delivery ZIP. Keep the generated source ZIP unchanged so its checksum remains valid. Keep a local copy of the exact files uploaded.

Do **not** submit your populated `.env`, account databases, private recordings, access tokens, browser profiles, virtual environments, `node_modules`, model weights or dataset caches. Use `.env.example` for configuration instructions. Model weights and third-party datasets retain their own licenses. The archive includes only the small public demonstration recordings already tracked by the project.

## Where the examiner should look

| Responsibility | Location |
| --- | --- |
| Application composition and existing launch compatibility | `ai-summary-service/main.py`, `ai-summary-service/app/main.py` |
| Validated API contracts | `ai-summary-service/app/api/schemas/` |
| Speech, MMR, summarization, actions and grounded chat | `ai-summary-service/app/pipeline/` |
| Authentication and request controls | `ai-summary-service/app/auth/`, `ai-summary-service/app/core/` |
| Persistence, task/project operations and migrations | `database/` |
| Frontend composition | `meeting-assistant-ui/src/app/` |
| Feature UI and behavior | `meeting-assistant-ui/src/features/` |
| Shared feedback and error classification | `meeting-assistant-ui/src/shared/ui/FeedbackNotice.jsx`, `shared/lib/user-errors.js` |
| Automated regression suites | `ai-summary-service/tests/`, colocated frontend `*.test.js` files |
| Evaluation runner and synthetic fixtures | `scripts/evaluation/`, `scripts/evaluate_pipeline.py`, `evaluation/` |
| Measured pilot evidence | `docs/defense/evaluation/2026-10-16-pilot/` |

See the complete [source map](../source-layout.md), [release handoff](HANDOFF.md), [backend audit](../backend/final-audit.md) and [error recovery notes](../ui/error-recovery/README.md).

## Run the extracted code

For the public product tour alone, install the frontend dependencies with `npm ci` inside `meeting-assistant-ui`, then run `npm run dev`. Open the displayed local address. The home page and `#/preview/overview` use prepared samples and remain available without signing in or running AI inference.

For real processing, follow the root [README](../../README.md), the backend [setup instructions](../../ai-summary-service/README.md), and [authentication setup](../auth-setup.md). Python 3.11 is used by CI. FFmpeg, the backend requirements, local Whisper weights and a local Ollama model are needed for the complete pipeline. Initial dependency/model downloads need internet access. Private Google/GitHub sign-in also needs network access and separately configured provider credentials.

Start backend and frontend in separate terminals, from their respective folders:

```powershell
# Backend folder, using its virtual environment
python main.py

# Frontend folder, separate terminal
npm ci
npm run dev
```

The backend uses port 8002 and the frontend uses 5173. Check for an existing instance before starting another one. If a port is unavailable, stop the redundant instance you own or configure a consistent alternative origin; see the authentication guide before changing callback URLs.

Docker is an alternative documented in the root README. Containers package the application; they do not supply OAuth credentials or silently download every AI model.

## Verify the submission

From the repository root:

```powershell
python -m pip install -r ai-summary-service/requirements-test.txt
python -m pytest ai-summary-service/tests -q
npm --prefix meeting-assistant-ui ci
npm --prefix meeting-assistant-ui test
npm --prefix meeting-assistant-ui run lint
npm --prefix meeting-assistant-ui run build
```

The lightweight backend suite deliberately skips tests requiring optional speech dependencies/checkpoints. To include local model tests, use the fully provisioned backend environment and add `--run-model-tests`. Software test counts demonstrate checked behaviors, not AI accuracy.

## Experimental claims the team can defend

The frozen pilot uses the first 20 Vietnamese FLEURS test recordings, totaling 239.04 seconds. On that sample, tiny has CER 44.99% and whitespace-WER 64.60%; base has CER 21.13% and whitespace-WER 37.29%. Both completed 20/20 ASR cases on CPU. This is read speech, not a real multi-speaker meeting benchmark.

The six synthetic NLP cases were run with MMR off/on, producing 12 outputs: 11 complete and one partial because action extraction used its heuristic fallback. Human reference approval and scoring are unfinished. Do not report task F1, summarization accuracy or a measured MMR quality improvement. A smaller transcript is not proof of a better summary.

Show the [pilot evidence](../defense/evaluation/2026-10-16-pilot/README.en.md), `summary.json`, raw rows and checksums together. Preserve the original inference commit and model hashes; later code cleanup does not change the provenance of that existing run.
