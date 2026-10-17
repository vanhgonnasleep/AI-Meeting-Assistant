import { useState } from 'react';
import { needsSpeechReview } from './session.js';

const reasonLabels = { repetition: 'Repeated words', uncertain_recognition: 'Words may have been misheard' };

export default function TranscriptReview({ segments = [], audioUrl, onSeekAudio, onReviewPassage, onAttachReviewAudio, busy = false }) {
  const [drafts, setDrafts] = useState({});
  const passages = segments.map((segment, index) => ({ segment, index })).filter(({ segment }) => needsSpeechReview(segment));
  if (!passages.length) return null;
  return <section aria-label="Transcript review" className="speech-review-panel rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold text-slate-900">Needs review · {passages.length} {passages.length === 1 ? 'passage' : 'passages'}</h2>
        <p className="text-sm text-slate-700 mt-1">Listen and check these words. They are left out of new notes and answers. Existing notes may need updating.</p></div>
      {!audioUrl && onAttachReviewAudio && <label className="speech-review-button cursor-pointer">
        Attach original recording
        <input aria-label="Attach original recording" type="file" accept="audio/*,video/*" disabled={busy} className="sr-only"
          onChange={event => { const file = event.target.files?.[0]; if (file) onAttachReviewAudio(file); event.target.value = ''; }} />
      </label>}
    </div>
    {!audioUrl && <p className="text-xs text-slate-600">Use this meeting’s original recording. Audio stays on this device and is not uploaded by this attachment.</p>}
    {passages.map(({ segment, index }, position) => <details key={index} open={position === 0} className="rounded-xl border border-amber-200/70 bg-white/85 p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">{segment.timestamp || `Passage ${index + 1}`} · {(segment.quality.reasons || []).map(reason => reasonLabels[reason]).filter(Boolean).join(', ') || 'Check against audio'}</summary>
      <div className="mt-3 space-y-3">
        <div><p className="text-xs font-medium text-slate-600">Original recognition</p><p className="mt-1 text-sm max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-slate-700">{segment.text}</p></div>
        <label className="block text-sm text-slate-800">Corrected words
          <textarea maxLength={4000} rows={3} value={drafts[index] ?? ''} disabled={busy}
            onChange={event => setDrafts(previous => ({ ...previous, [index]: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="speech-review-button" disabled={!audioUrl || !Number.isFinite(segment.start) || busy} onClick={() => onSeekAudio?.(segment.start)}>Listen to passage</button>
          <button type="button" className="speech-review-button speech-review-primary" disabled={busy || !onReviewPassage || !drafts[index]?.trim()} onClick={() => onReviewPassage(index, drafts[index])}>Save correction</button>
          <button type="button" className="speech-review-button" disabled={busy || !onReviewPassage} onClick={() => onReviewPassage(index, segment.text)}>Keep these words</button>
          <button type="button" className="speech-review-button" disabled={busy || !onReviewPassage} onClick={() => onReviewPassage(index, '')}>No speech here</button>
        </div>
        <p className="text-xs text-slate-500">Saving clears outdated notes and answers. Regenerate the summary after checking the transcript.</p>
      </div>
    </details>)}
  </section>;
}
