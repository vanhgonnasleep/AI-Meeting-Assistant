# Clarion: Design, Implementation and Evaluation of an AI Meeting Assistant

Technical project report · 17 October 2026

This report describes the submitted implementation and the evidence available for it. Adapt its formatting to the department's submission requirements. Presenter notes are maintained separately in [HANDOFF.md](HANDOFF.md); this report is intended to accompany the code rather than serve as a script to read aloud.

## 1. Problem and objectives

Meeting recordings preserve conversations but make decisions and responsibilities difficult to find. Clarion turns a recording into a searchable, reviewable workspace containing timestamped speech, summaries, tasks and evidence-linked answers. The central requirement is traceability: a useful result must remain connected to what was actually said, and uncertain recognition must be visible before people rely on it.

The project implements local speech and language-model inference, separate account libraries, a public sample preview and a human review workflow. It does not claim perfect transcription, automatic understanding of every accent or verified speaker identification.

## 2. Implemented functions

| Function | User outcome | Important boundary |
| --- | --- | --- |
| Public landing and workspace preview | Explore meeting, task and project screens without an account | Prepared samples, clearly separate from live inference |
| Google/GitHub sign-in | Access a private meeting library | Provider clients and callback URLs require separate configuration |
| Recording and audio/video upload | Supply meeting audio for processing | Upload size, duration and concurrency are bounded |
| Timestamped transcription | Read speech and return to a point in the recording | Recognition and language detection can be wrong |
| Acoustic speaker grouping and profiles | Correct speaker labels and reuse enrolled acoustic profiles | Accuracy has not been measured on representative meeting speakers |
| Uncertain-passage review | Listen, correct, confirm original words or mark no speech | Review indicators are heuristics, not calibrated confidence percentages |
| Summaries and structured actions | Find the main points, owners and deadlines | Generated content remains a draft requiring human checks |
| Decisions, risks and open questions | Review outcomes beyond a plain transcript | Extraction depends on accepted source and model behavior |
| Meeting chat with streaming and citations | Ask questions and inspect supporting passages | Citations aid checking; they do not prove an answer is correct |
| Search, tasks and projects | Find prior meetings and track follow-up work | Source edits can invalidate previously generated outputs |
| Human editing, review and exports | Correct and hand over minutes | Optimistic revision checks reject stale saved edits |

## 3. Architecture and code organization

The browser application uses React and Vite. Feature folders group authentication, recording, meetings, chat, overview, workspace and public preview behavior. Shared modules provide notifications, error classification and common UI. The FastAPI backend separates API contracts, authentication, request controls and processing stages. SQLite storage is shared through the root `database` package. Docker packages the frontend and backend; a mounted data directory preserves SQLite files across restarts.

```text
Recording
  -> FFmpeg audio preparation
  -> Whisper recognition and timed segments
  -> source-quality review annotations
  -> accepted-source selection
  -> optional TF-IDF/MMR sentence selection
  -> local summary, action and insight generation
  -> draft meeting in SQLite
  -> human review, projects, tasks, exports and cited chat
```

The term “agents” refers to coordinated processing modules. This implementation does not depend on independently planning autonomous agents. See [the source map](../source-layout.md) for file-level entry points.

Private mode selects account-scoped storage. Public preview uses client-only fixtures and does not import samples into private libraries. An explicit local mode supports a single-user offline workflow. Inference can run locally after model installation; OAuth sign-in and initial dependency/model downloads still require network access.

## 4. Speech recognition and uncertainty handling

Speech quality is a prerequisite for useful summaries. Different accents, background noise, overlap, proper names and poor recording levels can all produce recognition errors. Repeated output such as “ni ni ni” is a decoding failure signal, not reliable meeting evidence.

The release retains `condition_on_previous_text=False` to limit repetition propagating through Whisper's context. It corrects two application defects: short recordings previously exposed unfiltered aggregate text, and filtering incorrectly treated decoding-window fallback scores as independent reasons to delete individual segments. High no-speech probability alone no longer removes otherwise supported speech. Automatic language detection is not fixed to the first long-recording chunk, so an early wrong guess does not force every subsequent chunk into that language.

A shared policy detects sustained repeated word patterns and low recognition log probability. Original recognition remains in the segment record. Normal transcript views show an explicit unclear-speech placeholder for unresolved passages, and new summaries, action extraction, insights and chat retrieval exclude those passages. If every passage needs review, the system returns a reviewable draft without generating notes from that source.

Users can attach the original recording locally after reopening a saved meeting, because original recordings are not retained by the library. The attachment must match the meeting filename; this is a usability check, not proof of file identity. The user must verify the recording matches. Timestamped controls seek into attached audio. A person can correct the words, explicitly keep them, or mark the interval as containing no speech. The original recognition is retained in review metadata.

A source correction clears outdated generated notes, tasks, insights and answers. The user can regenerate the summary from the accepted transcript. Existing legacy notes are not silently rewritten merely by opening a meeting; the review screen warns they may need updating. Human-confirmed passages remain confirmed when later edits make the overall meeting a draft again. Correction drafts are isolated by meeting and source passage.

These safeguards reduce the chance of presenting known suspect speech as reliable evidence. They do not detect every transcription error, reconstruct inaudible speech, or establish an improvement in word error rate.

## 5. Summarization and information retrieval

MMR balances sentence relevance against similarity to already selected sentences, using sparse TF-IDF representations. The selection parameter controls that trade-off. Reducing repetition can shorten model input, but can also omit important details; reduction alone is not evidence of higher summary quality.

Long transcripts use bounded map/reduce summarization. Structured action extraction normalizes task fields and preserves both spoken deadline text and an ISO date where interpretation is supported. Chat uses source retrieval, optional local embeddings and evidence citations. When an embedding service is unavailable, the application can visibly fall back to keyword retrieval. Semantic similarity and model fluency are not confidence measures.

## 6. Experiments and results

### Frozen Vietnamese ASR pilot

The existing pilot used the first 20 Vietnamese FLEURS test recordings, totaling 239.04 seconds, with tiny and base models on CPU. Its inference revision is `cd8feba`; later release changes do not change the provenance of those measurements.

| Model | Completed cases | CER | Whitespace WER | Recorded RTF |
| --- | --- | --- | --- | --- |
| tiny | 20/20 | 44.99% | 64.60% | 0.160 |
| base | 20/20 | 21.13% | 37.29% | 0.125 |

CER/WER use edit distance divided by the number of reference characters/words after the runner's normalization. Lower is better. Whitespace tokenization is an evaluation convention, not Vietnamese linguistic word segmentation. RTF is elapsed inference time divided by audio duration. Fixed run order and warm-up effects prevent a general conclusion that base is faster than tiny.

The sample is short, read speech. It does not establish performance on long meetings, accents, overlapping speakers, noise or diarization. Raw rows, model hashes, configuration, checksums and the English evidence guide are in [the frozen pilot directory](../defense/evaluation/2026-10-16-pilot/README.en.md).

### NLP and MMR pilot

Six synthetic transcript cases were run with MMR off and on: 12 outputs, 11 complete and one partial because action extraction used a heuristic fallback. Human reference approval and scoring remain unfinished. Summary accuracy, task F1 and MMR quality gains are therefore **not evaluated**. Those outcomes must not be inferred from successful requests or test counts.

### Long-recording diagnostic

Three 60-second excerpts at 0, 1800 and 4500 seconds of the reported committee recording were checked locally with cached Whisper base, automatic language selection and previous-text conditioning disabled. Detected languages were `mi`, `en` and `mi`. The reported repetition loop was not reproduced in these three excerpts. This supports investigating language selection; it does not identify the sole cause of the original failure. There is no approved reference transcript or full-recording WER result. For a known English meeting, selecting English explicitly avoids relying on automatic language selection.

## 7. Software validation and review

The release was checked with the fully provisioned backend environment, including local model integration tests: **428 passed**. The frontend regression suite reports **161 passed**. Lint, production build and the dependency audit are separate gates, recorded in [the release validation notes](../releases/speech-review/README.md). Regression counts establish tested software behavior, not recognition accuracy.

New regressions cover suspect speech exclusion, preservation of original evidence, all-uncertain input, legacy review status across five edit paths, revision conflicts, microphone chunks, language selection, correction draft isolation, sibling draft preservation and conflict recovery. Independent review identified two source/review lifecycle bugs; both were reproduced, fixed and independently rechecked. Browser checks used synthetic data on desktop and in a 375px iframe. They are not a physical-device or comprehensive accessibility certification.

## 8. Limitations and future work

The highest-value next experiment is a consented, manually transcribed meeting dataset covering accents, recording conditions, code-switching and overlapping speakers. Measure WER/CER by condition, missed versus falsely flagged passages, diarization error and correction time. Use separate development and held-out recordings before tuning thresholds. Approve reference labels before reporting NLP precision/recall/F1, and compare MMR on/off on the same cases with a human rubric.

Future model comparisons should control hardware, warm-up and decoding settings. Larger models, stronger diarization or domain vocabulary assistance should be adopted only after a measured benefit. The frozen submission remains the tested implementation; new experiments belong in later work.

## 9. Submission and demonstration

Submit the commit-addressed source ZIP, `MANIFEST.json`, setup instructions, this report adapted to the required template and the measured evidence. Exclude populated environment files, private account databases, personal recordings, model weights and dependency caches. The [submission guide](README.md) explains packaging and checksums.

Present the problem, architecture, real workflow and measured results, then demonstrate an uncertain passage being reviewed before notes are regenerated. Identify prepared preview data explicitly. Keep [presenter notes](HANDOFF.md) for rehearsal and question preparation; the department determines what must be formally submitted. No claim of perfect accents, complete security or bug-free software is made.
