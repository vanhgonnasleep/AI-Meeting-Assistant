import test from 'node:test';
import assert from 'node:assert/strict';
import * as upload from './upload.js';

test('session-only processing explicitly opts out of persistence while default processing saves', () => {
  assert.equal(new URLSearchParams(upload.buildProcessingQuery({ saveToLibrary: false })).get('save_to_library'), 'false');
  assert.equal(new URLSearchParams(upload.buildProcessingQuery({})).get('save_to_library'), 'true');
});

test('processing query carries spoken language without changing other options or enabling demo', () => {
  assert.equal(typeof upload.buildProcessingQuery, 'function');
  for (const language of ['', 'en', 'vi']) {
    const query = new URLSearchParams(upload.buildProcessingQuery({
      model: 'model&demo_mode=true', language, enableMmr: false, mmrLambda: 0.5,
      diarize: true, numSpeakers: '2',
    }));
    assert.equal(query.get('language'), language || null);
    assert.equal(query.get('model'), 'model&demo_mode=true');
    assert.equal(query.has('demo_mode'), false);
    assert.equal(query.get('enable_mmr'), 'false');
    assert.equal(query.get('mmr_lambda'), '0.5');
    assert.equal(query.get('diarize'), 'true');
    assert.equal(query.get('num_speakers'), '2');
  }
  const query = new URLSearchParams(upload.buildProcessingQuery({ model: 'auto', numSpeakers: '' }));
  assert.equal(query.has('num_speakers'), false);
});

test('upload defaults accept 256 MiB inclusively and reject the next byte', () => {
  assert.equal(typeof upload.getUploadLimits, 'function');
  const limits = upload.getUploadLimits();
  assert.equal(limits.maxFileSizeMb, 256);
  assert.equal(limits.maxAudioDurationSeconds, 10800);
  assert.equal(upload.getUploadError({ size: 256 * 1024 * 1024 }, limits), null);
  assert.match(upload.getUploadError({ size: 256 * 1024 * 1024 + 1 }, limits), /256 MiB/);
});

test('server limits update both selection size and duration text while invalid values preserve the last known values', () => {
  assert.equal(typeof upload.getUploadLimits, 'function');
  const limits = upload.getUploadLimits({ max_file_size_mb: 64, max_audio_duration_seconds: 7200 });
  assert.equal(limits.maxFileSizeBytes, 64 * 1024 * 1024);
  assert.match(upload.formatUploadLimits(limits), /64 MiB.*2 hours/);
  assert.deepEqual(upload.getUploadLimits(undefined, limits), limits);
  for (const invalid of [0, -1, 1025, 0.5, '128', null]) {
    assert.equal(upload.getUploadLimits({ max_file_size_mb: invalid }, limits).maxFileSizeMb, 64);
  }
});

test('a file chosen before smaller server limits arrive remains selected but cannot be submitted', () => {
  assert.equal(typeof upload.getUploadLimits, 'function');
  const file = { name: 'large.wav', size: 100 * 1024 * 1024 };
  assert.equal(upload.getUploadError(file, upload.getUploadLimits()), null);
  assert.match(upload.getUploadError(file, upload.getUploadLimits({ max_file_size_mb: 64 })), /Choose a smaller file/);
  assert.equal(file.name, 'large.wav');
});

test('health polling aborts on disposal and cannot publish a late response', async () => {
  assert.equal(typeof upload.startHealthPolling, 'function');
  let finish;
  let signal;
  const updates = [];
  const stop = upload.startHealthPolling({
    fetchHealth: options => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); },
    onHealth: data => updates.push(data), onFailure: () => updates.push('failure'),
  });
  stop();
  finish({ ok: true, json: async () => ({ max_file_size_mb: 64 }) });
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(signal.aborted, true);
  assert.deepEqual(updates, []);
});
