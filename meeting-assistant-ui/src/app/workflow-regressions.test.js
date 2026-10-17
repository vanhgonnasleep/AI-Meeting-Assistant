import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let server, dom, React, createRoot, App, AuthGate, Library, apiClient, TranscriptReview, CommandCenter;
const session = { mode: 'private', user: { id: 'fixture-a', name: 'Fixture A' }, csrf_token: 'fixture-csrf', providers: { google: true } };
const meeting = { id: 14, filename: 'Fixture.wav', revision: 7, raw_transcript: 'Review the fixture.',
  executive_summary: 'Fixture summary', segments: [], insights: {}, chat_history: [],
  action_items: [{ task: 'Review fixture task', status: 'pending', assignee: 'Fixture owner' }] };
const json = (data, status = 200, account = 'fixture-a') => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'X-Clarion-Account': account },
});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const click = async element => { assert.ok(element, 'Expected an actionable DOM element'); await React.act(async () => element.click()); };

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://fixture.invalid/#/studio', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'location', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true,
      value: typeof dom.window[key] === 'function' && key.includes('AnimationFrame') ? dom.window[key].bind(dom.window) : dom.window[key] });
  }
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = await import('react');
  ({ createRoot } = await import('react-dom/client'));
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', plugins: [{
    name: 'auth-boundary-fixture',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/features/auth/AuthGate.jsx')) return;
      return source.replace("import App from '../../app/App.jsx';", `function App({ account, onLogout, signingOut, publicPreview }) {
        const [draft, setDraft] = useState('');
        if (publicPreview) return publicPreview;
        return <><input aria-label="Unsaved fixture draft" value={draft} onInput={event => setDraft(event.target.value)} /><output aria-label="Draft mirror">{draft}</output>
          <button disabled={signingOut} onClick={onLogout}>Sign out {account?.name || 'Local'}</button></>;
      }`);
    },
  }] });
  ({ default: App } = await server.ssrLoadModule('/src/app/App.jsx'));
  ({ default: AuthGate } = await server.ssrLoadModule('/src/features/auth/AuthGate.jsx'));
  ({ default: Library } = await server.ssrLoadModule('/src/features/meetings/MeetingLibrary.jsx'));
  ({ default: TranscriptReview } = await server.ssrLoadModule('/src/features/meetings/TranscriptReview.jsx'));
  ({ default: CommandCenter } = await server.ssrLoadModule('/src/features/chat/CommandCenter.jsx'));
  ({ apiClient } = await server.ssrLoadModule('/src/features/auth/api-client.js'));
});
after(async () => { await server?.close(); dom?.window.close(); });

async function mount(Component, props = {}) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await React.act(async () => root.render(React.createElement(Component, props)));
  return { container, async close() { await React.act(async () => root.unmount()); container.remove(); } };
}

test('speech review exposes explicit confirmation and no-speech actions without mutating the source', async () => {
  const segment = { text: 'ni '.repeat(40), start: 2, end: 5, timestamp: '[00:02 - 00:05]', quality: { status: 'needs_review', reasons: ['repetition'] } };
  const calls = [];
  const view = await mount(TranscriptReview, { segments: [segment], audioUrl: 'blob:fixture',
    onReviewPassage: (...args) => calls.push(args), onSeekAudio: seconds => calls.push(['seek', seconds]) });
  try {
    const button = text => [...view.container.querySelectorAll('button')].find(item => item.textContent === text);
    assert.equal(button('Save correction').disabled, true);
    await click(button('Listen to passage'));
    await click(button('Keep these words'));
    await click(button('No speech here'));
    assert.deepEqual(calls, [['seek', 2], [0, segment.text], [0, '']]);
    assert.equal(segment.quality.status, 'needs_review');
  } finally { await view.close(); }
});

test('closing the floating assistant restores focus to its launcher and makes no false online claim', async () => {
  const view = await mount(CommandCenter);
  try {
    const launcher = view.container.querySelector('button[aria-label="Open AI assistant chat bubble"]');
    await click(launcher);
    await click(view.container.querySelector('[aria-label="Close chat window"]'));
    assert.equal(document.activeElement === launcher, true, 'Focus should return to the chat launcher');
    assert.equal(view.container.querySelector('[title="Online"]'), null);
  } finally { await view.close(); }
});

test('sign-in retry has visible progress and disappears when sign-in becomes available', async () => {
  window.history.replaceState({}, '', '/#/signin');
  let count = 0;
  const waiting = deferred();
  globalThis.fetch = async () => {
    if (++count === 1) throw new TypeError('Failed to fetch');
    return waiting.promise;
  };
  const view = await mount(AuthGate);
  try {
    await click(view.container.querySelector('[aria-label="Dismiss notification"]'));
    await click([...view.container.querySelectorAll('button')].find(button => button.textContent === 'Try again'));
    assert.match(view.container.textContent, /Checking your session/);
    assert.doesNotMatch(view.container.textContent, /Try again|Check connection again/);
    await React.act(async () => waiting.resolve(json({ ...session, user: null, csrf_token: null })));
    const google = [...view.container.querySelectorAll('button')].find(button => button.textContent.includes('Continue with Google'));
    assert.equal(google.disabled, false);
    assert.doesNotMatch(view.container.textContent, /Checking your session|Try again|Check connection again/);
  } finally { await view.close(); apiClient.configureSession(null); window.history.replaceState({}, '', '/#/studio'); }
});

test('a temporary session-check failure preserves the explicit local workspace and unsaved draft', async () => {
  window.history.replaceState({}, '', '/#/studio');
  let fail = false;
  globalThis.fetch = async () => {
    if (fail) throw new TypeError('Failed to fetch');
    return json({ mode: 'local', user: null, csrf_token: null, providers: {} });
  };
  const view = await mount(AuthGate);
  try {
    const field = view.container.querySelector('[aria-label="Unsaved fixture draft"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, 'Keep local notes');
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    fail = true;
    await React.act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.equal(view.container.querySelector('[aria-label="Draft mirror"]')?.textContent, 'Keep local notes');
    assert.doesNotMatch(view.container.textContent, /Your private meeting workspace/);
  } finally { await view.close(); apiClient.configureSession(null); }
});

async function openFixtureMeeting(fetchTask) {
  apiClient.configureSession(null);
  globalThis.fetch = async (input, options = {}) => {
    const path = new URL(input, location.origin).pathname;
    if (path.endsWith('/tasks/0')) return fetchTask(options);
    if (path === '/api/health') return json({ ollama_online: true });
    if (path === '/api/meetings/14') return json({ meeting });
    if (path === '/api/meetings') return json({ meetings: [meeting], total: 1 });
    throw new Error(`Unexpected fixture request ${path}`);
  };
  const view = await mount(App);
  await React.act(async () => { await new Promise(done => setTimeout(done, 300)); });
  await click(view.container.querySelector('button[title="Fixture.wav"]'));
  // Flush the lazy document import without a running HTTP server.
  await React.act(async () => { await server.ssrLoadModule('/src/features/meetings/DocumentWorkspace.jsx'); });
  return view;
}

test('the real JSON export button downloads the current meeting and task statuses', async () => {
  const view = await openFixtureMeeting();
  const blobs = [];
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  const previousClick = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = blob => { blobs.push(blob); return 'blob:fixture'; };
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  const preventError = event => event.preventDefault();
  window.addEventListener('error', preventError);
  try {
    await click(view.container.querySelector('[aria-label="Export JSON file"]'));
    assert.equal(blobs.length, 1, 'Export should create one downloadable file');
    const exported = JSON.parse(await blobs[0].text());
    assert.equal(exported.meeting_id, 14);
    assert.equal(exported.transcript, 'Review the fixture.');
    assert.deepEqual(exported.action_items, [{ task: 'Review fixture task', status: 'pending', assignee: 'Fixture owner', deadline: '' }]);
  } finally {
    window.removeEventListener('error', preventError);
    URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke;
    window.HTMLAnchorElement.prototype.click = previousClick;
    await view.close();
  }
});

test('library project options come from the account API and reload after returning to the library', async () => {
  let projects = [{ id: 9, name: 'Fixture project A' }];
  let account = 'fixture-a';
  let selectedFilters;
  globalThis.fetch = async input => {
    assert.equal(new URL(input, location.origin).pathname, '/api/projects');
    return json({ projects }, 200, account);
  };
  apiClient.configureSession(session);
  const props = { apiBase: 'http://localhost:8002', meetings: [], total: 0, query: '', canOpen: true,
    onFiltersChange: filters => { selectedFilters = filters; } };
  let view = await mount(Library, props);
  try {
    assert.deepEqual([...view.container.querySelector('[aria-label="Filter by project"]').options].map(option => option.text), ['All projects', 'Fixture project A']);
    await React.act(async () => {
      const select = view.container.querySelector('[aria-label="Filter by project"]');
      select.value = 'Fixture project A';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(selectedFilters.project, 'Fixture project A');
    await view.close();
    account = 'fixture-b';
    apiClient.configureSession({ ...session, user: { id: account } });
    projects = [{ id: 10, name: 'Fixture project B' }];
    view = await mount(Library, props);
    assert.deepEqual([...view.container.querySelector('[aria-label="Filter by project"]').options].map(option => option.text), ['All projects', 'Fixture project B']);
    projects = [...projects, { id: 11, name: 'Newly assigned project' }];
    await React.act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.deepEqual([...view.container.querySelector('[aria-label="Filter by project"]').options].map(option => option.text), ['All projects', 'Fixture project B', 'Newly assigned project']);
  } finally { await view.close(); apiClient.configureSession(null); }
});

test('a project response from an unmounted account cannot replace the next account options', async () => {
  const oldProjects = deferred();
  let firstRequest = true;
  globalThis.fetch = async () => {
    if (firstRequest) { firstRequest = false; return oldProjects.promise; }
    return json({ projects: [{ id: 2, name: 'Account B project' }] }, 200, 'fixture-b');
  };
  const props = { apiBase: 'http://localhost:8002', meetings: [], total: 0, query: '', canOpen: true };
  apiClient.configureSession(session);
  let view = await mount(Library, props);
  await view.close();
  apiClient.configureSession({ ...session, user: { id: 'fixture-b' } });
  view = await mount(Library, props);
  try {
    await React.act(async () => oldProjects.resolve(json({ projects: [{ id: 1, name: 'Private account A project' }] })));
    assert.deepEqual([...view.container.querySelector('[aria-label="Filter by project"]').options].map(option => option.text), ['All projects', 'Account B project']);
    assert.doesNotMatch(view.container.textContent, /Private account A project/);
  } finally { await view.close(); apiClient.configureSession(null); }
});

test('a delayed session refresh cannot restore the account after successful logout', async () => {
  const pendingRefresh = deferred(), pendingLogout = deferred();
  let checks = 0;
  globalThis.fetch = async input => {
    const path = new URL(input, location.origin).pathname;
    if (path.endsWith('/session')) return ++checks === 1 ? json(session) : pendingRefresh.promise;
    if (path.endsWith('/logout')) return pendingLogout.promise;
    throw new Error(`Unexpected fixture request ${path}`);
  };
  const view = await mount(AuthGate);
  try {
    await click([...view.container.querySelectorAll('button')].find(button => button.textContent === 'Sign out Fixture A'));
    await React.act(async () => window.dispatchEvent(new window.Event('focus')));
    await React.act(async () => pendingLogout.resolve(json({ ok: true })));
    assert.match(view.container.textContent, /Your private meeting workspace/);
    await React.act(async () => pendingRefresh.resolve(json(session)));
    assert.match(view.container.textContent, /Your private meeting workspace/);
    assert.doesNotMatch(view.container.textContent, /Sign out Fixture A/);
  } finally { await view.close(); apiClient.configureSession(null); }
});

test('authenticated preview navigation preserves the active workspace draft', async () => {
  window.history.replaceState({}, '', '/#/studio');
  globalThis.fetch = async input => {
    assert.equal(new URL(input, location.origin).pathname, '/api/auth/session');
    return json(session);
  };
  const view = await mount(AuthGate);
  try {
    const field = view.container.querySelector('[aria-label="Unsaved fixture draft"]');
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, 'Keep this unsaved draft');
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(view.container.querySelector('[aria-label="Draft mirror"]').textContent, 'Keep this unsaved draft');
    await React.act(async () => {
      window.location.hash = '#/preview/overview';
      await server.ssrLoadModule('/src/features/preview/PreviewWorkspace.jsx');
      await new Promise(done => setTimeout(done, 25));
    });
    assert.ok(view.container.querySelector('[data-preview-workspace]'));
    await React.act(async () => {
      window.location.hash = '#/studio';
      await new Promise(done => setTimeout(done, 25));
    });
    assert.equal(view.container.querySelector('[aria-label="Unsaved fixture draft"]').value, 'Keep this unsaved draft');
  } finally { await view.close(); apiClient.configureSession(null); }
});

test('a fresh signed-in preview mounts no private app and logout removes a retained app', async () => {
  window.history.replaceState({}, '', '/#/preview/overview');
  let active = session;
  globalThis.fetch = async input => {
    assert.equal(new URL(input, location.origin).pathname, '/api/auth/session');
    return json(active);
  };
  const view = await mount(AuthGate);
  try {
    await React.act(async () => { await server.ssrLoadModule('/src/features/preview/PreviewWorkspace.jsx'); });
    assert.ok(view.container.querySelector('[data-preview-workspace]'));
    assert.equal(view.container.querySelector('[aria-label="Unsaved fixture draft"]'), null);
    await React.act(async () => { window.location.hash = '#/studio'; await new Promise(done => setTimeout(done, 25)); });
    assert.ok(view.container.querySelector('[aria-label="Unsaved fixture draft"]'));
    await React.act(async () => { window.location.hash = '#/preview/overview'; await new Promise(done => setTimeout(done, 25)); });
    assert.ok(view.container.querySelector('[aria-label="Unsaved fixture draft"]').closest('[hidden]'));
    active = { ...session, user: null, csrf_token: null };
    await React.act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.equal(view.container.querySelector('[aria-label="Unsaved fixture draft"]'), null);
    assert.ok(view.container.querySelector('[data-preview-workspace]'));
  } finally {
    await view.close(); apiClient.configureSession(null);
    window.history.replaceState({}, '', '/#/studio');
  }
});

test('logout with an expired session immediately rechecks anonymous state after client invalidation', async () => {
  let checks = 0;
  globalThis.fetch = async input => {
    const path = new URL(input, location.origin).pathname;
    if (path.endsWith('/session')) return json(++checks === 1 ? session : { ...session, user: null, csrf_token: null });
    if (path.endsWith('/logout')) return json({ detail: 'Sign in again' }, 401);
    throw new Error(`Unexpected fixture request ${path}`);
  };
  const view = await mount(AuthGate);
  try {
    await click([...view.container.querySelectorAll('button')].find(button => button.textContent === 'Sign out Fixture A'));
    assert.equal(checks, 2, 'Invalidation during logout must schedule another session check');
    assert.match(view.container.textContent, /Continue with Google/);
    assert.doesNotMatch(view.container.textContent, /Checking your session/);
  } finally { await view.close(); apiClient.configureSession(null); }
});

test('task changes send the displayed revision and keep a stale checkbox unchanged on conflict', async t => {
  t.mock.method(console, 'error', () => {});
  let submitted;
  const view = await openFixtureMeeting(async options => {
    submitted = JSON.parse(options.body);
    return json({ detail: 'This meeting changed elsewhere. Reload the latest record.' }, 409);
  });
  try {
    const task = [...view.container.querySelectorAll('button[aria-pressed]')].find(button => button.textContent.includes('Review fixture task'));
    await click(task);
    assert.deepEqual(submitted, { status: 'completed', expected_revision: 7 });
    assert.equal(task.getAttribute('aria-pressed'), 'false');
    assert.match(view.container.textContent, /changed elsewhere/);
  } finally { await view.close(); }
});

test('a lost task-save response preserves the displayed state and explains the uncertain outcome', async t => {
  t.mock.method(console, 'error', () => {});
  const view = await openFixtureMeeting(async () => { throw new TypeError('Failed to fetch'); });
  try {
    const task = [...view.container.querySelectorAll('button[aria-pressed]')].find(button => button.textContent.includes('Review fixture task'));
    await click(task);
    assert.equal(task.getAttribute('aria-pressed'), 'false');
    assert.match(view.container.textContent, /confirm.*saved/);
    assert.match(view.container.textContent, /Keep this page open/);
    assert.doesNotMatch(view.container.textContent, /Failed to fetch|database.*down/i);
    assert.ok(view.container.querySelector('.feedback-toast[role="alert"]'));
    await click(view.container.querySelector('[aria-label="Dismiss notification"]'));
    assert.equal(view.container.querySelector('.feedback-toast'), null);
  } finally { await view.close(); }
});

test('a failed library load is not represented as an empty account', async () => {
  apiClient.configureSession(null);
  globalThis.fetch = async () => json({ projects: [] });
  const view = await mount(Library, { apiBase: 'http://localhost:8002', meetings: [], total: 0, loading: false,
    error: 'We couldn’t load your meetings. Try again.', query: '', offset: 0, onPage() {}, canOpen: true });
  try {
    assert.match(view.container.textContent, /couldn’t load/);
    assert.doesNotMatch(view.container.textContent, /Your library starts here|Start a meeting/);
    await click(view.container.querySelector('[aria-label="Dismiss notification"]'));
    assert.equal(view.container.querySelector('.feedback-toast'), null);
    assert.doesNotMatch(view.container.textContent, /Your library starts here/);
    assert.match(view.container.textContent, /Reload library/);
  } finally { await view.close(); }
});

test('dismissed task-load errors retain an unavailable state and an explicit reload action', async () => {
  apiClient.configureSession(null);
  globalThis.fetch = async input => new URL(input).pathname === '/api/projects'
    ? json({ projects: [] }) : json({ detail: 'storage unavailable' }, 503);
  const { default: Workspace } = await server.ssrLoadModule('/src/features/workspace/Workspace.jsx');
  const view = await mount(Workspace, { apiBase: 'http://localhost:8002', presentation: 'page' });
  try {
    await click(view.container.querySelector('[aria-label="Dismiss notification"]'));
    assert.doesNotMatch(view.container.textContent, /No matching records|0 records/);
    assert.ok([...view.container.querySelectorAll('button')].some(button => button.textContent === 'Reload action items'));
  } finally { await view.close(); }
});

test('dismissed overview-load errors still offer reload instead of leaving a blank section', async () => {
  apiClient.configureSession(null);
  globalThis.fetch = async () => json({ detail: 'storage unavailable' }, 503);
  const { default: Overview } = await server.ssrLoadModule('/src/features/overview/Overview.jsx');
  const view = await mount(Overview, { apiBase: 'http://localhost:8002' });
  try {
    await click(view.container.querySelector('[aria-label="Dismiss notification"]'));
    assert.ok([...view.container.querySelectorAll('button')].some(button => button.textContent === 'Reload recent meetings'));
  } finally { await view.close(); }
});

test('successful task changes consume the returned meeting and use its new revision for the next change', async () => {
  const submitted = [];
  const view = await openFixtureMeeting(async options => {
    const body = JSON.parse(options.body);
    submitted.push(body);
    return json({ meeting: { ...meeting, revision: 7 + submitted.length,
      action_items: [{ ...meeting.action_items[0], status: body.status }] } });
  });
  const taskButton = () => [...view.container.querySelectorAll('button[aria-pressed]')].find(button => button.textContent.includes('Review fixture task'));
  try {
    await click(taskButton());
    assert.equal(taskButton().getAttribute('aria-pressed'), 'true');
    await click(taskButton());
    assert.equal(taskButton().getAttribute('aria-pressed'), 'false');
    assert.deepEqual(submitted, [{ status: 'completed', expected_revision: 7 }, { status: 'pending', expected_revision: 8 }]);
  } finally { await view.close(); }
});

test('starting a new meeting after the sample demo restores real processing and enables saving', async t => {
  const warnings = [];
  t.mock.method(console, 'error', (...args) => { warnings.push(args.join(' ')); });
  apiClient.configureSession(null);
  globalThis.fetch = async input => {
    const url = new URL(input, location.origin);
    if (url.pathname === '/api/health') return json({ ollama_online: true });
    if (url.pathname === '/api/meetings') return json({ meetings: [], total: 0 });
    if (url.pathname === '/q3_product_budget_review.mp3') return new Response('fixture sample audio');
    if (url.pathname === '/api/process-audio') {
      assert.equal(url.searchParams.get('demo_mode'), 'true');
      return json({ mode: 'instant_demo', data: { transcript: 'Fixture demo transcript', summary: 'Fixture demo summary', action_items: [], segments: [] } });
    }
    throw new Error(`Unexpected fixture request ${url.pathname}`);
  };
  const view = await mount(App);
  await React.act(async () => { await server.ssrLoadModule('/src/features/meetings/DocumentWorkspace.jsx'); });
  const model = () => view.container.querySelector('[aria-label="Processing model"]');
  try {
    await click([...view.container.querySelectorAll('button')].find(button => button.textContent.includes('Load Sample Audio')));
    assert.equal(model().value, 'instant_demo', 'Loading a sample explicitly selects demo processing');
    await click([...view.container.querySelectorAll('button')].find(button => button.textContent.includes('Start Processing')));
    assert.match(view.container.textContent, /Fixture demo summary/);
    assert.match(view.container.textContent, /DEMO/);
    await click(view.container.querySelector('[aria-label="Start new meeting"]'));
    assert.equal(model().value, 'auto');
    const save = [...view.container.querySelectorAll('label')].find(label => label.textContent.includes('Save results to library')).querySelector('input');
    assert.equal(save.disabled, false);
    assert.equal(save.checked, true);
    assert.equal(warnings.some(message => message.includes('same key')), false, 'Recording controls and notification siblings must have distinct keys');
  } finally { await view.close(); }
});

test('starting a new meeting preserves an intentionally selected real processing model', async () => {
  apiClient.configureSession(null);
  globalThis.fetch = async input => {
    const path = new URL(input, location.origin).pathname;
    if (path === '/api/health') return json({ ollama_online: true });
    if (path === '/api/meetings') return json({ meetings: [], total: 0 });
    throw new Error(`Unexpected fixture request ${path}`);
  };
  const view = await mount(App);
  await React.act(async () => { await server.ssrLoadModule('/src/features/meetings/DocumentWorkspace.jsx'); });
  try {
    await React.act(async () => {
      const model = view.container.querySelector('[aria-label="Processing model"]');
      model.value = 'llama3.2:1b';
      model.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await click(view.container.querySelector('[aria-label="Start new meeting"]'));
    assert.equal(view.container.querySelector('[aria-label="Processing model"]').value, 'llama3.2:1b');
  } finally { await view.close(); }
});
