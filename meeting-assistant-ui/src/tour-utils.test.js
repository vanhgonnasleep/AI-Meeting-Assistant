import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS,
  getNextStepIndex,
  getPrevStepIndex,
  getStepById
} from './tour-utils.js';

test('TOUR_STEPS contains 4 rich walkthrough stages with valid metadata', () => {
  assert.equal(TOUR_STEPS.length, 4);
  TOUR_STEPS.forEach(step => {
    assert.ok(step.id);
    assert.ok(step.title);
    assert.ok(step.headline);
    assert.ok(step.description);
    assert.ok(Array.isArray(step.highlights));
    assert.ok(step.mockVisual);
  });
});

test('getNextStepIndex wraps around accurately', () => {
  assert.equal(getNextStepIndex(0, 4), 1);
  assert.equal(getNextStepIndex(3, 4), 0);
  assert.equal(getNextStepIndex(-1, 4), 0);
});

test('getPrevStepIndex wraps backwards accurately', () => {
  assert.equal(getPrevStepIndex(2, 4), 1);
  assert.equal(getPrevStepIndex(0, 4), 3);
});

test('getStepById finds correct step or returns default', () => {
  const step = getStepById('transcript');
  assert.equal(step.id, 'transcript');
  assert.equal(getStepById('non-existent').id, TOUR_STEPS[0].id);
});
