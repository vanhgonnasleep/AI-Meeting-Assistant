# Navigating the meeting workspace

The dark workspace has five pages. The sidebar lists saved meetings and links to Overview, Tasks and Projects. Collapse or expand it with its button or Ctrl+B (Cmd+B on macOS). On a small screen, collapse it to reach the document underneath.

| Page | What to do here |
| --- | --- |
| Overview | See saved meeting and action-item counts, open recent recordings, or start a meeting. Counts come from the local database. |
| Meeting studio | Choose a recording and its spoken language, start processing, review results, edit notes, and ask questions. |
| Meeting library | Search saved recordings, browse pages, and reopen a transcript. |
| Action items | Search tasks across meetings and filter by assignee, status, or project. Open a task to review its source meeting. |
| Projects | Create a project and review decisions from the meetings assigned to it. Assign meetings through **Edit & review**. |

## Process and review a recording

1. Select **New meeting** or **Start a meeting**.
2. Choose an audio/video file. The current default limit is **256 MiB**, with a maximum decoded duration of **3 hours**. The interface uses the limits reported by the backend.
3. Choose the recording's language. Use English or Tiếng Việt when known; Auto lets transcription detect it. Choose a model if needed. Leave **Save results to library** checked to keep the result, or uncheck it for a session-only meeting. Then select **Start Processing**.
4. You can browse other pages while processing continues. Opening another recording or starting a new meeting is disabled during processing or an unfinished edit/save.
5. Return to the studio for the result. Use the document sections for summary, action items, decisions/risks and transcript. Ask questions in the dock at the bottom and expand its chat drawer to read answers. Review the transcript and source excerpts before relying on generated content.
6. Use **Edit & review** to correct notes, assign a project, and set review status. Export with the existing Markdown, JSON, text, or print controls.

The moving processing indicator means **waiting for the server**, and the timer measures elapsed time in the browser. Neither indicates a percentage or a confirmed transcription/summary stage.

## Navigation and state

Switching pages preserves the selected file, result and chat draft in the current browser session. Leaving the studio removes its audio player; audio is available again when you return, but its playback position can reset. Browser Back/Forward works with page links such as `#/meetings` and `#/projects`.

A full browser reload keeps the destination page, but clears unsaved in-memory file selections and chat drafts. Reopen saved results from the library. Selecting **New meeting** intentionally clears the current studio session.

If you request a saved meeting and navigate elsewhere before it loads, the pending open is canceled. It will not replace your current recording or send you back to the studio later. This cancellation does not stop a recording already being processed.

## Motion and keyboard support

The sidebar expands and collapses with a short transition. Buttons respond to hover and press; the processing screen and recording controls animate while active. Success notifications disappear automatically, while operation errors remain visible until dismissed.

The interface honors the operating system/browser's reduced-motion preference. Use Tab to reach controls and Enter/Space to activate document sections. Escape closes editing dialogs.

No additional setup or package is required for these interface changes.

## Choose what to keep

**Save results to library** is checked when you start a new meeting. It saves the transcript, summary, tasks, insights and subsequent chat to the local database. It does not store the original recording. Existing saved meetings remain available until you explicitly delete them.

Uncheck the option before processing when you only need a temporary result. A **Session only** label appears afterward. You can ask questions, change speaker labels, mark tasks complete and export the result. Selecting **Save this meeting** stores the current result and its chat, including your changes. After confirmation, it shows **Saved to library**. Detailed editing and project assignment are available after saving through **Edit & Review**.

Switching pages preserves a session-only meeting while the app remains open. Reloading the page or starting another meeting clears it; save or export first if you want to keep it. Changing the selected file preserves your current save preference. Starting **New Meeting** resets the preference to checked. Demo results are labeled and cannot be saved through this control.

If saving fails or its confirmation is lost, you can retry. Repeating the same save creates one record. If a previous attempt was saved but you changed its content before retrying, the app reports a conflict; open the saved copy from the library or export the current notes. It does not overwrite that copy.

Opening a different meeting temporarily blocks edits, chat and recording until the open completes or is canceled by navigation. A **Stop waiting** action stops waiting in the browser; processing can continue on the server and may still save a record when saving was enabled.
