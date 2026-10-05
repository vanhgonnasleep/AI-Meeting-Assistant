import test from 'node:test';
import assert from 'node:assert/strict';
import * as navigation from './navigation.js';
import { createRequestGate } from './session.js';

test('navigation subscriptions invalidate delayed meeting opens independently of processing and dispose cleanly', async t => {
  const originalWindow = globalThis.window;
  const events = new EventTarget();
  globalThis.window = events;
  t.after(() => { globalThis.window = originalWindow; });
  const detail = createRequestGate();
  const processing = createRequestGate();
  const delayedOpen = detail.begin();
  const ongoingProcess = processing.begin();
  const unsubscribe = navigation.subscribeToNavigation(() => detail.cancel());
  events.dispatchEvent(new Event('hashchange'));
  await Promise.resolve(); // A transport that ignores abort can still complete later.
  assert.equal(delayedOpen.isCurrent(), false);
  assert.equal(delayedOpen.signal.aborted, true);
  assert.equal(ongoingProcess.isCurrent(), true);
  unsubscribe();
  const laterOpen = detail.begin();
  events.dispatchEvent(new Event('hashchange'));
  assert.equal(laterOpen.isCurrent(), true);
});

test('direct links resolve to their page after reload', () => {
  assert.equal(typeof navigation.resolveAppPage, 'function');
  for (const [hash, page] of [['#/overview', 'overview'], ['#/studio', 'studio'],
    ['#/meetings', 'meetings'], ['#/tasks', 'tasks'], ['#/projects', 'projects']]) {
    assert.equal(navigation.resolveAppPage(hash), page);
  }
});

test('empty and malformed links fall back to overview rather than an empty screen', () => {
  assert.equal(typeof navigation.resolveAppPage, 'function');
  for (const hash of ['', undefined, '#', '#/unknown', '#/tasks/extra', '#/javascript:alert(1)']) {
    assert.equal(navigation.resolveAppPage(hash), 'overview');
  }
  assert.equal(navigation.resolveAppPage('#/meetings?search=budget'), 'meetings');
});

test('navigation emits local links and rejects an external destination', () => {
  assert.equal(typeof navigation.appPageHref, 'function');
  assert.equal(navigation.appPageHref('meetings'), '#/meetings');
  assert.equal(navigation.appPageHref('projects'), '#/projects');
  assert.throws(() => navigation.appPageHref('https://attacker.example'), RangeError);
});

test('a new meeting cannot replace an upload or an unfinished edit', () => {
  assert.equal(typeof navigation.canOpenAnotherMeeting, 'function');
  assert.equal(navigation.canOpenAnotherMeeting({ processing: true }), false);
  assert.equal(navigation.canOpenAnotherMeeting({ saving: true }), false);
  assert.equal(navigation.canOpenAnotherMeeting({ editing: true }), false);
  assert.equal(navigation.canOpenAnotherMeeting({ processing: false, saving: false, editing: false }), true);
});

test('long recordings retain their hour component in the library and player', () => {
  assert.equal(typeof navigation.formatMeetingDuration, 'function');
  assert.equal(navigation.formatMeetingDuration(6238.2266), '01:43:58');
  assert.equal(navigation.formatMeetingDuration(65), '01:05');
  assert.equal(navigation.formatMeetingDuration(3665), '01:01:05');
});

test('invalid legacy durations do not render NaN or an infinite time', () => {
  assert.equal(typeof navigation.formatMeetingDuration, 'function');
  for (const value of [null, undefined, -1, 0, NaN, Infinity, '60']) {
    assert.equal(navigation.formatMeetingDuration(value), null);
  }
});
