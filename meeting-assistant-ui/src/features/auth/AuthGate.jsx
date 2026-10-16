import { userMessage } from '../../shared/lib/user-errors.js';
import { fetchSession } from './session-check.js';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import App from '../../app/App.jsx';
import SignIn from './SignIn.jsx';
import { API_BASE, apiClient, apiFetch } from './api-client.js';
import { navigateTo, subscribeToNavigation } from '../../app/navigation.js';
import { getEntryRoute, navigateEntry } from '../../app/entry-navigation.js';
import LandingPage from '../landing/LandingPage.jsx';
import LazyPanel from '../../shared/ui/LazyPanel.jsx';
import { discardLegacyConnectorSettings } from './browser-privacy.js';

const loadPreviewWorkspace = () => import('../preview/PreviewWorkspace.jsx');

export default function AuthGate() {
  const entry = useSyncExternalStore(subscribeToNavigation, getEntryRoute, () => 'signin');
  const [state, setState] = useState({ phase: 'checking', session: null, error: '' });
  const [signingOut, setSigningOut] = useState(false);
  const [workspaceOwner, setWorkspaceOwner] = useState(null);
  const logoutPending = useRef(false);
  const recheckAfterLogout = useRef(false);
  const request = useRef(null);
  const sessionNotice = useRef('');

  const refresh = useCallback(async () => {
    if (logoutPending.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const session = await fetchSession(`${API_BASE}/api/auth/session`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const nextOwner = session.user?.id || (session.mode === 'local' ? 'local' : null);
      setWorkspaceOwner(previous => previous === nextOwner ? previous : null);
      if (session.user && (!window.location.hash || window.location.hash === '#/signin')) navigateTo('overview');
      apiClient.configureSession(session);
      if (session.user || session.mode === 'local') sessionNotice.current = '';
      setState({ phase: 'ready', session, error: sessionNotice.current });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState(previous => previous.phase === 'ready' && (previous.session?.user || previous.session?.mode === 'local') ? previous
        : { phase: 'error', session: null, error: userMessage(error, 'session') });
    }
  }, []);

  const retrySignIn = () => {
    sessionNotice.current = '';
    setState(previous => ({ ...previous, phase: 'checking', error: '' }));
    void refresh();
  };

  useEffect(() => {
    discardLegacyConnectorSettings();
    const stop = apiClient.onSessionInvalid(message => {
      sessionNotice.current = message;
      if (logoutPending.current) recheckAfterLogout.current = true;
      setState({ phase: 'checking', session: null, error: '' });
      setWorkspaceOwner(null);
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
      setWorkspaceOwner(null);
      setState(previous => ({ phase: 'ready', session: { ...previous.session, user: null, csrf_token: null }, error: '' }));
    } catch (error) {
      if (error.name !== 'AbortError') setState(previous => ({ ...previous, error: userMessage(error, 'logout') }));
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
      if (recheckAfterLogout.current) {
        recheckAfterLogout.current = false;
        void refresh();
      }
    }
  };

  const canEnter = Boolean(state.phase === 'ready' && (state.session.mode === 'local' || state.session.user));
  const workspaceIdentity = canEnter ? state.session.user?.id || 'local' : null;
  const markWorkspaceMounted = useCallback(node => {
    if (node) setWorkspaceOwner(workspaceIdentity);
  }, [workspaceIdentity]);
  const openWorkspace = () => canEnter ? navigateTo('overview') : navigateEntry('signin');
  const isPreview = entry.startsWith('preview/');
  const preview = isPreview ? <LazyPanel load={loadPreviewWorkspace} name="workspace preview"
      recoveryNote="Return to the home page or retry loading this prepared sample."
      onClose={() => navigateEntry('landing')} fallback={<p role="status" className="p-8">Loading preview…</p>}>
      {PreviewWorkspace => <PreviewWorkspace page={entry.split('/')[1]} onOpenWorkspace={openWorkspace} />}
    </LazyPanel> : null;
  if (isPreview && !canEnter) return preview;
  if (entry === 'landing' && !canEnter) {
    return <LandingPage onLaunchApp={openWorkspace} onOpenDashboard={() => navigateEntry('preview')}
      onPreview={() => navigateEntry('preview')} />;
  }
  if (!canEnter) {
    return <SignIn providers={state.session?.providers} error={state.error} checking={state.phase === 'checking'}
      canRetry={state.phase === 'error'} onRetry={retrySignIn}
      onHome={() => navigateEntry('landing')} onPreview={() => navigateEntry('preview')} />;
  }
  // A fresh preview never mounts the private App. Once explicitly opened, keep it
  // mounted while previewing so an upload, recording or unsaved result survives.
  const keepWorkspace = !isPreview || workspaceOwner === workspaceIdentity;
  return <>
    <div hidden={isPreview} ref={keepWorkspace ? markWorkspaceMounted : null}>
      {keepWorkspace && <App key={workspaceIdentity} account={state.session.user} onLogout={logout}
        signingOut={signingOut} accountError={state.error} />}
    </div>
    {preview}
  </>;
}
