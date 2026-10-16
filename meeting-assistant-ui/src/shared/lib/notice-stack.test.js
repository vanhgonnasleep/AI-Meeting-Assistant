import { test } from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./notice-stack.js').catch(() => ({}));

test('different-height notifications stack without overlap and compact after dismissal', () => {
  assert.equal(typeof implementation.createNoticeStack, 'function');
  const stack = implementation.createNoticeStack();
  const scope = {};
  stack.update('save', 180, scope);
  stack.update('projects', 240, scope);
  assert.deepEqual(stack.layout('save'), { offset: 0, count: 2 });
  assert.deepEqual(stack.layout('projects'), { offset: 192, count: 2 });
  stack.update('save', 220, scope);
  assert.equal(stack.layout('projects').offset, 232);
  stack.remove('save');
  assert.deepEqual(stack.layout('projects'), { offset: 0, count: 1 });
});

test('dialog notifications have their own stack and unchanged measurements do not loop', () => {
  assert.equal(typeof implementation.createNoticeStack, 'function');
  const stack = implementation.createNoticeStack();
  const page = {}, dialog = {};
  let changes = 0;
  const stop = stack.subscribe(() => { changes += 1; });
  stack.update('page', 180, page);
  const snapshot = stack.getSnapshot();
  stack.update('page', 180, page);
  assert.equal(stack.getSnapshot(), snapshot);
  assert.equal(changes, 1);
  stack.update('dialog', 180, dialog);
  assert.deepEqual(stack.layout('dialog'), { offset: 0, count: 1 });
  stop();
});
