# Navigating the meeting workspace

The dark workspace has five pages. The sidebar stays available on desktop; the menu button opens navigation on a small screen.

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
3. Choose **Spoken language**. Use English or Tiếng Việt when known; Auto lets transcription detect it. Choose a model if needed, then select **Start Processing**.
4. You can browse other pages while processing continues. Opening another recording or starting a new meeting is disabled during processing or an unfinished edit/save.
5. Return to **Meeting studio** for the result. Use the result tabs for summary, action items, insights, chat, and transcript. Review the transcript and source excerpts before relying on generated content.
6. Use **Edit & review** to correct notes, assign a project, and set review status. Export with the existing Markdown, JSON, text, or print controls.

The moving processing indicator means **waiting for the server**, and the timer measures elapsed time in the browser. Neither indicates a percentage or a confirmed transcription/summary stage.

## Navigation and state

Switching pages preserves the selected file, result, chat draft, and audio position in the current browser session. Audio pauses when you leave the studio. Browser Back/Forward works with page links such as `#/meetings` and `#/projects`.

A full browser reload keeps the destination page, but clears unsaved in-memory file selections and chat drafts. Reopen saved results from the library. Selecting **New meeting** intentionally clears the current studio session.

If you request a saved meeting and navigate elsewhere before it loads, the pending open is canceled. It will not replace your current recording or send you back to the studio later. This cancellation does not stop a recording already being processed.

## Motion and keyboard support

Page and result-tab changes use short transitions; the sidebar selection slides between destinations. Loading and processing indicators animate only while an operation is active. Success notifications disappear automatically, while operation errors remain visible until dismissed.

The interface honors the operating system/browser's reduced-motion preference. Use Tab to reach controls, arrow keys or Home/End inside the meeting result tab list, and Escape to close navigation or editing dialogs. **Skip to content** moves keyboard focus past the sidebar.

No additional setup or package is required for these interface changes.
