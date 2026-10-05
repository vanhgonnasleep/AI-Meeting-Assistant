import { createRequestGate } from './session.js';

export const DEFAULT_UPLOAD_LIMITS = Object.freeze({
  maxFileSizeMb: 256, maxFileSizeBytes: 256 * 1024 * 1024, maxAudioDurationSeconds: 10800,
});

export function buildProcessingQuery({ model = 'auto', language = '', enableMmr = true,
  mmrLambda = 0.65, diarize = false, numSpeakers = '', saveToLibrary = true }) {
  const query = new URLSearchParams({ model, enable_mmr: String(enableMmr),
    mmr_lambda: String(mmrLambda), diarize: String(diarize), save_to_library: String(saveToLibrary) });
  if (language) query.set('language', language);
  if (numSpeakers) query.set('num_speakers', numSpeakers);
  return query.toString();
}

export function getUploadLimits(health, previous = DEFAULT_UPLOAD_LIMITS) {
  const mb = health?.max_file_size_mb;
  const duration = health?.max_audio_duration_seconds;
  const maxFileSizeMb = Number.isInteger(mb) && mb >= 1 && mb <= 1024 ? mb : previous.maxFileSizeMb;
  return { maxFileSizeMb, maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxAudioDurationSeconds: Number.isInteger(duration) && duration > 0 ? duration : previous.maxAudioDurationSeconds };
}

export function getUploadError(file, limits) {
  return file && file.size > limits.maxFileSizeBytes
    ? `This file exceeds the server limit of ${limits.maxFileSizeMb} MiB. Choose a smaller file.` : null;
}

export function formatUploadLimits(limits) {
  const seconds = limits.maxAudioDurationSeconds;
  const duration = seconds % 3600 === 0 ? `${seconds / 3600} ${seconds === 3600 ? 'hour' : 'hours'}`
    : seconds % 60 === 0 ? `${seconds / 60} minutes` : `${seconds} seconds`;
  return `${limits.maxFileSizeMb} MiB · up to ${duration}`;
}

// Schedule the next poll only after this one finishes, so slow responses cannot
// overlap or overwrite newer configuration. Cleanup also invalidates late JSON.
export function startHealthPolling({ fetchHealth, onHealth, onFailure, intervalMs = 30000 }) {
  const gate = createRequestGate();
  let stopped = false;
  let timer;
  const poll = async () => {
    const request = gate.begin();
    try {
      const response = await fetchHealth({ signal: request.signal });
      if (!response.ok) throw new Error('Health request failed');
      const data = await response.json();
      if (request.isCurrent()) onHealth(data);
    } catch {
      if (request.isCurrent()) onFailure();
    } finally {
      if (!stopped) timer = setTimeout(poll, intervalMs);
    }
  };
  poll();
  return () => { stopped = true; clearTimeout(timer); gate.cancel(); };
}
