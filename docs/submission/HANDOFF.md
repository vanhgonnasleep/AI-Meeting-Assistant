# Release and defense handoff

Use the [technical project report](PROJECT_REPORT.md) as the written account of the system. These notes are rehearsal material; the department decides which documents must be submitted.

## Lead's checklist

1. Finish regression checks and record the exact submitted commit in `MANIFEST.json`.
2. Generate the source package using the submission script. Extract it into a new folder and check its contents before uploading.
3. Give the presenting team the repository URL, source ZIP, manifest, setup guide and experimental evidence. Share no populated environment file or account database.
4. Have each presenter run the public preview and explain their assigned code path using the actual source map. Assign speaking sections based on what each person can explain; verify contribution statements against the work actually performed.
5. Rehearse the private demo on the presentation machine beforehand. Configure its OAuth callbacks and models separately. Keep an exported meeting and the offline evaluation report as fallback.
6. Submit the department's report and slides alongside the code according to its own rules. This repository does not invent a grading rubric or replace a required university template.

## What presenters should explain

Use this sequence to prepare their own slides:

- The user problem: recordings are difficult to review and action ownership gets lost.
- The workflow: recording → timestamped transcript → optional MMR selection → local summary/action extraction → human review → saved meeting/tasks/projects.
- The implementation: feature folders, bounded request contracts, separate account libraries, revision checks and explicit failure handling.
- The experiment: same 20 ASR cases for tiny and base; CER/WER denominators and normalization; small-sample and read-speech limitations.
- The failure analysis: synthetic NLP can invent tasks for cancelled/no-task situations; its human evaluation is unfinished.
- The demo: public preview is a prepared sample; real analysis is a separate operation. Do not present the instant showcase as fresh model output.
- The next work: approved task labels and real meeting audio collected with consent, then evaluation of negation, owner changes and speaker attribution.

## Questions everyone should be able to answer

**Is it fully offline?** Inference can run locally after setup. Dependency/model downloads and Google/GitHub sign-in require network access. Explicit local mode is available for a single-user offline workflow; it does not provide private multi-account sign-in.

**Is “multi-agent” autonomous planning?** The implementation is a coordinated, modular processing pipeline. Explain its actual stage interfaces instead of implying independently planning agents.

**Does MMR guarantee better summaries?** No. It trades relevance against redundancy and may remove useful detail. The on/off experiment is implemented, but this pilot has no approved NLP quality scores.

**Can you identify speakers accurately?** Acoustic grouping and saved voice profiles are implemented, but the reported ASR pilot does not validate diarization or speaker-identification accuracy.

**What do passing tests prove?** The tested software behaviors passed in the recorded environments. They do not prove perfect AI output, complete security or the absence of all bugs.

**What happens if a save loses its response?** The UI says saving could not be confirmed, preserves the current view/draft where available and asks the user to check before retrying. It does not claim a save failed merely because the browser lost the connection.

**Why do raw errors stay out of the UI?** Users need the affected action, a confirmed cause when available and a recovery step. Infrastructure names, exception text, provider responses and internal paths do not help them recover.

## Demo recovery

If sign-in is unavailable, open the public preview and label it as prepared data. If inference is unavailable, show the existing saved/exported example and the frozen evaluation report. If the connection fails during a write, check the library before repeating it. Never claim the fallback was a successful live AI run.

Older defense documents contain historical module names and stronger claims than the current evidence supports. Use this handoff, the current source map and measured pilot artifacts as the authority for the final defense.

## Speech review demonstration

For a known English meeting, select English explicitly. Show a flagged passage, attach the original recording locally if needed, listen and correct or confirm it. Explain that flags request human review rather than quantify accuracy. Saving a correction clears outdated generated notes and answers; regenerate the summary afterward. Never claim that a repetition detector understands every accent or that the new release has a measured full-meeting WER. The frozen Vietnamese pilot is a separate experiment at its original inference revision.
