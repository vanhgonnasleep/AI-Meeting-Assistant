import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioRecording } from './recording.js';

// Only the external microphone/encoder are doubled; capture ownership, emitted
// files and completion callbacks run through the production controller.
function captureHarness({ mimeType = 'audio/webm', getUserMedia, constructError, startError } = {}) {
  const tracks = [{ readyState: 'live', stop() { this.readyState = 'ended'; } }];
  const stream = { getTracks: () => tracks };
  const recorders = [];
  const files = [];
  const errors = [];
  const statuses = [];
  let requests = 0;
  class Recorder {
    constructor(stream) {
      if (constructError) throw constructError;
      this.stream = stream;
      this.mimeType = mimeType;
      this.state = 'inactive';
      recorders.push(this);
    }
    start() { if (startError) throw startError; this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
    finish(text = 'audio bytes') {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  const recording = createAudioRecording({
    getUserMedia: options => {
      assert.deepEqual(options, { audio: true });
      requests++;
      return getUserMedia ? getUserMedia(stream) : Promise.resolve(stream);
    },
    Recorder, onStatusChange: status => statuses.push(status),
    onRecordedAudio: file => files.push(file), onError: error => errors.push(error),
  });
  return { recording, recorders, tracks, stream, files, errors, statuses, requests: () => requests };
}

test('microphone permission resolved after disposal releases tracks without starting capture', async () => {
  let grant;
  const h = captureHarness({ getUserMedia: stream => new Promise(resolve => { grant = () => resolve(stream); }) });
  const pending = h.recording.start();
  h.recording.dispose();
  grant();
  await pending;
  assert.equal(h.tracks[0].readyState, 'ended');
  assert.equal(h.recorders.length, 0);
  assert.deepEqual(h.statuses, ['starting']);
  assert.deepEqual(h.files, []);
});

test('repeated starts request microphone permission only once', async () => {
  let grant;
  const h = captureHarness({ getUserMedia: stream => new Promise(resolve => { grant = () => resolve(stream); }) });
  const pending = h.recording.start();
  void h.recording.start();
  assert.equal(h.requests(), 1);
  grant();
  await pending;
  await h.recording.start();
  assert.equal(h.requests(), 1);
  h.recording.dispose();
});

for (const failure of ['constructError', 'startError']) {
  test(`recorder ${failure} releases the microphone and returns the dock to idle`, async () => {
    const error = new Error('Encoder unavailable');
    const h = captureHarness({ [failure]: error });
    await h.recording.start();
    assert.equal(h.tracks[0].readyState, 'ended');
    assert.deepEqual(h.statuses, ['starting', 'idle']);
    assert.deepEqual(h.errors, [error]);
    assert.deepEqual(h.files, []);
  });
}

test('disposal discards queued stop events instead of uploading a stale recording', async () => {
  const h = captureHarness();
  await h.recording.start();
  const recorder = h.recorders[0];
  const queuedStop = recorder.onstop;
  const queuedData = recorder.ondataavailable;
  h.recording.dispose();
  queuedData({ data: new Blob(['stale audio']) });
  queuedStop();
  assert.equal(h.tracks[0].readyState, 'ended');
  assert.deepEqual(h.files, []);
  assert.deepEqual(h.errors, []);
});

test('mp4 capture keeps the real container and waits for final chunks before enabling another recording', async () => {
  const h = captureHarness({ mimeType: 'audio/mp4;codecs=mp4a.40.2' });
  await h.recording.start();
  h.recorders[0].ondataavailable({ data: new Blob(['first ']) });
  h.recording.stop();
  assert.equal(h.tracks[0].readyState, 'ended');
  await h.recording.start();
  assert.equal(h.requests(), 1);
  h.recorders[0].finish('last');
  assert.equal(h.files.length, 1);
  assert.equal(h.files[0].type, 'audio/mp4;codecs=mp4a.40.2');
  assert.match(h.files[0].name, /\.mp4$/);
  assert.equal(await h.files[0].text(), 'first last');
  assert.deepEqual(h.statuses, ['starting', 'recording', 'stopping', 'idle']);
});

test('an unexpected native stop resets recording state and releases microphone tracks', async () => {
  const h = captureHarness({ mimeType: 'audio/ogg' });
  await h.recording.start();
  h.recorders[0].finish();
  assert.equal(h.tracks[0].readyState, 'ended');
  assert.equal(h.statuses.at(-1), 'idle');
  assert.match(h.files[0].name, /\.ogg$/);
});

test('empty capture is reported without uploading an empty meeting', async () => {
  const h = captureHarness();
  await h.recording.start();
  h.recorders[0].finish('');
  assert.equal(h.tracks[0].readyState, 'ended');
  assert.deepEqual(h.files, []);
  assert.match(h.errors[0]?.message ?? '', /empty|no audio/i);
});

test('recorded mp4 bytes are not mislabeled as webm', async () => {
  const h = captureHarness({ mimeType: 'audio/mp4' });
  await h.recording.start();
  h.recorders[0].finish();
  assert.equal(h.files[0].type, 'audio/mp4');
  assert.match(h.files[0].name, /\.mp4$/);
});

test('a late permission rejection after disposal does not notify the unmounted dock', async () => {
  let rejectPermission;
  const h = captureHarness({ getUserMedia: () => new Promise((resolve, reject) => { rejectPermission = reject; }) });
  const pending = h.recording.start();
  h.recording.dispose();
  rejectPermission(new Error('Permission denied'));
  await pending;
  assert.deepEqual(h.errors, []);
});

test('native encoder failure releases the microphone and discards partial data', async () => {
  const h = captureHarness();
  await h.recording.start();
  const recorder = h.recorders[0];
  const error = new Error('Encoder failed');
  recorder.onerror?.({ error });
  recorder.finish('partial data');
  assert.equal(h.tracks[0].readyState, 'ended');
  assert.equal(h.statuses.at(-1), 'idle');
  assert.deepEqual(h.errors, [error]);
  assert.deepEqual(h.files, []);
});

test('unsupported native recording reports its capability error before requesting microphone access', async () => {
  const errors = [];
  let requested = false;
  const recording = createAudioRecording({
    Recorder: undefined, getUserMedia: () => { requested = true; },
    onStatusChange: () => {}, onRecordedAudio: () => {}, onError: error => errors.push(error),
  });
  await recording.start();
  assert.equal(requested, false);
  assert.match(errors[0]?.message ?? '', /not supported/i);
});
