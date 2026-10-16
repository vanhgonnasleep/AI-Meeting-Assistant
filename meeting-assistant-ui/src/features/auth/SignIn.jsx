import { GitHubMark, GoogleMark } from '../../shared/ui/BrandMarks.jsx';
import { API_BASE } from './api-client.js';

const CALLBACK_ERRORS = {
  cancelled: 'Sign-in was cancelled. You can try again when you are ready.',
  provider_failed: 'Your account could not be verified. Please try signing in again.',
};

export default function SignIn({ providers = {}, error, onRetry, checking = false }) {
  const callbackError = CALLBACK_ERRORS[new URLSearchParams(globalThis.location?.search).get('auth_error')];
  return <main className="min-h-screen bg-canvas px-5 py-12 flex items-center justify-center">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 sm:p-10 shadow-panel space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-widest uppercase text-indigo-700">Clarion</p>
        <h1 className="text-3xl font-semibold text-slate-900">Your private meeting workspace</h1>
        <p className="text-sm leading-6 text-slate-600">Sign in to organize your meetings, transcripts and action items in your own library.</p>
      </div>
      {(error || callbackError) && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error || callbackError}</p>}
      {checking ? <p role="status" className="text-sm text-slate-600">Checking your session…</p> : <>
        <div className="space-y-3">
          {[['google', 'Google', GoogleMark], ['github', 'GitHub', GitHubMark]].map(([provider, label, Mark]) => (
            <button key={provider} type="button" disabled={!providers[provider]}
              onClick={() => { window.location.assign(`${API_BASE}/api/auth/${provider}/login`); }}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed">
              <Mark size={20} />Continue with {label}
            </button>
          ))}
        </div>
        {!providers.google && !providers.github && !error && <p className="text-sm text-slate-600">Sign-in is being configured. Contact your administrator to enable Google or GitHub.</p>}
        <button type="button" onClick={onRetry} className="text-sm font-medium text-indigo-700 underline underline-offset-4">Check connection again</button>
      </>}
    </section>
  </main>;
}
