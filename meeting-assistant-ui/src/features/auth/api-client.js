import { discardLegacyConnectorSettings } from './browser-privacy.js';
import { networkFailure, requestContext, responseFailure } from '../../shared/lib/user-errors.js';

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8002').replace(/\/$/, '');

export function createApiClient({ baseUrl, fetcher = (...args) => fetch(...args) }) {
  const origin = new URL(baseUrl || '/', globalThis.location?.origin || 'http://localhost').origin;
  let account = null;
  let csrf = null;
  let generation = 0;
  let invalidationHandler = () => {};

  const configureSession = session => {
    discardLegacyConnectorSettings();
    const nextAccount = session?.user?.id || null;
    const nextCsrf = session?.csrf_token || null;
    if (nextAccount !== account || nextCsrf !== csrf) generation += 1;
    account = nextAccount;
    csrf = nextCsrf;
  };

  const invalidated = message => {
    configureSession(null);
    invalidationHandler(message);
    return new DOMException(message, 'AbortError');
  };

  return {
    configureSession,
    onSessionInvalid(handler) {
      invalidationHandler = handler;
      return () => { if (invalidationHandler === handler) invalidationHandler = () => {}; };
    },
    async fetch(input, options = {}) {
      const url = new URL(input, origin);
      if (url.origin !== origin || !url.pathname.startsWith('/api/')) {
        throw new Error('API requests must use the configured API origin.');
      }
      const requestGeneration = generation;
      const headers = new Headers(options.headers);
      headers.delete('X-CSRF-Token');
      if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
        headers.set('X-CSRF-Token', csrf);
      }
      const context = requestContext(url.href, options);
      let response;
      try {
        response = await fetcher(url.href, { ...options, headers, credentials: 'include', cache: 'no-store' });
      } catch (error) {
        if (generation !== requestGeneration || options.signal?.aborted) {
          throw new DOMException('Discarded a cancelled request.', 'AbortError');
        }
        if (error.name === 'AbortError') throw error;
        throw networkFailure(context);
      }
      if (generation !== requestGeneration) {
        await response.body?.cancel();
        throw new DOMException('Discarded a response from a previous account.', 'AbortError');
      }
      const responseAccount = response.headers?.get?.('X-Clarion-Account');
      if (response.status === 401 || (account && (responseAccount ? responseAccount !== account : response.ok))) {
        await response.body?.cancel();
        throw invalidated(response.status === 401 ? 'Your sign-in has expired. Sign in again to continue.'
          : 'Your signed-in account changed. Sign in again to open the right workspace.');
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (generation !== requestGeneration || options.signal?.aborted) {
          throw new DOMException('Discarded a previous request.', 'AbortError');
        }
        throw responseFailure(response.status, data, context);
      }
      return response;
    },
  };
}

export const apiClient = createApiClient({ baseUrl: API_BASE || '/' });
export const apiFetch = (...args) => apiClient.fetch(...args);
