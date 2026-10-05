import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { default: DocumentWorkspace } = await server.ssrLoadModule('/src/DocumentWorkspace.jsx');
const { default: Sidebar } = await server.ssrLoadModule('/src/Sidebar.jsx');
const uploadProps = {
  selectedModel: 'auto', spokenLanguage: '', mmrLambda: 0.65,
  getRootProps: props => props, getInputProps: () => ({}),
  uploadLimits: { maxFileSizeMb: 256, maxAudioDurationSeconds: 10800 },
};

test('upload screen exposes the actual saved/session choice and validation feedback', () => {
  const saved = renderToStaticMarkup(createElement(DocumentWorkspace, { ...uploadProps, saveToLibrary: true }));
  assert.match(saved, /Save results to library/);
  assert.match(saved, /type="checkbox"[^>]*checked/);
  assert.match(saved, /original recording is not stored/);
  const session = renderToStaticMarkup(createElement(DocumentWorkspace, {
    ...uploadProps, saveToLibrary: false, uploadError: 'Recording exceeds the limit.',
  }));
  assert.doesNotMatch(session, /type="checkbox"[^>]*checked/);
  assert.match(session, /Session only/);
  assert.match(session, /Recording exceeds the limit/);
});

test('meeting documents show persistence status, hour duration and available exports', () => {
  const result = { transcript: 'Review access.', summary: 'Review access.', duration: 6238, action_items: [] };
  const saved = renderToStaticMarkup(createElement(DocumentWorkspace, { result, currentMeetingId: 1 }));
  assert.match(saved, /1:43:58/);
  assert.match(saved, /Saved to library/);
  const session = renderToStaticMarkup(createElement(DocumentWorkspace, { result }));
  assert.match(session, /Session only/);
  assert.match(session, /Save this meeting/);
  assert.match(session, /Export JSON file/);
  assert.match(session, /Export text file/);
  const demo = renderToStaticMarkup(createElement(DocumentWorkspace, { result, isDemoResult: true }));
  assert.doesNotMatch(demo, /Save this meeting/);
});

test('sidebar renders saved recordings without crashing and blocks opens during saving', () => {
  const markup = renderToStaticMarkup(createElement(Sidebar, {
    meetings: [{ id: 1, filename: 'Saved.wav', duration: 6238, created_at: new Date().toISOString() }],
    canStartNew: false,
  }));
  assert.match(markup, /1:43:58/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*title="Saved.wav"/);
});

test('sidebar retains server search matches found only in meeting content', () => {
  const markup = renderToStaticMarkup(createElement(Sidebar, {
    meetings: [{ id: 1, filename: 'Weekly.wav', duration: 65, created_at: new Date().toISOString() }],
    searchQuery: 'accessibility',
  }));
  assert.match(markup, /Weekly.wav/);
});
