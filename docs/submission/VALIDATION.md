# Finalization verification — 16 October 2026

## Scope

This maintenance release separates backend API schemas and summarization from composition, improves user-facing failure handling and supplies an English submission/handoff path. No slides were created: the presenting team owns them. Existing AI prompts, MMR selection, account storage and public/private route policy remain the same.

The API client classifies failures before any server error body can reach a user message. Known field names become ordinary labels. Unknown exceptions receive operation-specific recovery copy. A connection failure during a write is treated as an unknown result, not proof that nothing was saved. Failed writes are not retried automatically.

## Regression evidence

- Frontend: 145 tests pass, including the new failed-fetch, uncertain-write, service-error/session, failed-load recovery and notification geometry regressions. Lint and production build pass; npm audit reports no vulnerabilities.
- Lightweight Python 3.11: 372 tests pass; 11 optional tests skip without speech-model dependencies/downloads.
- Model-enabled backend: 384 tests pass, including the seven submission packaging regressions. One upstream Starlette/AnyIO deprecation warning remains. The log is `%TEMP%/clarion-submission-backend-final.log`.
- Source packaging tests verify committed-only content, byte-identical repeated builds, manifest/ZIP checksums, dirty-tree rejection, exclusion of accidentally committed private/generated paths, credential-safe failures and inclusion of legitimate feature fixture directories.
- Existing summary reduction/context, API, workspace/revision and account-isolation regressions passed after extracting the backend modules. The compatibility entry and injectable generation call site are preserved.

Browser checks used a disposable Vite server with an intentionally unreachable API address. Desktop and a 375px iframe verified the concise sign-in error, wrapping and dismissal. A separate prepared fixture verified two different-height notifications stacking and a notification inside a native edit dialog. The real backend and account data were not altered for these checks. These are emulated viewport/browser checks, not physical-device or exhaustive assistive-technology certification.

## Independent review

The reviewer found false-empty states after dismissal in tasks, a missing reload path in overview, overlapping concurrent notifications and a stale generated handoff path. The implementer reproduced the recovery failures, added regressions, fixed the issues and added a shared measured-height geometry stack. The focused reviewer recheck found no remaining actionable issue. Its StrictMode harness checked resize, dismissal compaction and observer/entry cleanup; browser visual checks were completed separately by the implementer.

## Evidence limits

Passing regressions and a focused review do not establish the absence of every bug or a complete security certification. The archive's credential check matches known patterns and is intentionally limited. The historical ASR/NLP pilot remains tied to its original inference revision; software cleanup does not turn its unfinished NLP scoring into measured accuracy. See the [English pilot companion](../defense/evaluation/2026-10-16-pilot/README.en.md).
