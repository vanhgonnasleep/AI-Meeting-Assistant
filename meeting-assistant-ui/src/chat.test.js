import test from 'node:test';
import assert from 'node:assert/strict';
import * as session from './session.js';

test('suggested questions follow the current transcript rather than the budget demo', () => {
  const prompts = session.getSuggestedPrompts?.({
    transcript: 'We agreed to postpone the database migration. Alice will run the rollback rehearsal on Friday. The release risk is an expired certificate.',
  }) ?? [];
  assert.ok(prompts.some(prompt => /database migration/i.test(prompt)));
  assert.ok(prompts.some(prompt => /rollback rehearsal/i.test(prompt)));
  assert.ok(prompts.some(prompt => /expired certificate/i.test(prompt)));
  assert.ok(prompts.every(prompt => !/budget|financial report/i.test(prompt)));
});

test('changing meetings replaces previous topics and ignores unsupported generated content', () => {
  const previous = session.getSuggestedPrompts?.({ transcript: 'The marketing budget is still being reviewed.' }) ?? [];
  const current = session.getSuggestedPrompts?.({
    transcript: 'The gardening workshop covers soil moisture and composting.',
    summary: 'A financial report is due Friday.',
    action_items: [{ task: 'Submit financial report', assignee: 'John' }],
  }) ?? [];
  assert.ok(previous.some(prompt => /marketing budget/i.test(prompt)));
  assert.ok(current.some(prompt => /soil moisture/i.test(prompt)));
  assert.ok(current.every(prompt => !/financial report|marketing budget|John/.test(prompt)));
});

test('timestamped Vietnamese excerpts support grounded prompts without duplicated turns', () => {
  const prompts = session.getSuggestedPrompts?.({ segments: [
    null, { text: '' },
    { speaker: 'Lan', text: 'Nhóm thống nhất kiểm tra cảm biến nhiệt độ trước khi bàn giao.' },
    { speaker: 'Minh', text: 'Nhóm thống nhất kiểm tra cảm biến nhiệt độ trước khi bàn giao.' },
    { speaker: 'Lan', text: 'Rủi ro là cảm biến bị lệch sau khi hiệu chuẩn.' },
  ] }) ?? [];
  assert.ok(prompts.some(prompt => prompt.includes('cảm biến nhiệt độ')));
  assert.equal(prompts.filter(prompt => prompt.includes('trước khi bàn giao')).length, 1);
  assert.ok(prompts.every(prompt => !prompt.includes('[undefined]')));
});

test('empty or greeting-only transcripts do not invent suggested topics', () => {
  assert.deepEqual(session.getSuggestedPrompts?.({ summary: 'Budget approved', transcript: '' }), []);
  assert.deepEqual(session.getSuggestedPrompts?.({ transcript: 'Hello everyone. Thank you.' }), []);
});

test('long prompts remain readable and are drawn from nonempty transcript text', () => {
  const prompts = session.getSuggestedPrompts?.({ transcript: 'The ocean monitoring project ' + 'records changes in coral health '.repeat(200) }) ?? [];
  assert.ok(prompts.length > 0 && prompts.length <= 4);
  assert.ok(prompts.every(prompt => prompt.length <= 230 && prompt.includes('ocean monitoring')));
});

test('suggestions preserve times, ratios and URLs inside actual spoken text', () => {
  for (const text of ['The schedule is 10:30 tomorrow for the rollback rehearsal.',
    'The ratio is 1:2.', 'Use postgres://localhost for the database rehearsal.']) {
    const prompts = session.getSuggestedPrompts({ segments: [{ speaker: 'Alice', text }] });
    assert.ok(prompts.some(prompt => prompt.includes(text)), text);
  }
});

test('plain attributed transcripts exclude only their speaker headers', () => {
  const prompts = session.getSuggestedPrompts({ transcript: '[00:01 - 00:05] Alice: The rehearsal is at 10:30 tomorrow.' });
  assert.ok(prompts.some(prompt => prompt.includes('The rehearsal is at 10:30 tomorrow.')));
  assert.ok(prompts.every(prompt => !prompt.includes('[00:01') && !prompt.includes('Alice:')));
});

test('saved-meeting chat requests do not resend oversized or stale browser context', () => {
  const payload = session.buildChatPayload?.({
    question: 'When is the migration?', meetingId: 17, model: 'llama3.2:1b', isDemo: false,
    result: { transcript: 'x'.repeat(1_000_001), summary: 'Stale summary', segments: [{ text: 'Stale segment' }] },
  });
  assert.deepEqual(payload, { question: 'When is the migration?', model: 'llama3.2:1b', meeting_id: 17 });
});

test('unsaved-meeting chat requests retain their own context and explicit demo flag', () => {
  const payload = session.buildChatPayload?.({ question: 'Composting?', model: 'auto', isDemo: false,
    result: { transcript: 'We discussed composting.', language: 'en', segments: [] } });
  assert.equal(payload?.transcript, 'We discussed composting.');
  assert.equal(payload?.demo_mode, false);
});
