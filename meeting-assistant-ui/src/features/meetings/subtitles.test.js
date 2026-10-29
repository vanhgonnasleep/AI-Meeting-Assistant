import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimestampSrt,
  formatTimestampVtt,
  generateSrt,
  generateVtt,
} from './subtitles.js';

test('formatTimestampSrt produces standard HH:MM:SS,mmm format', () => {
  assert.equal(formatTimestampSrt(0), '00:00:00,000');
  assert.equal(formatTimestampSrt(4.5), '00:00:04,500');
  assert.equal(formatTimestampSrt(65.123), '00:01:05,123');
  assert.equal(formatTimestampSrt(3665.999), '01:01:05,999');
  assert.equal(formatTimestampSrt(-1), '00:00:00,000');
  assert.equal(formatTimestampSrt(NaN), '00:00:00,000');
});

test('formatTimestampVtt produces standard HH:MM:SS.mmm format', () => {
  assert.equal(formatTimestampVtt(0), '00:00:00.000');
  assert.equal(formatTimestampVtt(4.5), '00:00:04.500');
  assert.equal(formatTimestampVtt(65.123), '00:01:05.123');
  assert.equal(formatTimestampVtt(3665.999), '01:01:05.999');
  assert.equal(formatTimestampVtt(null), '00:00:00.000');
});

test('generateSrt formats segments with index, timing, and speaker tags', () => {
  const segments = [
    { start: 0.0, end: 4.5, speaker: 'Speaker A', text: 'Agreed on budget.' },
    { start: 4.5, end: 8.2, speaker: 'Speaker B', text: 'What is the timeline?' },
  ];

  const srt = generateSrt(segments);
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:04,500\n[Speaker A] Agreed on budget.'));
  assert.ok(srt.includes('2\n00:00:04,500 --> 00:00:08,200\n[Speaker B] What is the timeline?'));
});

test('generateSrt handles empty or invalid segments gracefully', () => {
  assert.equal(generateSrt([]), '');
  assert.equal(generateSrt(null), '');
  assert.equal(generateSrt([{ start: 0, end: 1, text: '' }]), '');
});

test('generateVtt formats WebVTT header and voice tags', () => {
  const segments = [
    { start: 1.25, end: 5.5, speaker: 'Minh', text: 'Xin chào mọi người.' },
  ];

  const vtt = generateVtt(segments);
  assert.ok(vtt.startsWith('WEBVTT - Clarion AI Subtitles'));
  assert.ok(vtt.includes('00:00:01.250 --> 00:00:05.500'));
  assert.ok(vtt.includes('<v Minh>[Minh]: Xin chào mọi người.</v>'));
});
