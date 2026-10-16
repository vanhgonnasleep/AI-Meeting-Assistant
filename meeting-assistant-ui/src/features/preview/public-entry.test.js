import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let server, dom, React, createRoot, AuthGate;
const calls = [];
const anonymous = {
  mode: 'private',
  user: null,
  csrf_token: null,
  providers: { google: true, github: true },
};
const click = async (element) => {
  assert.ok(element);
  await React.act(async () => element.click());
};
const button = (view, text) =>
  [...view.container.querySelectorAll('button,a')].find((el) =>
    el.textContent.includes(text),
  );
before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', {
    url: 'http://fixture.invalid/',
    pretendToBeVisual: true,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'location',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key.includes('AnimationFrame')
        ? dom.window[key].bind(dom.window)
        : dom.window[key],
    });
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.HTMLMediaElement.prototype.pause = () => {};
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
  });
  ({ default: AuthGate } = await server.ssrLoadModule(
    '/src/features/auth/AuthGate.jsx',
  ));
  await server.ssrLoadModule('/src/features/preview/PreviewWorkspace.jsx');
});
after(async () => {
  await server?.close();
  dom?.window.close();
});
async function mount(hash = '', offline = false) {
  window.history.replaceState({}, '', `/${hash}`);
  calls.length = 0;
  globalThis.fetch = async (input) => {
    calls.push(new URL(input, location.origin).pathname);
    if (offline) throw new TypeError('Offline fixture');
    assert.equal(
      calls.at(-1),
      '/api/auth/session',
      'Public pages must not call private data APIs',
    );
    return new Response(JSON.stringify(anonymous), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(AuthGate)));
  return {
    container,
    async close() {
      await React.act(async () => root.unmount());
      container.remove();
    },
  };
}
async function navigate(hash) {
  await React.act(async () => {
    window.location.hash = hash;
    await new Promise((done) => setTimeout(done, 20));
  });
}

test('anonymous home shows the product and interactive sample before sign-in', async () => {
  const view = await mount();
  try {
    assert.match(view.container.textContent, /Let the ideas/);
    assert.ok(button(view, 'Preview workspace'));
    assert.ok(
      view.container.querySelector('[aria-label="Interactive meeting sample"]'),
    );
    assert.deepEqual(calls, ['/api/auth/session']);
  } finally {
    await view.close();
  }
});
test('preview remains usable with backend offline and never loads private libraries', async () => {
  const view = await mount('#/preview/overview', true);
  try {
    assert.match(view.container.textContent, /Sample data/);
    assert.match(view.container.textContent, /Workspace overview/);
    await navigate('#/preview/tasks');
    const task = view.container.querySelector('input[type="checkbox"]');
    assert.ok(task);
    await click(task);
    assert.equal(task.checked, true);
    await navigate('#/preview/projects');
    assert.match(view.container.textContent, /Clarion Core Platform/);
    await navigate('#/preview/meetings');
    assert.match(view.container.textContent, /Q3 budget review/);
    assert.deepEqual(calls, ['/api/auth/session']);
  } finally {
    await view.close();
  }
});
test('private deep links keep sign-in protection with routes back to public preview', async () => {
  const view = await mount('#/meetings');
  try {
    assert.match(view.container.textContent, /Your private meeting workspace/);
    assert.ok(button(view, 'Explore preview'));
    assert.equal(
      view.container.querySelector('[data-preview-workspace]'),
      null,
    );
    await navigate('#/preview/overview');
    assert.ok(view.container.querySelector('[data-preview-workspace]'));
    await navigate('#/signin');
    assert.match(view.container.textContent, /Continue with Google/);
    assert.deepEqual(calls, ['/api/auth/session']);
  } finally {
    await view.close();
  }
});
test('preview skip link focuses content without leaving the public route', async () => {
  const view = await mount('#/preview/overview');
  try {
    await click(view.container.querySelector('.preview-skip'));
    await React.act(async () => {
      await new Promise((done) => setTimeout(done, 20));
    });
    assert.equal(location.hash, '#/preview/overview');
    assert.equal(document.activeElement?.id, 'preview-content');
  } finally {
    await view.close();
  }
});
