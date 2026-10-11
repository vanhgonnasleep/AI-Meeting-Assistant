import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletionRate,
  formatMeetingPreview,
  getCarouselScrollOffset
} from './overview-utils.js';

test('calculateCompletionRate computes accurate percentage and handles zero/invalid inputs', () => {
  assert.equal(calculateCompletionRate(10, 10), 50);
  assert.equal(calculateCompletionRate(33, 214), 13); // 33 / (33 + 214) * 100 = 13.36% -> 13%
  assert.equal(calculateCompletionRate(0, 0), 0);
  assert.equal(calculateCompletionRate(15, 0), 100);
  assert.equal(calculateCompletionRate(null, undefined), 0);
  assert.equal(calculateCompletionRate(-5, 10), 0);
});

test('formatMeetingPreview handles nullish and rich meeting records safely', () => {
  const empty = formatMeetingPreview(null);
  assert.equal(empty.title, 'Untitled Meeting');
  assert.equal(empty.taskCount, 0);
  assert.equal(empty.language, null);
  assert.equal(empty.summary, 'No summary excerpt recorded.');

  const rich = formatMeetingPreview({
    id: 'meet-123',
    filename: 'Q3_Finance_Review.mp3',
    duration: 3665,
    action_item_count: 5,
    language: 'vi',
    executive_summary: 'Reviewed quarterly projections and budget allocations.',
    created_at: '2026-10-10T14:30:00Z'
  });

  assert.equal(rich.title, 'Q3_Finance_Review.mp3');
  assert.equal(rich.taskCount, 5);
  assert.equal(rich.language, 'VI');
  assert.equal(rich.summary, 'Reviewed quarterly projections and budget allocations.');
  assert.ok(rich.durationText);
});

test('getCarouselScrollOffset calculates correct step for left and right navigation', () => {
  assert.equal(getCarouselScrollOffset('left', 340), -340);
  assert.equal(getCarouselScrollOffset('right', 340), 340);
  assert.equal(getCarouselScrollOffset('unknown', 340), 0);
});
