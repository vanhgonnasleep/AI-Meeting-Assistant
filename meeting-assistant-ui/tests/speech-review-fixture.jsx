import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TranscriptReview from '../src/features/meetings/TranscriptReview.jsx';
import { reviewPassage } from '../src/features/meetings/session.js';
import '../src/styles/index.css';
import '../src/styles/clarion.css';

const source = { transcript: '[Unclear speech - review audio]', summary: 'Outdated fixture notes', action_items: [],
  segments: [{ text: 'ni '.repeat(60), timestamp: '[00:02 - 00:05]', start: 2, end: 5,
    quality: { status: 'needs_review', reasons: ['repetition'] } },
    { text: 'Please review the budget.', timestamp: '[00:06 - 00:09]', start: 6, end: 9,
      quality: { status: 'needs_review', reasons: ['uncertain_recognition'] } }] };
export default function Fixture() {
  const [result, setResult] = useState(source);
  const [session, setSession] = useState(0);
  const [notice, setNotice] = useState('Synthetic data · no server saves or AI inference');
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12 space-y-6">
    <header><p className="text-sm font-semibold text-indigo-600">CLARION / REVIEW FIXTURE</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Make the words worth trusting.</h1>
      <p className="mt-3 text-slate-600">Check the uncertain moments before creating new meeting notes.</p></header>
    <TranscriptReview key={session} segments={result.segments}
      onReviewPassage={(index, text) => { setResult(reviewPassage(result, index, text)); setNotice('Passage checked in this local fixture. Outdated notes cleared.'); }}
      onAttachReviewAudio={() => setNotice('Attachment callback reached. This fixture does not retain the file.')} />
    {!result.segments.some(item => item.quality?.status === 'needs_review') && <p className="rounded-xl bg-emerald-50 p-5 text-emerald-900">All passages checked. Ready to regenerate notes.</p>}
    <p role="status" className="text-sm text-slate-600">{notice}</p>
    <button className="speech-review-button" onClick={() => { setResult(source); setSession(value => value + 1); setNotice('Synthetic fixture reset.'); }}>Reset fixture</button>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
