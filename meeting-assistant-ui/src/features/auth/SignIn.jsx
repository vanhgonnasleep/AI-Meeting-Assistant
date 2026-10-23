import { useState } from 'react';
import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Quote,
} from 'lucide-react';
import { ClarionMark } from '../../shared/ui/BrandMarks.jsx';
import ProviderButtons from './components/ProviderButtons.jsx';
import { API_BASE } from './api-client.js';
import { navigateEntry } from '../../app/entry-navigation.js';

const CALLBACK_ERRORS = {
  cancelled: 'Sign-in was cancelled. You can try again when you are ready.',
  provider_failed:
    'Your account could not be verified. Please try signing in again.',
};

export default function SignIn({
  providers = {},
  error,
  onRetry,
  canRetry = false,
  checking = false,
  onAuthenticated,
  onHome = () => navigateEntry('landing'),
  onPreview = () => navigateEntry('preview'),
}) {
  const [authTab, setAuthTab] = useState('signin'); // 'signin' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const callbackError =
    CALLBACK_ERRORS[
      new URLSearchParams(globalThis.location?.search).get('auth_error')
    ];

  const handleLocalSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    setSubmitting(true);
    try {
      const endpoint =
        authTab === 'register'
          ? `${API_BASE}/api/auth/register`
          : `${API_BASE}/api/auth/login`;
      const body =
        authTab === 'register'
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.detail ||
            (authTab === 'register'
              ? 'Could not create your account. Please check your details.'
              : 'Invalid email or password.'),
        );
      }
      onAuthenticated?.(data);
    } catch (err) {
      setFormError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = formError || error || callbackError;

  return (
    <div className="auth-experience">
      <header className="auth-public-header">
        <button type="button" className="auth-brand" onClick={onHome}>
          <ClarionMark size={27} />
          clarion.
        </button>
        <button type="button" onClick={onHome}>
          <ArrowLeft size={14} />
          Back to the story
        </button>
      </header>
      <main className="auth-layout">
        <section className="auth-story" aria-label="A look inside Clarion">
          <span className="auth-eyebrow">
            THE MEETING ENDS. THE IDEAS DON&apos;T.
          </span>
          <h2>
            Good conversations
            <br />
            deserve <em>a next step.</em>
          </h2>
          <p>
            One calm place for your notes, decisions
            <br />
            and everything that comes after.
          </p>
          <div className="auth-note-preview">
            <div>
              <span>
                <FileText size={16} />
                Q3 budget review
              </span>
              <small>PREPARED SAMPLE</small>
            </div>
            <Quote size={25} />
            <h3>
              Less “what did we agree?”
              <br />
              More “let&apos;s get started.”
            </h3>
            <p>$50,000 for Q3 social campaigns.</p>
            <footer>
              <span className="auth-sample-avatar">J</span>
              <div>
                <strong>Prepare the financial report</strong>
                <small>John · Friday afternoon</small>
              </div>
              <Check size={17} />
            </footer>
          </div>
          <button
            type="button"
            className="auth-preview-link"
            onClick={onPreview}
          >
            Explore preview <ArrowUpRight size={16} />
          </button>
          <span className="auth-preview-note">
            No account needed to look around.
          </span>
        </section>
        <section className="auth-signin-panel">
          <div>
            <h1>Your private meeting workspace</h1>
            <p>
              Sign in or register a local account to organize your meetings,
              transcripts and action items in your own private library.
            </p>
          </div>
          {activeError && (
            <FeedbackNotice
              key={activeError}
              title={canRetry ? 'Sign-in is unavailable' : 'Sign in to continue'}
              onDismiss={formError ? () => setFormError('') : undefined}
            >
              {activeError}
            </FeedbackNotice>
          )}
          {checking ? (
            <p role="status" className="text-sm text-slate-600">
              Checking your session…
            </p>
          ) : (
            <>
              <div className="auth-mode-tabs" role="tablist" aria-label="Account access mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'signin'}
                  className={authTab === 'signin' ? 'is-active' : ''}
                  onClick={() => {
                    setAuthTab('signin');
                    setFormError('');
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'register'}
                  className={authTab === 'register' ? 'is-active' : ''}
                  onClick={() => {
                    setAuthTab('register');
                    setFormError('');
                  }}
                >
                  Register Account
                </button>
              </div>

              <form className="auth-local-form" onSubmit={handleLocalSubmit}>
                {authTab === 'register' && (
                  <div className="auth-field">
                    <label htmlFor="full-name">Full name</label>
                    <input
                      id="full-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      enterKeyHint="next"
                      required
                      maxLength={120}
                      placeholder="e.g. Luồng Nguyễn"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="auth-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck="false"
                    enterKeyHint="next"
                    required
                    maxLength={254}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="auth-field">
                  <div className="auth-field-label-row">
                    <label
                      htmlFor={
                        authTab === 'register'
                          ? 'new-password'
                          : 'current-password'
                      }
                    >
                      {authTab === 'register'
                        ? 'Password (min. 8 characters)'
                        : 'Password'}
                    </label>
                    <button
                      type="button"
                      className="auth-password-toggle"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    id={
                      authTab === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    name={authTab === 'register' ? 'new-password' : 'password'}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      authTab === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    enterKeyHint="done"
                    required
                    minLength={authTab === 'register' ? 8 : 1}
                    maxLength={256}
                    placeholder={
                      authTab === 'register'
                        ? 'Create a strong password'
                        : 'Enter your password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="auth-submit-btn"
                >
                  {submitting
                    ? authTab === 'register'
                      ? 'Creating account…'
                      : 'Signing in…'
                    : authTab === 'register'
                      ? 'Create account'
                      : 'Sign In'}
                </button>
              </form>

              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <ProviderButtons providers={providers} />
              {!providers.google && !providers.github && !error && (
                <p className="text-xs text-slate-500">
                  OAuth single sign-on is not configured. Contact your
                  administrator to enable Google or GitHub, or use a local
                  account above.
                </p>
              )}
            </>
          )}
          {!checking && canRetry && (
            <button
              type="button"
              className="auth-preview-link"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
          <div className="auth-privacy-note">
            <LockKeyhole size={17} />
            <p>
              A library of your own.
              <br />
              <span>Private to your account. AI runs locally.</span>
            </p>
          </div>
          <div className="auth-signin-footer">
            <span>Just taking a look?</span>
            <button type="button" onClick={onPreview}>
              Explore preview <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
