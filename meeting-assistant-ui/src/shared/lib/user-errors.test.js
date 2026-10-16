import { test } from 'node:test';
import assert from 'node:assert/strict';

const errors = await import('./user-errors.js').catch(() => ({}));

test('an uncertain save tells the user to keep their work and check before retrying', () => {
  assert.equal(typeof errors.networkFailure, 'function');
  const failure = errors.networkFailure({ operation: 'save', offline: false });
  assert.match(failure.message, /confirm.*saved/i);
  assert.match(failure.message, /keep this page open/i);
  assert.doesNotMatch(failure.message, /failed to fetch|database|HTTP|CORS|8002/i);
});

test('confirmed offline and unreachable service have distinct honest recovery instructions', () => {
  assert.equal(typeof errors.networkFailure, 'function');
  assert.match(errors.networkFailure({ offline: true }).message, /offline/i);
  assert.match(errors.networkFailure({ offline: false }).message, /reach Clarion/i);
  assert.doesNotMatch(errors.networkFailure({ offline: false }).message, /database|crashed|CORS|firewall/i);
});

test('HTTP failures use business copy without displaying server internals', () => {
  assert.equal(typeof errors.responseFailure, 'function');
  const failure = errors.responseFailure(500, { detail: 'sqlite3.OperationalError: secret database path' }, { operation: 'save' });
  assert.equal(failure.status, 500);
  assert.match(failure.message, /saved|save/i);
  assert.doesNotMatch(failure.message, /sqlite|secret|path|500|HTTP/i);
  assert.match(errors.responseFailure(409, {}, { operation: 'save' }).message, /changed elsewhere/i);
  assert.match(errors.responseFailure(413, { detail: 'Audio duration exceeds 10800 seconds' }, { operation: 'process' }).message, /shorter recording/i);
  assert.match(errors.responseFailure(503, { detail: 'Another transcription is running' }, { operation: 'process' }).message, /another recording/i);
});

test('validation lists name understandable fields and never echo rejected input', () => {
  assert.equal(typeof errors.responseFailure, 'function');
  const failure = errors.responseFailure(422, { detail: [{ loc: ['body', 'action_items', 0, 'deadline_iso'], msg: 'value error', input: 'private text' }] }, { operation: 'save' });
  assert.match(failure.message, /due date/i);
  assert.doesNotMatch(failure.message, /deadline_iso|private text|value error|422/i);
});

test('unknown exceptions are safe while an actionable business error remains intact', () => {
  assert.equal(typeof errors.userMessage, 'function');
  assert.doesNotMatch(errors.userMessage(new SyntaxError('Unexpected token < in JSON'), 'load'), /JSON|token|</);
  const failure = errors.responseFailure(404, {}, { operation: 'open' });
  assert.equal(errors.userMessage(failure, 'load'), failure.message);
});
