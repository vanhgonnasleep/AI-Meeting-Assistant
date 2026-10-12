import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMeetingPlatform,
  getPlatformDetails,
  validateMeetingUrl,
  formatBotJoinConfirmation
} from './notta-bot-utils.js';

test('detectMeetingPlatform identifies major conferencing services from URLs', () => {
  assert.equal(detectMeetingPlatform('https://meet.google.com/abc-defg-hij'), 'google-meet');
  assert.equal(detectMeetingPlatform('https://us02web.zoom.us/j/84920491823?pwd=xyz'), 'zoom');
  assert.equal(detectMeetingPlatform('https://teams.microsoft.com/l/meetup-join/19%3ameeting'), 'teams');
  assert.equal(detectMeetingPlatform('https://teams.live.com/meet/948201'), 'teams');
  assert.equal(detectMeetingPlatform('https://mycompany.webex.com/meet/ceo'), 'webex');
  assert.equal(detectMeetingPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectMeetingPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectMeetingPlatform('https://my-internal-stream.local/live'), 'generic');
  assert.equal(detectMeetingPlatform('not-a-url'), null);
  assert.equal(detectMeetingPlatform(''), null);
  assert.equal(detectMeetingPlatform(null), null);
});

test('getPlatformDetails returns rich branding labels and colors', () => {
  const gmeet = getPlatformDetails('google-meet');
  assert.equal(gmeet.label, 'Google Meet');
  assert.ok(gmeet.badgeClass.includes('emerald') || gmeet.badgeClass.includes('teal') || gmeet.badgeClass.includes('blue'));

  const zoom = getPlatformDetails('zoom');
  assert.equal(zoom.label, 'Zoom Meeting');

  const generic = getPlatformDetails('unknown-service');
  assert.equal(generic.label, 'Live Web Stream');
});

test('validateMeetingUrl checks valid HTTP/HTTPS URLs', () => {
  assert.equal(validateMeetingUrl('https://meet.google.com/xyz'), true);
  assert.equal(validateMeetingUrl('http://zoom.us/j/12345'), true);
  assert.equal(validateMeetingUrl('zoom.us/j/12345'), true); // auto-prepends protocol check
  assert.equal(validateMeetingUrl('javascript:alert(1)'), false);
  assert.equal(validateMeetingUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(validateMeetingUrl('file:///etc/passwd'), false);
  assert.equal(validateMeetingUrl(''), false);
  assert.equal(validateMeetingUrl(null), false);
});

test('formatBotJoinConfirmation prepares structured dispatch payload', () => {
  const confirmation = formatBotJoinConfirmation({
    url: 'https://meet.google.com/abc-defg-hij',
    botName: 'Notta AI Assistant',
    language: 'vi'
  });

  assert.equal(confirmation.platform, 'google-meet');
  assert.equal(confirmation.platformLabel, 'Google Meet');
  assert.equal(confirmation.botName, 'Notta AI Assistant');
  assert.equal(confirmation.language, 'vi');
  assert.ok(confirmation.readyMessage.includes('Notta AI Assistant'));
  assert.ok(confirmation.readyMessage.includes('Google Meet'));
});
