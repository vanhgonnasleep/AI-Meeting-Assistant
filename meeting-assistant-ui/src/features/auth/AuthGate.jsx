import { useCallback, useEffect, useRef, useState } from 'react';
import App from '../../app/App.jsx';
import SignIn from './SignIn.jsx';
import { API_BASE, apiClient, apiFetch } from './api-client.js';
import { navigateTo } from '../../app/navigation.js';
import { discardLegacyConnectorSettings } from './browser-privacy.js';

export default function AuthGate() {
  const [state, setState] = useState({ phase: 'checking', session: null, error: '' });
  const [signingOut, setSigningOut] = useState(false);
  const logoutPending = useRef(false);
  const recheckAfterLogout = useRef(false);
  const request = useRef(null);

  const refresh = useCallback(async () => {
    if (logoutPending.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Unable to check your session. Check the server connection and try again.');
      const session = await response.json();
      if (controller.signal.aborted) return;
      if (!['private', 'local'].includes(session.mode)) throw new Error('The server returned an invalid session.');
      if (session.user && !window.location.hash) navigateTo('overview');
      apiClient.configureSession(session);
      setState({ phase: 'ready', session, error: '' });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState(previous => previous.phase === 'ready' && previous.session?.user ? previous
        : { phase: 'error', session: null, error: error.message || 'Unable to reach the server. Please try again.' });
    }
  }, []);

  useEffect(() => {
    discardLegacyConnectorSettings();
    const stop = apiClient.onSessionInvalid(() => {
      if (logoutPending.current) recheckAfterLogout.current = true;
      setState({ phase: 'checking', session: null, error: '' });
      void refresh();
    });
    void refresh();
    const interval = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      request.current?.abort();
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      stop();
    };
  }, [refresh]);

  const logout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setSigningOut(true);
    request.current?.abort();
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed. Please try again.');
      request.current?.abort();
      apiClient.configureSession(null);
      setState(previous => ({ phase: 'ready', session: { ...previous.session, user: null, csrf_token: null }, error: '' }));
    } catch (error) {
      if (error.name !== 'AbortError') setState(previous => ({ ...previous, error: error.message }));
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
      if (recheckAfterLogout.current) {
        recheckAfterLogout.current = false;
        void refresh();
      }
    }
  };

  if (state.phase !== 'ready' || (state.session.mode === 'private' && !state.session.user)) {
    return <SignIn providers={state.session?.providers} error={state.error} checking={state.phase === 'checking'} onRetry={refresh} />;
  }
  return <App key={state.session.user?.id || 'local'} account={state.session.user} onLogout={logout}
    signingOut={signingOut} accountError={state.error} />;
}
