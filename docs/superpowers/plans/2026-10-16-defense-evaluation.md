# Defense Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce measured Vietnamese ASR results, inspectable MMR comparisons and offline defense reports without inventing NLP scores.

**Architecture:** A standalone Python CLI coordinates manifest validation, bounded public-data preparation, existing pipeline adapters and report rendering. Pure scoring/report functions remain independent of models and network. Each run owns a new artifact directory and records inputs, configuration, raw outputs, failures and provenance.

**Tech Stack:** Python standard library, existing requests/NumPy/Whisper/Ollama dependencies, pytest; standalone HTML/CSV/JSON/Markdown, no frontend feature or new database service.

**Spec:** `docs/superpowers/specs/2026-10-16-defense-evaluation-design.md` (approved by the user).

## Global Constraints

- Default pilot: first 20 `google/fleurs`, `vi_vn`, test rows; source/license/checksums retained.
- Compare Whisper tiny/base on identical inputs, language=vi. Whisper currently runs CPU despite the physical RTX 4060; report actual devices.
- MMR variants: off and on with lambda=0.65, target_ratio=0.55, same installed LLM (`llama3:latest` by default).
- Six authored Vietnamese text fixtures are explicitly synthetic; their reference labels begin unapproved.
- No aggregate NLP accuracy/precision/recall/F1 without approved reference labels and completed human matching. Missing labels are not empty-task gold.
- No owner `.env`, identity/session database or meeting library enters experiments. Model adapters use temporary storage if importing application composition requires schema initialization.
- Preserve existing pipeline return contracts and prompts. Expose truthful generation/fallback metadata where needed rather than assuming every returned result came from an LLM.
- No implicit model download while scoring. An explicit `--allow-model-download` permits preparing missing official named weights; otherwise fail preflight before loading. No new models beyond tiny/base and the existing LLM are required.
- `.evaluation-data/` and `.evaluation-runs/` are ignored by Git. Curated public-result snapshots may be copied into docs with provenance after review.
- Offline HTML escapes all source/model content and loads no external resources. No secrets or signed download queries in artifacts.

## Review Focus

- Empty references and failed model calls must not inflate reported accuracy or coverage (Tasks 1/3).
- A changed/corrupt cached clip or checkpoint must be detected before a supposedly reproducible rerun (Tasks 2/3).
- Task-less ASR rows and unreviewed synthetic gold must not become zero-task ground truth (Tasks 1/4).
- Interrupted runs must retain completed rows, configuration and failure evidence without overwriting a previous run (Task 3).
- HTML-like transcripts, duplicate manual task matches and metadata containing secrets must not become executable output or false scores (Task 4).

## File Map and Shared Data Contract

Create `scripts/evaluation/{__init__,metrics,manifest,datasets,adapters,runner,reports}.py` and `scripts/evaluate_pipeline.py`. Add `evaluation/fixtures/vi_text_cases.jsonl`, `evaluation/README.md` and backend `test_evaluation_*.py` tests. Update `.gitignore`, root README and only existing pipeline helper code required to expose backward-compatible metadata.

`load_cases(path: Path) -> list[dict]` returns validated version-1 cases with:

```text
case_id: safe unique filename identifier; kind: asr | nlp_text; split: test | dev
provenance: {source_url, license, dataset, config, source_revision?, row_index?}
audio_path?, audio_sha256?, reference_text?, transcript?
reference_tasks?: [{id, task, assignee?, deadline_iso?, evidence}]
reference_facts?: [{id, text, evidence}]; reference_approved: bool
```

Audio paths resolve relative to the manifest. Text, IDs, paths and case counts have finite validation limits. References remain nullable where not applicable. Every run stores `run.json` with schema version, run ID, status, metadata/config, frozen manifest and a `rows` collection. Each row identifies case/variant and includes status, raw output or error, timing, provenance, warnings and applicable metric counts; failed rows remain present. Store `rows.jsonl` incrementally so interrupted runs remain inspectable.

### Task 1: Manifest and language-aware edit metrics

**Files:** create `scripts/evaluation/{__init__,manifest,metrics}.py`; tests `ai-summary-service/tests/test_evaluation_metrics.py` and `test_evaluation_manifest.py`.

**Interfaces:** `normalize_text(text: str) -> str`; `edit_counts(reference: str, hypothesis: str, *, unit: str) -> dict`; `aggregate_asr(rows: list[dict]) -> dict`; `load_cases(path: Path) -> list[dict]`.

- [ ] Write failing tests: NFC decomposed/composed Vietnamese matches, accents and digits remain significant, insert/delete/substitute counts are known, empty reference has `rate=None` plus insertion counts, duplicate IDs/invalid kinds/oversized inputs fail validation. Assert corpus rate is summed edits / summed reference units, not a mean of row rates.
- [ ] Run `python -m pytest ai-summary-service/tests/test_evaluation_metrics.py ai-summary-service/tests/test_evaluation_manifest.py -q`; confirm expected missing implementation failures.
- [ ] Implement two-row dynamic-programming edit distance, fixed Unicode normalization and strict versioned manifest validation. Define character units without whitespace and word units by whitespace; preserve raw text separately. Never coerce missing NLP reference fields to empty gold.
- [ ] Re-run those tests; require all pass, including mixed successful/failed rows with separate attempted/completed/scorable counts.
- [ ] Commit the self-contained contracts/scoring task.

### Task 2: Bounded FLEURS preparation and honest text fixtures

**Files:** create `scripts/evaluation/datasets.py`, `evaluation/fixtures/vi_text_cases.jsonl`, `evaluation/README.md`; modify `.gitignore`; tests `ai-summary-service/tests/test_evaluation_datasets.py`.

**Interfaces:** consume `load_cases`; produce `prepare_fleurs(output_dir: Path, *, limit: int = 20, fetch_json=None, download=None) -> Path`, returning the validated local manifest.

- [ ] Add failing mocked-network tests: exact dataset/config/test provenance, deterministic first rows, audio/reference checksums, interrupted or oversized download leaves no accepted partial clip, corrupt cache refuses reuse, expired signed URLs never enter saved provenance. Fixtures expose `reference_approved=False` and cover all six scenarios from the spec with explicit calendar dates where appropriate.
- [ ] Run `python -m pytest ai-summary-service/tests/test_evaluation_datasets.py -q`; inspect RED causes.
- [ ] Verify the current official Dataset Viewer API/docs before integrating it. Implement bounded timeouts/size/count/retries, atomic writes and checksum validation. Record stable dataset attribution/source IDs rather than CDN query strings. Keep data preparation distinct from model scoring; missing upstream data fails visibly.
- [ ] Run mocked tests plus manifest validation of all six fixtures. Self-review every reference against its authored transcript; retain unapproved status for owner review.
- [ ] Commit preparation/fixtures/documentation.

### Task 3: Isolated adapters and durable experiment artifacts

**Files:** create `scripts/evaluation/adapters.py`, `runner.py`; tests `ai-summary-service/tests/test_evaluation_runner.py`. If necessary, add metadata helpers beside `extract_action_items` in `app/pipeline/action_items.py` and `summarize_with_llama` in `app/main.py`, retaining existing wrapper signatures/results.

**Interfaces:** adapter `preflight(models: list[str], *, allow_download: bool) -> dict`, `transcribe(case: dict, model: str) -> dict`, `analyze(transcript: str, model: str) -> dict`; runner `run_evaluation(manifest_paths: list[Path], output_root: Path, *, models: list[str], llm_model: str, allow_download: bool = False, adapter=None) -> Path`.

- [ ] Write failing injected-adapter tests: same inputs across variants, exact MMR settings, failures retained in coverage, unique run folders, incremental rows survive interruption, warmup/model load separate from decode/transcription RTF. Missing/corrupt model cache without download permission must fail before a loader can initiate network access.
- [ ] Run `python -m pytest ai-summary-service/tests/test_evaluation_runner.py -q`; confirm RED.
- [ ] Implement sequential model execution using existing STT/MMR/pipeline functions. Validate official checkpoint hashes before cache-only loading; explicit permission allows model preparation. Isolate application imports in temporary database/data paths and avoid loading owner dotenv. Record device/package versions, Git revision/dirty state, model identity/digest, options and checksums through an allowlist.
- [ ] Preserve old pipeline outputs while exposing actual LLM/fallback/error metadata for the evaluator when existing return values omit it. Add focused regressions proving existing wrapper results and new metadata agree for successful generation, unavailable model and malformed output. Failures must not be renamed successful LLM runs.
- [ ] Run injected-adapter tests and relevant existing pipeline tests. Verify no owner storage path is touched; commit adapters/runner.

### Task 4: Offline reports and manual NLP scorecards

**Files:** create `scripts/evaluation/reports.py`; tests `ai-summary-service/tests/test_evaluation_reports.py`.

**Interfaces:** `generate_reports(run_dir: Path, *, review_csv: Path | None = None) -> list[Path]` consumes the persisted run contract and writes `report.html`, `report.md`, `results.csv`, `review.csv` template and machine-readable summary.

- [ ] Add failing tests for aggregate ASR counts, visible failed rows, actual CPU/device display, source attribution, unreviewed NLP=`not_evaluated`, raw-vs-MMR output comparison, script-like transcript escaping and absence of external HTML resources.
- [ ] Add manual-scorecard tests: approved reference plus explicit one-to-one human task matching yields known TP/FP/FN and precision/recall/F1; duplicate or unknown task/fact matches are rejected. Missing/incomplete/unapproved reviews produce no aggregate NLP score. Owner/deadline correctness denominators must be explicit.
- [ ] Run `python -m pytest ai-summary-service/tests/test_evaluation_reports.py -q`; verify RED.
- [ ] Implement renderers from the same validated run data, using standard HTML escaping and CSV/JSON libraries. Label whitespace-WER, CER, RTF timing scope, pilot size and synthetic-vs-public data. Summaries show human fact coverage and unsupported-claim counts only after completed review, with single-annotator limitations.
- [ ] Run report tests, inspect an offline fixture HTML artifact visually, and commit reports/scorecards.

### Task 5: CLI, measured pilot and defense handoff

**Files:** create `scripts/evaluate_pipeline.py`; tests `ai-summary-service/tests/test_evaluation_cli.py`; update root README and evaluation guide; add a measured acceptance report after actual runs.

**CLI:** `prepare-fleurs --output .evaluation-data/fleurs-vi --limit 20`; `preflight --models tiny base --llm-model llama3:latest`; `run --manifest <asr.jsonl> --manifest evaluation/fixtures/vi_text_cases.jsonl --models tiny base --llm-model llama3:latest --output .evaluation-runs [--allow-model-download]`; `report <run-dir> [--review-csv <path>]`.

- [ ] Write failing subprocess CLI tests for help, malformed manifests, explicit offline failure and injected tiny fixture run producing all report formats without real models/network. Confirm nonzero exits for missing data/model preparation and truthful partial-run summaries.
- [ ] Implement command routing, documentation and explicit input/output paths; preserve `npm run benchmark` behavior. Run CLI tests and the evaluation test group.
- [ ] Prepare public pilot data, verify attribution/checksums and inspect the manifest. Run preflight and record actual hardware/cache/model status. Use explicit named-weight download permission only if required, then run the real pilot and retain raw artifacts.
- [ ] Generate the report with NLP rows unreviewed until the owner approves references and completes scorecards. Check actual numbers against per-row raw counts; open HTML offline and verify layout. Do not fabricate a score or a passing accuracy threshold if inference fails or quality is poor.
- [ ] Run the full appropriate backend suite, frontend tests/lint/build and dependency checks; obtain one independent whole-branch source review, fix validated findings, then verify final artifacts. Record any remaining human-label/deployment boundaries honestly.
- [ ] Integrate locally into `main` under the existing authorization; no remote push. Preserve the benchmark stash, unrelated worktree, real OAuth session and account libraries. Archive only this feature's managed worktree once integration is verified.

## Plan Self-Review

The five review-focus conditions are pinned to tests in their owning tasks. Interfaces and filenames agree across tasks; no new server endpoint or app dashboard is needed. Data-source/model failures remain explicit, cached inputs are checked, and synthetic human labels cannot silently become measured ground truth. The acceptance artifact depends on actual model execution, not just unit-test success.

Recommended execution: **Native**, with the current agent implementing the coupled contracts/adapters/reports and one independent whole-branch reviewer. This avoids repeated handoffs while the data and result schemas are being established; the final review remains independent. User review of this plan/execution choice is pending.
