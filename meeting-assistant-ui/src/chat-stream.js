/** Consume POST SSE, including frames split across reads and UTF-8 code points. */
export async function readChatStream(response, onToken) {
  if (!response.body) throw new Error('Streaming is unavailable in this browser.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textSize = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 1_000_000) throw new Error('Chat stream exceeds the text budget.');
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.error) throw new Error(event.error);
        if (typeof event.token === 'string') {
          textSize += event.token.length;
          if (textSize > 50_000) throw new Error('Chat answer exceeds the text budget.');
          onToken(event.token);
        }
        if (event.done === true) return event;
      }
      if (done) throw new Error('The answer stream was interrupted. Please retry.');
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
