import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  LockKeyhole,
  Quote,
} from 'lucide-react';
import { ClarionMark } from '../../shared/ui/BrandMarks.jsx';
import ProviderButtons from './components/ProviderButtons.jsx';
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
  checking = false,
  onHome = () => navigateEntry('landing'),
  onPreview = () => navigateEntry('preview'),
}) {
  const callbackError =
    CALLBACK_ERRORS[
      new URLSearchParams(globalThis.location?.search).get('auth_error')
    ];
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
            THE MEETING ENDS. THE IDEAS DON'T.
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
              More “let's get started.”
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
              Sign in to organize your meetings, transcripts and action items in
              your own library.
            </p>
          </div>
          {(error || callbackError) && <FeedbackNotice key={error || callbackError} title="Sign-in is unavailable" onRetry={onRetry} retryLabel="Check sign-in again">{error || callbackError}</FeedbackNotice>}
          {checking ? (
            <p role="status" className="text-sm text-slate-600">
              Checking your session…
            </p>
          ) : (
            <>
              <ProviderButtons providers={providers} />
              {!providers.google && !providers.github && !error && (
                <p className="text-sm text-slate-600">
                  Sign-in is being configured. Contact your administrator to
                  enable Google or GitHub.
                </p>
              )}
              <button
                type="button"
                onClick={onRetry}
                className="text-sm font-medium text-indigo-700 underline underline-offset-4"
              >
                Check connection again
              </button>
            </>
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
