# Maintenance audit acceptance criteria

This maintenance pass follows the existing workspace design: preserve saved meeting data,
migrate schemas without dropping content, keep inference local, and distinguish demonstrations
from real results. It fixes existing operations rather than adding product features.

## Contracts

- DB management commands migrate the original meetings schema using the application's
  migration column definitions before creating indexes; existing rows survive unchanged.
- Seeding resolves projects by their Unicode casefolded names, never by assumed IDs.
  Existing projects and meetings retain their relationships.
- Every backup has its own file, including calls in the same clock tick. Backup connections
  close on errors. Restore rejects the live database itself and invalid SQLite inputs before
  touching the live database, and backs up valid live data before restoring.
- The Node command wrapper prefers the backend venv on Windows and POSIX, propagates
  nonzero failures, and treats launch errors/signals as failure.
- The Windows launcher resolves its venv executable before changing directories, checks
  Python fallback commands at execution time, and stops if dependency installation fails.
  Offline inference messages match actual transcript-based fallback behavior.
- Benchmarks report measured results only. Unavailable/failed Whisper inference is skipped
  with a reason and absent timing metrics. Reports identify the synthetic MMR fixture and
  sequential SQLite workload; they claim neither semantic retention nor concurrency results.

## Execution and verification

1. Add failing regressions using isolated temporary databases and external-inference doubles.
2. Fix DB migration, project resolution, backup and restore, then run targeted regressions.
3. Fix script interpreter/launcher handling and benchmark reporting; run regressions.
4. Run backend tests (including installed model integration), frontend tests/lint/build and
   production dependency audit. Obtain independent review before main integration.
5. Verify GitHub open PRs, publish verified fixes and check CI for the resulting commit.

Review focus: legacy schema preservation; project ID collisions; same-tick backups; invalid
or self restore; failed interpreter launch; unavailable model timings reported as evidence.
