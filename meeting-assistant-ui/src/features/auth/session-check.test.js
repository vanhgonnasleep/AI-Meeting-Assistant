import { test } from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./session-check.js').catch(() => ({}));
const session = { mode: 'private', user: null, providers: { google: true, github: false } };
function check(options) {
  assert.equal(typeof implementation.fetchSession, 'function');
  return implementation.fetchSession('http://fixture.invalid/api/auth/session', options);
}

test('a successful sign-in check returns provider availability', async () => {
  assert.deepEqual(await check({ fetcher: async () => new Response(JSON.stringify(session)) }), session);
});

test('a hung transport times out even if it ignores cancellation', async () => {
  let aborted = false;
  await assert.rejects(check({ timeoutMs: 10, fetcher: async (_, options) => {
    options.signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(() => {});
  } }), error => error.code === 'timeout' && /taking too long.*try again/i.test(error.message));
  assert.equal(aborted, true);
});

test('the timeout also bounds an unfinished response body', async () => {
  await assert.rejects(check({ timeoutMs: 10, fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }) }), error => error.code === 'timeout');
});

test('caller cancellation remains silent and does not become a connection failure', async () => {
  const controller = new AbortController();
  const request = check({ signal: controller.signal, fetcher: async () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('malformed provider and account details cannot mount a broken sign-in or private workspace', async () => {
  for (const data of [{ ...session, providers: null }, { ...session, user: 'invalid' }, { ...session, user: {} }, { ...session, providers: { google: 'false' } }]) {
    await assert.rejects(check({ fetcher: async () => new Response(JSON.stringify(data)) }), error => error.name === 'UserFacingError');
  }
});
