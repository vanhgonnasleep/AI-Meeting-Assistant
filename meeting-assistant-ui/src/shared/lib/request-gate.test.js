import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestGate } from './request-gate.js';

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

