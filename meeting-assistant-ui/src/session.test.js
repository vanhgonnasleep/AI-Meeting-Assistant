import test from 'node:test';
import assert from 'node:assert/strict';
import * as session from './session.js';
import { normalizeCitation, createRequestGate, editSpeakerAttribution, resultFromMeeting } from './session.js';

test('speaker edits change labels without replacing names in spoken content', () => {
  const initial = { segments: [
    { speaker: 'Speaker 1', text: 'Speaker 1 owns this item.', start: 1, timestamp: '[00:01 - 00:03]' },
    { speaker: 'Speaker 2', text: 'Review tomorrow.', start: 3, timestamp: '[00:03 - 00:05]' },
  ], insights: { decisions: [{ speaker: 'Speaker 1', start: 1, text: 'Review tomorrow' }] } };
  const updated = editSpeakerAttribution(initial, 'Speaker 1', 'Alice');
  assert.deepEqual(updated.speakers, ['Alice', 'Speaker 2']);
  assert.equal(updated.segments[0].text, 'Speaker 1 owns this item.');
  assert.match(updated.transcript, /Alice: Speaker 1 owns this item\./);
  assert.equal(updated.insights.decisions[0].speaker, 'Alice');
  assert.equal(initial.segments[0].speaker, 'Speaker 1');
});

test('reopened meetings derive speaker controls from persisted segments', () => {
  const result = resultFromMeeting({ raw_transcript: 'Transcript', segments: [{ speaker: 'Alice' }, { speaker: 'Bob' }, { speaker: 'Alice' }] });
  assert.deepEqual(result.speakers, ['Alice', 'Bob']);
  assert.equal(result.transcript, 'Transcript');
});

test('legacy null segment entries do not crash detail loading or editing', () => {
  const result = resultFromMeeting({ segments: [null, { speaker: 'Alice', text: 42 }] });
  assert.deepEqual(result.speakers, ['Alice']);
  assert.doesNotThrow(() => editSpeakerAttribution(result, 'Alice', 'Bob'));
});

test('object citations retain their audio position and renderable label', () => {
  assert.deepEqual(normalizeCitation({ timestamp: '01:02:03', start: 3723 }), { label: '01:02:03', seconds: 3723 });
});

test('string citations support hours and ranges', () => {
  assert.equal(normalizeCitation('[01:02:03 - 01:02:10]').seconds, 3723);
  assert.equal(normalizeCitation('00:14').seconds, 14);
});

test('text-only citations cannot seek to invented audio positions', () => {
  assert.equal(normalizeCitation({ timestamp: 'Segment #1', start: null }).seconds, null);
  assert.equal(normalizeCitation('nonsense').seconds, null);
});

test('new sessions invalidate pending requests even if transport ignores abort', () => {
  const gate = createRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.isCurrent(), true);
  gate.cancel();
  assert.equal(second.isCurrent(), false);
});

test('invalid timestamp components cannot become seekable through a valid suffix', () => {
  for (const label of ['01:99:12', '1:2:03', '1234:56', '-00:14']) {
    assert.equal(normalizeCitation(label).seconds, null, label);
  }
});

test('persisted chat content and citation collections are safe to render and edit', () => {
  const result = resultFromMeeting({ chat_history: [{ role: 'assistant', content: 42, citations: 'bad' }, { content: null, citations: [null, '00:14'] }] });
  assert.equal(result.chat_history[0].content, '42');
  assert.deepEqual(result.chat_history[0].citations, []);
  assert.equal(result.chat_history[1].content, '');
  assert.deepEqual(result.chat_history[1].citations, ['00:14']);
  assert.doesNotThrow(() => editSpeakerAttribution({ ...result, segments: [] }, 'Alice', 'Bob'));
});

test('JSON export retains in-progress task status until the user changes completion', () => {
  assert.equal(typeof session.getExportTasks, 'function');
  const tasks = [{ task: 'Release', status: 'in_progress' }, { task: 'Review', status: 'done' }];
  assert.equal(session.getExportTasks(tasks, { 0: false, 1: true })[0].status, 'in_progress');
  assert.equal(session.getExportTasks(tasks, { 0: true, 1: false })[0].status, 'completed');
  assert.equal(session.getExportTasks(tasks, { 0: true, 1: false })[1].status, 'pending');
  assert.equal(session.getExportTasks(tasks, {})[1].status, 'done');
});

test('Enter used to finish input composition does not submit an unfinished chat question', () => {
  assert.equal(typeof session.shouldSubmitChat, 'function');
  assert.equal(session.shouldSubmitChat({ key: 'Enter', nativeEvent: { isComposing: true } }), false);
  assert.equal(session.shouldSubmitChat({ key: 'Enter', nativeEvent: { isComposing: false } }), true);
  assert.equal(session.shouldSubmitChat({ key: 'Enter', shiftKey: true }), false);
});

test('legacy scalar display fields become safe transcript and summary text', () => {
  const result = resultFromMeeting({ raw_transcript: 42, executive_summary: { text: 'legacy' },
    action_items: [{ task: 17, assignee: 20 }], insights: { decisions: [{ text: 45 }] } });
  assert.equal(result.transcript, '42');
  assert.equal(typeof result.summary, 'string');
  assert.equal(result.action_items[0].task, '17');
  assert.equal(result.action_items[0].assignee, '20');
  assert.equal(result.insights.decisions[0].text, '45');
});
