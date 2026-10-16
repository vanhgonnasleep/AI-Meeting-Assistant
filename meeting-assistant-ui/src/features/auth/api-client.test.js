import { test } from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('./api-client.js').catch(() => ({}));
function client(fetcher) {
  assert.equal(typeof implementation.createApiClient, 'function');
  return implementation.createApiClient({ baseUrl: 'http://localhost:8002', fetcher });
}
const session = id => ({ mode: 'private', user: { id }, csrf_token: `csrf-${id}` });
const response = id => new Response('{}', { headers: { 'X-Clarion-Account': id } });

test('private mutations send session CSRF and cookies; reads never send the CSRF secret', async () => {
  const calls = [];
  const api = client(async (url, options) => { calls.push({ url, options }); return response('alice'); });
  api.configureSession(session('alice'));
  await api.fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  await api.fetch('/api/meetings');
  assert.equal(calls[0].options.headers.get('X-CSRF-Token'), 'csrf-alice');
  assert.equal(calls[0].options.headers.get('Content-Type'), 'application/json');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.headers.has('X-CSRF-Token'), false);
});

test('API credentials cannot be forwarded to an external endpoint', async () => {
  const api = client(() => assert.fail('External request must not be sent'));
  api.configureSession(session('alice'));
  await assert.rejects(api.fetch('https://attacker.example/api/meetings', { method: 'POST' }), /origin/i);
});

test('requests from a previous account cannot deliver their response after a session switch', async () => {
  let finish;
  const api = client(() => new Promise(resolve => { finish = resolve; }));
  api.configureSession(session('alice'));
  const pending = api.fetch('/api/meetings');
  api.configureSession(session('bob'));
  finish(response('alice'));
  await assert.rejects(pending, { name: 'AbortError' });
});

test('a cookie account changed in another tab invalidates the mounted workspace', async () => {
  let invalidated = 0;
  const api = client(async () => response('bob'));
  api.configureSession(session('alice'));
  api.onSessionInvalid(() => { invalidated += 1; });
  await assert.rejects(api.fetch('/api/meetings'), { name: 'AbortError' });
  assert.equal(invalidated, 1);
});

test('an expired server session invalidates the account instead of rendering an unauthorized payload', async () => {
  let invalidated = 0;
  const api = client(async () => new Response('{"detail":"Sign in"}', { status: 401 }));
  api.configureSession(session('alice'));
  api.onSessionInvalid(() => { invalidated += 1; });
  await assert.rejects(api.fetch('/api/meetings'), { name: 'AbortError' });
  assert.equal(invalidated, 1);
});

test('refreshing the same session does not cancel an in-flight request', async () => {
  let finish;
  const api = client(() => new Promise(resolve => { finish = resolve; }));
  api.configureSession(session('alice'));
  const pending = api.fetch('/api/meetings');
  api.configureSession(session('alice'));
  finish(response('alice'));
  assert.equal((await pending).status, 200);
});
