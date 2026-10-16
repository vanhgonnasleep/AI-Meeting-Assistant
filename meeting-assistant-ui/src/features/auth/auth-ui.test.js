import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { default: SignIn } = await server.ssrLoadModule('/src/features/auth/SignIn.jsx');
const { default: AuthGate } = await server.ssrLoadModule('/src/features/auth/AuthGate.jsx');

test('sign-in shows only configured providers as available', () => {
  const markup = renderToStaticMarkup(createElement(SignIn, { providers: { google: true, github: false } }));
  const buttons = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(item => item[0]);
  assert.doesNotMatch(buttons.find(button => button.includes('Continue with Google')), /\sdisabled(?:=|\s|>)/);
  assert.match(buttons.find(button => button.includes('Continue with GitHub')), /\sdisabled(?:=|\s|>)/);
  assert.match(markup, /Your private meeting workspace/);
  assert.doesNotMatch(markup, /Check connection|Check sign-in again|Try again/);
});

test('missing provider configuration and connection errors offer recovery', () => {
  const unavailable = renderToStaticMarkup(createElement(SignIn));
  assert.match(unavailable, /Contact your administrator/);
  assert.doesNotMatch(unavailable, /Check connection again/);
  const failed = renderToStaticMarkup(createElement(SignIn, { error: 'Sign-in is unavailable', canRetry: true, onRetry() {} }));
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again/);
  const expired = renderToStaticMarkup(createElement(SignIn, { error: 'Your sign-in expired.', providers: { google: true }, onRetry() {} }));
  assert.doesNotMatch(expired, /Try again|Check connection|Check sign-in again/);
});

test('the account gate initially mounts no meeting workspace before checking the session', () => {
  const markup = renderToStaticMarkup(createElement(AuthGate));
  assert.match(markup, /Checking your session/);
  assert.doesNotMatch(markup, /meeting-sidebar|Command Center|Meeting History/);
});
