import { networkFailure, responseFailure, UserFacingError } from '../../shared/lib/user-errors.js';

const unavailable = () => new UserFacingError('We couldn’t check your sign-in. Try again, or explore the sample workspace.');

function validateSession(value) {
  if (!value || !['private', 'local'].includes(value.mode)) throw unavailable();
  const providers = value.providers === undefined ? {} : value.providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)
      || Object.values(providers).some(enabled => typeof enabled !== 'boolean')) throw unavailable();
  if (value.user != null && (typeof value.user !== 'object'
      || typeof value.user.id !== 'string' || !value.user.id.trim())) throw unavailable();
  return { ...value, providers };
}

/** Bound the complete sign-in check, including JSON, without relying on abort support. */
export async function fetchSession(url, { signal, timeoutMs = 10_000, fetcher = (...args) => fetch(...args) } = {}) {
  if (signal?.aborted) throw new DOMException('Sign-in check cancelled.', 'AbortError');
  const controller = new AbortController();
  let rejectControl;
  const cancelled = new Promise((_, reject) => { rejectControl = reject; });
  const abort = () => {
    rejectControl(new DOMException('Sign-in check cancelled.', 'AbortError'));
    controller.abort();
  };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    rejectControl(new UserFacingError('Checking sign-in is taking too long. Try again, or explore the sample workspace.', { code: 'timeout' }));
    controller.abort();
  }, timeoutMs);
  const request = async () => {
    const response = await fetcher(url, { credentials: 'include', cache: 'no-store', signal: controller.signal }).catch(error => {
      if (error.name === 'AbortError') throw error;
      throw networkFailure({ operation: 'session' });
    });
    if (!response.ok) throw responseFailure(response.status, {}, { operation: 'session' });
    let data;
    try { data = await response.json(); } catch { throw unavailable(); }
    return validateSession(data);
  };
  try {
    return await Promise.race([request(), cancelled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
