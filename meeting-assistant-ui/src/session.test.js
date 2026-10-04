import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCitation, createRequestGate } from './session.js';

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
