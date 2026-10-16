import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatStream } from './chat-stream.js';

function response(chunks) {
  return { body: new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    controller.close();
  } }) };
}

test('SSE reader preserves split UTF-8 tokens and CRLF frame boundaries', async () => {
  const data = new TextEncoder().encode('data: {"token":"Chào ","done":false}\r\n\r\ndata: {"token":"bạn","done":false}\n\ndata: {"done":true,"citations":[{"text":"source"}]}\n\n');
  const chunks = Array.from(data, byte => new Uint8Array([byte]));
  let text = '';
  const result = await readChatStream(response(chunks), token => { text += token; });
  assert.equal(text, 'Chào bạn');
  assert.equal(result.citations[0].text, 'source');
});

test('SSE reader accepts comments and multiple frames in one read', async () => {
  let text = '';
  await readChatStream(response([': keepalive\n\ndata: {"token":"Hello","done":false}\n\ndata: {"done":true}\n\n']), token => { text += token; });
  assert.equal(text, 'Hello');
});

test('SSE reader rejects partial answers without completion and terminal errors', async () => {
  await assert.rejects(readChatStream(response(['data: {"token":"partial"}\n\n']), () => {}), /interrupted/i);
  await assert.rejects(readChatStream(response(['data: {"done":true,"error":"Meeting changed"}\n\n']), () => {}), /Meeting changed/);
});

test('SSE reader rejects malformed frames and oversized data', async () => {
  await assert.rejects(readChatStream(response(['data: not-json\n\n']), () => {}));
  await assert.rejects(readChatStream(response(['x'.repeat(1_100_000)]), () => {}), /budget/i);
});
