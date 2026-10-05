# Meeting workspace guide

This release extends the existing local application with editable minutes, a task workspace, projects and optional hybrid retrieval. Existing meetings migrate automatically with `revision=0`, `review_status=draft` and no project assignment. No original meeting data is replaced during migration.

## Edit and review a saved meeting

Open a saved meeting from History, then select **Edit & review**. The editor loads the latest stored version. Edit spoken text by segment when available, keeping time metadata; a text-only meeting uses the raw transcript field. Edit summary, task details and insights separately. Save your corrections before using **Regenerate summary**, which reads the saved transcript rather than unsaved input.

Changes produce a new content revision and reset human review to draft. Source corrections clear earlier chat and extracted insights unless edited replacements are explicitly supplied. Inspect and correct the resulting minutes, then mark the unchanged saved result **reviewed**. This is a human workflow label, not a guarantee that AI output is factually correct. Changing a task or speaker afterward returns the meeting to draft.

If another view changes the record while your editor is open, saving returns a version conflict. The editor retains your draft. Reload the latest record and reconcile your changes; do not overwrite blindly. Regeneration similarly refuses to apply a result if the source changed during inference. Model failure leaves the existing summary intact.

## Follow tasks across meetings

Open **Workspace** and its Tasks view. Search literal text and filter by status, assignee or project; pagination applies after filtering. Each task links back to its source meeting, where task text, owner, deadline and status can be edited. Free-form deadlines are preserved; do not assume a natural-language deadline has been normalized into a calendar date. Dates and ownership inferred by AI need human confirmation.

## Connect meetings to a project

Create a project in Workspace. Assign a saved meeting in its editor. Open the project timeline to see decision entries from its assigned meetings, their source, review state and decision status. Edit decision status to proposed, approved, superseded or cancelled after checking the source. Timeline labels default unclassified machine decisions to proposed; meeting review and decision approval are separate concepts.

The timeline displays stored entries. It does not automatically prove that similar phrases refer to the same decision, or infer that a later statement supersedes an earlier one. Use the source meeting to verify and update statuses. Reassigning a meeting moves its entries to the selected project; unassigning removes it from that project view without deleting the meeting.

## Optional semantic chat

Keyword chat remains the default. Enable the semantic option and select an installed local embedding model to combine keyword and semantic ranks. Ollama supports `/api/embed`; the default model name is `embeddinggemma`. To prepare it using your existing Ollama installation:

```text
ollama pull embeddinggemma
```

This requires a model download and disk/RAM capacity. The application does not automatically download it. Its text processing is local. [Ollama embeddings documentation](https://docs.ollama.com/capabilities/embeddings) explains model support and cosine search.

Hybrid ranking uses reciprocal rank fusion with constant 60. Semantic candidates require cosine similarity at least 0.45; this is an implementation threshold, not calibrated answer confidence. Original transcript text and source metadata are retained in citations. Quoted suggested questions use their quoted excerpt as the semantic anchor.

Embedding work is bounded: at most 256 source chunks, at most 4000 characters per chunk, batches of 32, an 8-second request budget across batches, vector dimensions up to 4096. HTTP timeouts do not cancel inference already running inside Ollama. A process-local LRU cache is limited to 131072 scalar values and keyed by model plus source-content hash, so editing the transcript changes cache keys. Restart the backend after replacing a model under the same name to clear cached vectors. Oversized sources, unavailable models or malformed vectors fall back to lexical retrieval with a warning. A broad overview continues to use the existing explicit source sample.

A retrieved source can still be insufficient to support a generated claim. Representative Vietnamese and mixed-language evaluation is needed to tune model choice and similarity thresholds. Validate important answers against their excerpts.

## Operational scope

The app continues to target one user on loopback. Review revisions prevent accidental lost updates; they are not accounts or ownership authorization. The existing two-request AI admission limit also applies to summary regeneration. Persistence still stores transcript/results rather than the original audio. Task and timeline queries read records in batches of 200 and return at most 100 entries per page (the UI requests 50); exact totals still require scanning the matching records. These features do not require a new database server or frontend runtime package.
