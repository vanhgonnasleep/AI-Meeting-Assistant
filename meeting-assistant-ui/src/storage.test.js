import test from 'node:test';
import assert from 'node:assert/strict';
import * as storage from './storage.js';

test('manual save includes current task completion, attribution and chat rather than the original result', () => {
  assert.equal(typeof storage.buildMeetingSavePayload, 'function');
  const payload = storage.buildMeetingSavePayload({ saveKey: 'session-id', filename: 'Notes.wav',
    result: { transcript: 'Alice: Review.', summary: 'Review.', language: 'en', duration: 65,
      segments: [{ text: 'Review.', speaker: 'Alice', start: 0, end: 5, confidence: 0.9 }],
      action_items: ['Review access', { task: 'Audit', assignee: 'Bob', status: 'in_progress' }], insights: {} },
    completedTasks: { 0: true }, chatMessages: [{ role: 'user', content: 'Who?' }] });
  assert.equal(payload.raw_transcript, 'Alice: Review.');
  assert.equal(payload.action_items[0].task, 'Review access');
  assert.equal(payload.action_items[0].status, 'completed');
  assert.equal(payload.action_items[1].status, 'in_progress');
  assert.equal(payload.segments[0].confidence, 0.9);
  assert.equal(payload.chat_history[0].content, 'Who?');
  assert.equal(payload.save_key, 'session-id');
});

test('demo results cannot become real library records through manual save', () => {
  assert.equal(typeof storage.buildMeetingSavePayload, 'function');
  assert.throws(() => storage.buildMeetingSavePayload({ isDemo: true, result: { transcript: 'Demo' } }), /demo/i);
});

test('manual save trims chat to the same retention limit as saved-meeting chat', () => {
  assert.equal(typeof storage.buildMeetingSavePayload, 'function');
  const payload = storage.buildMeetingSavePayload({ saveKey: 'session', filename: 'Notes.wav',
    result: { transcript: 'Review' }, completedTasks: {},
    chatMessages: Array.from({ length: 205 }, (_, index) => ({ role: 'user', content: `Question ${index}` })) });
  assert.equal(payload.chat_history.length, 200);
  assert.equal(payload.chat_history[0].content, 'Question 5');
});
