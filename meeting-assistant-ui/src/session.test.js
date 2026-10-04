import test from 'node:test';
import assert from 'node:assert/strict';
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
