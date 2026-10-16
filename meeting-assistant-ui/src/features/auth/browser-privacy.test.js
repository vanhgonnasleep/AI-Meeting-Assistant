import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discardLegacyConnectorSettings } from './browser-privacy.js';
import { createApiClient } from './api-client.js';

test('legacy connector cleanup removes account secrets without clearing unrelated preferences', () => {
  const values = new Map([['ma_github_token', 'old-secret'], ['ma_github_repo', 'old/repository'], ['theme', 'light']]);
  discardLegacyConnectorSettings({ removeItem: key => values.delete(key) });
  assert.deepEqual([...values], [['theme', 'light']]);
});

test('session entry and logout both discard old connector keys from the browser', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const removed = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { removeItem: key => removed.push(key) },
  } });
  try {
    const api = createApiClient({ baseUrl: 'http://localhost:8002' });
    api.configureSession({ user: { id: 'alice' }, csrf_token: 'csrf' });
    api.configureSession(null);
    assert.deepEqual(removed, ['ma_github_token', 'ma_github_repo', 'ma_github_token', 'ma_github_repo']);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
});

test('disabled browser storage does not break sign-in', () => {
  assert.doesNotThrow(() => discardLegacyConnectorSettings({ removeItem() { throw new Error('Storage denied'); } }));
});
