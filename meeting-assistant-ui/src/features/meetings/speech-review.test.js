import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as session from './session.js';

const suspect = { text: 'ni '.repeat(40), start: 2, end: 5, timestamp: '[00:02 - 00:05]',
  quality: { status: 'needs_review', reasons: ['repetition'] } };

test('review correction preserves recognition evidence and invalidates generated outputs', () => {
  assert.equal(typeof session.reviewPassage, 'function');
  const original = { segments: [suspect], transcript: 'Old source', summary: 'Stale summary',
    action_items: [{ task: 'Stale task' }], insights: { decisions: [{ text: 'Stale decision' }] }, chat_history: [{ content: 'Stale answer' }] };
  const updated = session.reviewPassage(original, 0, 'The budget is approved.');
  assert.equal(updated.segments[0].text, 'The budget is approved.');
  assert.equal(updated.segments[0].quality.original_text, suspect.text);
  assert.equal(updated.segments[0].quality.status, 'reviewed');
  assert.equal(updated.summary, '');
  assert.deepEqual(updated.action_items, []);
  assert.deepEqual(updated.chat_history, []);
  assert.equal(original.segments[0].quality.status, 'needs_review');
  assert.throws(() => session.reviewPassage(original, 0, 'x'.repeat(4001)));
  assert.equal(session.correctedSpeechSegment(suspect, 'Budget ').text, 'Budget ', 'Typing a word separator must not erase it');
});

test('uncertain passages cannot become suggested questions', () => {
  assert.deepEqual(session.getSuggestedPrompts({ segments: [suspect], transcript: suspect.text }), []);
});

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { default: DocumentWorkspace } = await server.ssrLoadModule('/src/features/meetings/DocumentWorkspace.jsx');
test('workspace exposes a review action and local audio attachment for uncertain passages', () => {
  const markup = renderToStaticMarkup(createElement(DocumentWorkspace, {
    result: { transcript: '[Unclear speech - review audio]', summary: '', action_items: [], insights: {}, segments: [suspect] },
    completedTasks: {}, transcriptView: 'segments', speakerFilter: 'all', elapsedTime: 0,
    onReviewPassage() {}, onAttachReviewAudio() {},
  }));
  assert.match(markup, /Needs review/);
  assert.match(markup, /Save correction/);
  assert.match(markup, /Attach original recording/);
  assert.doesNotMatch(markup, /\d+% accurate/);
});
