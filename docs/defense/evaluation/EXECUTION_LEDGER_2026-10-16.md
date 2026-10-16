# SDD ledger — plan: docs/superpowers/plans/2026-10-16-defense-evaluation.md

Approved spec and plan; user selected Native execution. Baseline 1eef0acee391bcce26ee955c463d43fda747d29e. Owner app stays on localhost:8002/5173; never use its libraries for measurements.

Pre-flight: Tasks 1→2/3 share load_cases(Path)->list[dict]; consistent.
Pre-flight: Tasks 1/3→4 share raw per-row edit counts, status/errors and run.json; consistent, failed rows retained.
Pre-flight: Tasks 2/3/4→5 share manifest/run paths and CLI routing; consistent.
Pre-flight: no other shared-interface conflict found. Public FLEURS /rows currently500: scan size691121172 exceeds300000000. Investigate official bounded source fallback in Task2, do not fabricate data.

Task 1: in progress; BASE 1eef0acee391bcce26ee955c463d43fda747d29e.
Task 1: complete (commits 1eef0ac..62c2201, tests: C:/Users/luong/AI-Meeting-Assistant/ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests/test_evaluation_metrics.py ai-summary-service/tests/test_evaluation_manifest.py -q → 18 passed in 0.65s)
Task 2: Ruling: use optional pinned PyArrow for bounded official Parquet fallback because rows API cannot scan the shard; extra 28 MB tooling dependency and 691 MB download, no app runtime change. Cost if wrong: preparation must be rerun with a supported Arrow wheel.
Task 2: complete (commits 62c2201..641195e, tests: C:/Users/luong/AI-Meeting-Assistant/ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests/test_evaluation_datasets.py -q → 5 passed in 0.15s)
Task 3: Ruling: expand authored discussions without extra commitments so the unchanged production MMR threshold actually applies; short originals were all no-ops. Cost if wrong: owner must revise synthetic references before any NLP scoring.
Task 3: complete (commits 641195e..8193fa6, tests: C:/Users/luong/AI-Meeting-Assistant/ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests/test_evaluation_runner.py ai-summary-service/tests/test_mmr.py ai-summary-service/tests/test_reliability.py ai-summary-service/tests/test_audit_regressions.py ai-summary-service/tests/test_processing_language.py -q → 58 passed, 1 warning in 6.76s)
Task 4: complete (commits 8193fa6..31b7fd6, tests: C:/Users/luong/AI-Meeting-Assistant/ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests/test_evaluation_reports.py -q → 10 passed in 0.21s)
Task 5: Ruling: apply Native final-review/integration gates after software/pilot task completion; the plan folded them into Task 5 but executing-plans requires a final whole-branch gate after task-done. Cost if wrong: bookkeeping order only; review and merge remain mandatory.
Task 5: complete (commits 31b7fd6..efa2586, tests: C:/Users/luong/AI-Meeting-Assistant/ai-summary-service/venv/Scripts/python.exe -m pytest ai-summary-service/tests/test_evaluation_metrics.py ai-summary-service/tests/test_evaluation_manifest.py ai-summary-service/tests/test_evaluation_datasets.py ai-summary-service/tests/test_evaluation_runner.py ai-summary-service/tests/test_evaluation_reports.py ai-summary-service/tests/test_evaluation_cli.py -q → 44 passed in 6.71s)

Final: reviewer independently recomputed all 40 ASR metrics and checked nine artifact hashes; Critical none, Important two, Minor one.
Final: minor (deferred): metadata JSON fetch checks 4 MiB after buffering; a future change should stream the metadata limit. Audio/model/Parquet payloads already enforce streaming caps.
Final: Ruling: preserve valid-empty-array heuristic behavior — production contract is explicitly preserved, detailed metadata discloses the actual fallback — cost if wrong: no-task inputs may still yield heuristic false positives, so NLP quality remains unclaimed.
Final: Ruling: exclude diarization/natural-meeting generalization — the approved pilot is public reading speech, and reports state the boundary — cost if wrong: a separate consented meeting corpus is still required.
Final: Ruling: accept source/tests/artifact review without a second real inference or owner-library inspection — hashes/raw metrics and a completed real run exist, and isolated-storage tests avoid private data — cost if wrong: undetected environment-specific reproducibility or private-runtime issues remain outside this evaluator review.
Final: fixed interrupted subset NLP scoring and invisible unstarted variants — test_interrupted_run_never_scores_completed_subset_or_hides_unstarted_variant RED→GREEN; suite 376/376.
Final: fixed coupled preflight — test_runner_preflights_only_manifest_capabilities (ASR/NLP), test_asr_preflight_never_contacts_ollama, test_nlp_preflight_never_checks_whisper_cache RED→GREEN; suite 376/376.
Final: fixed evidence newline conversion — test_evidence_checkout_does_not_change_checksum_bytes RED→GREEN; suite 376/376.
Final: focused 50/50; full backend 376/376 including real model tests, one upstream deprecation. Frontend 125/125, lint/build and npm audit clean; pip check clean. No further code change after this suite.
