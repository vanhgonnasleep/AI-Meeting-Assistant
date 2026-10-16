import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { default: ConnectorsModal } = await server.ssrLoadModule('/src/features/connectors/ConnectorsModal.jsx');

test('opening a new connector sheet never restores another account token or repository', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => ({ ma_github_token: 'ALICE_PRIVATE_PAT', ma_github_repo: 'alice/private-repository' })[key],
  } });
  try {
    for (const account of ['Alice', 'Bob']) {
      const html = renderToStaticMarkup(createElement(ConnectorsModal, {
        isOpen: true, meetingData: { id: account, title: account + ' meeting' }, actionItems: [{ task: 'Follow up' }],
      }));
      assert.equal(html.includes('ALICE_PRIVATE_PAT'), false, 'Another account must not receive a cached PAT');
      assert.equal(html.includes('alice/private-repository'), false, 'Another account must not receive a cached repository');
      assert.match(html, /kept only while this dialog is open/);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
