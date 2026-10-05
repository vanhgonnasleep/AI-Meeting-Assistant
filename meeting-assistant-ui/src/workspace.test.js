import test from 'node:test';
import assert from 'node:assert/strict';
import * as workspace from './workspace.js';
import { buildChatPayload, resultFromMeeting } from './session.js';

test('task and speaker writes exclude each other before UI state can update', async () => {
  assert.equal(typeof workspace.createMutationLock, 'function');
  for (const firstKind of ['task', 'speaker']) {
    const lock = workspace.createMutationLock();
    const otherKind = firstKind === 'task' ? 'speaker' : 'task';
    const committed = [];
    let completeFirst;
    const firstResponse = new Promise(resolve => { completeFirst = resolve; });
    const write = async (kind, response) => {
      const release = lock.tryAcquire();
      if (!release) return false;
      try { await response; committed.push(kind); return true; }
      finally { release(); }
    };
    const first = write(firstKind, firstResponse);
    assert.equal(await write(otherKind, Promise.resolve()), false);
    assert.deepEqual(committed, []);
    completeFirst();
    assert.equal(await first, true);
    assert.equal(await write(otherKind, Promise.resolve()), true);
    assert.deepEqual(committed, [firstKind, otherKind]);
  }
});

test('a stale mutation completion cannot unlock a newer meeting write', () => {
  assert.equal(typeof workspace.createMutationLock, 'function');
  const lock = workspace.createMutationLock();
  const releaseOld = lock.tryAcquire();
  lock.reset();
  const releaseNew = lock.tryAcquire();
  releaseOld();
  assert.equal(lock.tryAcquire(), null);
  releaseNew();
  assert.equal(typeof lock.tryAcquire(), 'function');
});

const meeting = { id: 7, revision: 3, project_id: 2, review_status: 'reviewed', raw_transcript: 'Alice: Ship Friday.',
  segments: [{ text: 'Ship Friday.', speaker: 'Alice', start: 4, end: 8, timestamp: '[00:04 - 00:08]', custom: 'keep' }],
  executive_summary: 'Ship Friday.', action_items: [{ task: 'Prepare release', assignee: 'Alice', deadline: 'Friday', status: 'pending', start: 4 }],
  insights: { decisions: [{ text: 'Ship Friday', start: 4, speaker: 'Alice', evidence: 'source' }], risks: [], open_questions: [], custom: 'keep' } };

test('editor copies a draft while preserving segment, task and insight evidence metadata', () => {
  assert.equal(typeof workspace.createMeetingDraft, 'function');
  const draft = workspace.createMeetingDraft(meeting);
  draft.segments[0].text = 'Ship Monday.';
  draft.action_items[0].task = 'Prepare notes';
  assert.equal(meeting.segments[0].text, 'Ship Friday.');
  assert.equal(draft.segments[0].custom, 'keep');
  assert.equal(draft.action_items[0].start, 4);
  assert.equal(draft.insights.decisions[0].evidence, 'source');
  assert.equal(draft.insights.decisions[0].status, 'proposed');
  assert.equal(draft.insights.custom, 'keep');
});

test('legacy null and malformed collections produce safe editor fields', () => {
  assert.equal(typeof workspace.createMeetingDraft, 'function');
  const draft = workspace.createMeetingDraft({ segments: [null, { text: 42 }], action_items: null,
    insights: { decisions: [null, { text: 'Choose date' }], risks: null } });
  assert.equal(draft.segments[0].text, '42');
  assert.deepEqual(draft.action_items, []);
  assert.deepEqual(draft.insights.risks, []);
  assert.equal(draft.insights.decisions.length, 1);
});

test('saving corrected segments omits stale insights and keeps source metadata', () => {
  assert.equal(typeof workspace.buildReviewPayload, 'function');
  const draft = workspace.createMeetingDraft(meeting);
  draft.segments[0].text = 'Ship Monday.';
  const payload = workspace.buildReviewPayload(meeting, draft);
  assert.equal(payload.expected_revision, 3);
  assert.equal(payload.review_status, 'draft');
  assert.equal(payload.segments[0].start, 4);
  assert.equal(payload.segments[0].end, 8);
  assert.equal(payload.segments[0].text, 'Ship Monday.');
  assert.equal(Object.hasOwn(payload, 'insights'), false);
  assert.equal(Object.hasOwn(payload, 'raw_transcript'), false);
});

test('summary and task changes only send changed content, including empty collections', () => {
  assert.equal(typeof workspace.buildReviewPayload, 'function');
  const draft = workspace.createMeetingDraft(meeting);
  draft.executive_summary = 'Corrected summary';
  draft.action_items = [];
  assert.deepEqual(workspace.buildReviewPayload(meeting, draft), { expected_revision: 3, review_status: 'draft', executive_summary: 'Corrected summary', action_items: [] });
});

test('review is a separate revision-guarded status operation', () => {
  assert.equal(typeof workspace.buildReviewStatusPayload, 'function');
  assert.deepEqual(workspace.buildReviewStatusPayload(meeting), { expected_revision: 3, review_status: 'reviewed' });
});

test('conflict response preserves the exact unsaved draft; successful response replaces it', () => {
  assert.equal(typeof workspace.applyEditorResponse, 'function');
  const draft = { executive_summary: 'Unsaved correction' };
  const state = { meeting, draft };
  const conflict = workspace.applyEditorResponse(state, { error: { status: 409, message: 'Changed elsewhere' } });
  assert.equal(conflict.draft, draft);
  assert.equal(conflict.meeting, meeting);
  assert.equal(conflict.conflict, true);
  const saved = workspace.applyEditorResponse(state, { meeting: { ...meeting, revision: 4 } });
  assert.equal(saved.meeting.revision, 4);
  assert.equal(saved.draft.executive_summary, meeting.executive_summary);
});

test('task filters are encoded literally and pagination remains explicit', () => {
  assert.equal(typeof workspace.buildTaskQuery, 'function');
  const params = new URLSearchParams(workspace.buildTaskQuery({ q: 'đề xuất & 100%', status: 'pending', assignee: 'Ánh', project_id: '2' }, 50));
  assert.equal(params.get('q'), 'đề xuất & 100%');
  assert.equal(params.get('assignee'), 'Ánh');
  assert.equal(params.get('offset'), '50');
  assert.equal(params.get('limit'), '50');
  assert.equal(params.get('project_id'), '2');
});

test('saved results retain revision, review status and project identity', () => {
  const result = resultFromMeeting(meeting);
  assert.equal(result.revision, 3);
  assert.equal(result.review_status, 'reviewed');
  assert.equal(result.project_id, 2);
});

test('legacy malformed persisted collections remain safe to render while task indices are preserved', () => {
  const result = resultFromMeeting({ action_items: [null, { task: 'Second persisted task' }],
    insights: { decisions: [null, { text: 'Choose date' }], risks: 'malformed', open_questions: null }, chat_history: 'malformed' });
  assert.equal(result.action_items.length, 2);
  assert.equal(result.action_items[0].task, '');
  assert.equal(result.action_items[1].task, 'Second persisted task');
  assert.equal(result.insights.decisions.length, 1);
  assert.deepEqual(result.insights.risks, []);
  assert.deepEqual(result.chat_history, []);
});

test('semantic chat is opt-in and sends the chosen embedding model for saved and unsaved meetings', () => {
  const basic = buildChatPayload({ question: 'Why?', model: 'auto', meetingId: 7 });
  assert.equal(basic.semantic, false);
  assert.equal(Object.hasOwn(basic, 'embedding_model'), false);
  for (const meetingId of [7, null]) {
    const payload = buildChatPayload({ question: 'Why?', model: 'auto', meetingId, result: {}, semantic: true, embeddingModel: 'embeddinggemma' });
    assert.equal(payload.semantic, true);
    assert.equal(payload.embedding_model, 'embeddinggemma');
  }
});
