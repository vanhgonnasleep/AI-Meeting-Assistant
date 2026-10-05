import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMeetingsByDate } from './history.js';

test('groupMeetingsByDate buckets meetings correctly into today, yesterday, pastWeek, older', () => {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
  const yesterdayDate = new Date(todayDate.getTime() - 24 * 3600 * 1000);
  const fourDaysAgo = new Date(todayDate.getTime() - 4 * 24 * 3600 * 1000);
  const twoWeeksAgo = new Date(todayDate.getTime() - 14 * 24 * 3600 * 1000);

  const mockMeetings = [
    { id: 1, filename: 'Today Meeting', created_at: todayDate.toISOString() },
    { id: 2, filename: 'Yesterday Meeting', created_at: yesterdayDate.toISOString() },
    { id: 3, filename: 'Midweek Sync', created_at: fourDaysAgo.toISOString() },
    { id: 4, filename: 'Old Budget Review', created_at: twoWeeksAgo.toISOString() },
    { id: 5, filename: 'Missing Date Record', created_at: null },
    { id: 6, filename: 'Malformed Date', created_at: 'invalid-iso-string' }
  ];

  const grouped = groupMeetingsByDate(mockMeetings);

  assert.equal(grouped.today.length, 1);
  assert.equal(grouped.today[0].filename, 'Today Meeting');

  assert.equal(grouped.yesterday.length, 1);
  assert.equal(grouped.yesterday[0].filename, 'Yesterday Meeting');

  assert.equal(grouped.pastWeek.length, 1);
  assert.equal(grouped.pastWeek[0].filename, 'Midweek Sync');

  assert.equal(grouped.older.length, 3);
  assert.ok(grouped.older.some(m => m.filename === 'Old Budget Review'));
  assert.ok(grouped.older.some(m => m.filename === 'Missing Date Record'));
  assert.ok(grouped.older.some(m => m.filename === 'Malformed Date'));
});

test('groupMeetingsByDate handles empty meeting list without error', () => {
  const grouped = groupMeetingsByDate([]);
  assert.deepEqual(grouped, {
    today: [],
    yesterday: [],
    pastWeek: [],
    older: []
  });
});
