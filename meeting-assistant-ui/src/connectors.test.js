import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubIssuePayload,
  buildGitHubIssueUrl,
  buildGmailDispatchUrl,
  formatEmailMinutes,
  extractAssignee
} from './connectors.js';

test('buildGitHubIssuePayload formats task object and meeting citation properly', () => {
  const task = {
    text: 'Implement WebSocket backoff reconnection',
    assignee: 'Nam',
    due: '2026-10-15'
  };
  const meetingContext = {
    title: 'Sprint Planning 42',
    date: '2026-10-11',
    meetingId: 'meet-123'
  };

  const payload = buildGitHubIssuePayload(task, meetingContext);

  assert.equal(payload.title, '[Action Item] Implement WebSocket backoff reconnection');
  assert.ok(payload.body.includes('**Task:** Implement WebSocket backoff reconnection'));
  assert.ok(payload.body.includes('**Assignee:** Nam'));
  assert.ok(payload.body.includes('**Due Date:** 2026-10-15'));
  assert.ok(payload.body.includes('Sprint Planning 42'));
  assert.ok(Array.isArray(payload.labels));
  assert.ok(payload.labels.includes('deliverable'));
  assert.ok(payload.labels.includes('ai-action-item'));
});

test('buildGitHubIssuePayload handles string task and empty meeting title', () => {
  const task = 'Refactor audio pipeline';
  const payload = buildGitHubIssuePayload(task);

  assert.equal(payload.title, '[Action Item] Refactor audio pipeline');
  assert.ok(payload.body.includes('Refactor audio pipeline'));
  assert.ok(payload.body.includes('AI Meeting Assistant'));
});

test('buildGitHubIssueUrl creates correctly encoded browser URL with zero token', () => {
  const repo = 'google/antigravity-hub';
  const payload = {
    title: 'Fix edge case in [Audio & Video] sync',
    body: 'Line 1: Issue found\nLine 2: Action needed & approved',
    labels: ['bug', 'priority: high']
  };

  const url = buildGitHubIssueUrl(repo, payload);

  assert.ok(url.startsWith('https://github.com/google/antigravity-hub/issues/new?'));
  assert.ok(url.includes('title=Fix%20edge%20case%20in%20%5BAudio%20%26%20Video%5D%20sync'));
  assert.ok(url.includes('labels=bug%2Cpriority%3A%20high'));
  assert.ok(url.includes('body=Line%201%3A%20Issue%20found%0ALine%202%3A%20Action%20needed%20%26%20approved'));
});

test('buildGitHubIssueUrl trims repo leading and trailing slashes and handles default repo', () => {
  const url = buildGitHubIssueUrl(' /my-org/my-project/ ', { title: 'Test' });
  assert.ok(url.startsWith('https://github.com/my-org/my-project/issues/new?'));
});

test('buildGmailDispatchUrl constructs web composer URL with properly encoded query parameters', () => {
  const params = {
    to: ['alice@example.com', 'bob@example.com'],
    subject: 'Executive Minutes: AI Sync Q4 & Planning',
    body: 'Hello Team,\n\nHere are the notes: 100% complete.',
    format: 'web'
  };

  const url = buildGmailDispatchUrl(params);

  assert.ok(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1&'));
  assert.ok(url.includes('to=alice%40example.com%2Cbob%40example.com'));
  assert.ok(url.includes('su=Executive%20Minutes%3A%20AI%20Sync%20Q4%20%26%20Planning'));
  assert.ok(url.includes('body=Hello%20Team%2C%0A%0AHere%20are%20the%20notes%3A%20100%25%20complete.'));
});

test('buildGmailDispatchUrl constructs mailto: URI correctly', () => {
  const params = {
    to: 'lead@example.com',
    subject: 'Weekly Review',
    body: 'Status: Good',
    format: 'mailto'
  };

  const uri = buildGmailDispatchUrl(params);

  assert.ok(uri.startsWith('mailto:lead%40example.com?'));
  assert.ok(uri.includes('subject=Weekly%20Review'));
  assert.ok(uri.includes('body=Status%3A%20Good'));
});

test('formatEmailMinutes formats Executive Brief accurately', () => {
  const meetingData = {
    title: 'Architecture Alignment',
    date: '2026-10-11',
    summary: 'Aligned on WebSocket streaming and decoupled worker threads.',
    keyDecisions: ['Adopt Framer Motion for UI physics', 'Isolate lead branch'],
    risks: ['High memory under 4K audio chunks'],
    actionItems: [{ text: 'Benchmark token usage', assignee: 'Lan' }]
  };

  const brief = formatEmailMinutes(meetingData, { template: 'brief' });

  assert.ok(brief.includes('EXECUTIVE BRIEFING: Architecture Alignment'));
  assert.ok(brief.includes('Aligned on WebSocket streaming'));
  assert.ok(brief.includes('KEY DECISIONS:'));
  assert.ok(brief.includes('• Adopt Framer Motion for UI physics'));
  assert.ok(brief.includes('• Isolate lead branch'));
  // Executive brief does not expand full risk matrix by default
  assert.ok(!brief.includes('RISK MATRIX'));
});

test('formatEmailMinutes formats Comprehensive Minutes with risks and checklist', () => {
  const meetingData = {
    title: 'Architecture Alignment',
    date: '2026-10-11',
    summary: 'Aligned on WebSocket streaming and decoupled worker threads.',
    keyDecisions: ['Adopt Framer Motion for UI physics'],
    risks: ['High memory under 4K audio chunks'],
    actionItems: [
      { text: 'Benchmark token usage', assignee: 'Lan' },
      'Setup Redis cache'
    ],
    attendees: ['Lan', 'Nam', 'Minh']
  };

  const full = formatEmailMinutes(meetingData, { template: 'comprehensive' });

  assert.ok(full.includes('COMPREHENSIVE MEETING MINUTES: Architecture Alignment'));
  assert.ok(full.includes('ATTENDEES: Lan, Nam, Minh'));
  assert.ok(full.includes('KEY DECISIONS:'));
  assert.ok(full.includes('IDENTIFIED RISKS & BLOCKERS:'));
  assert.ok(full.includes('High memory under 4K audio chunks'));
  assert.ok(full.includes('ACTION ITEMS & DELIVERABLES:'));
  assert.ok(full.includes('[ ] Benchmark token usage (Assignee: Lan)'));
  assert.ok(full.includes('[ ] Setup Redis cache'));
});

test('extractAssignee parses assignee annotations from task strings', () => {
  assert.equal(extractAssignee('Finish report (Assignee: Lan)'), 'Lan');
  assert.equal(extractAssignee('Deploy model [@Minh]'), 'Minh');
  assert.equal(extractAssignee('Check server health'), null);
});

test('buildGmailDispatchUrl bounds long body to prevent HTTP 414 URL truncation', () => {
  const hugeBody = 'A'.repeat(5000);
  const url = buildGmailDispatchUrl({
    to: 'lead@example.com',
    subject: 'Minutes',
    body: hugeBody,
    format: 'web'
  });

  assert.ok(url.length <= 2000, `URL length ${url.length} should be <= 2000`);
  assert.ok(url.includes('Truncated'));
});
