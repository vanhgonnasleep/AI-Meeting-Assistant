import { ArrowUpRight } from 'lucide-react';
import { ClarionMark } from '../../../shared/ui/BrandMarks.jsx';

export default function LandingHeader({ isLoggedIn = false, onLaunchApp, onScrollTo }) {
  return (
    <header className="visual-nav">
      <a className="visual-wordmark" href="#/landing" aria-label="Clarion home">
        <span>
          <ClarionMark />
        </span>
        clarion<span className="brand-period">.</span>
      </a>
      <nav aria-label="Product navigation">
        <button type="button" onClick={() => onScrollTo('sample-demo')}>
          Features
        </button>
        <button type="button" onClick={() => onScrollTo('your-tools')}>
          Integrations
        </button>
        <button type="button" onClick={() => onScrollTo('security-privacy')}>
          Security & Privacy
        </button>
      </nav>
      <button
        type="button"
        className="visual-button button-ink"
        onClick={onLaunchApp}
      >
        {isLoggedIn ? 'Open workspace' : 'Sign in'}
        <ArrowUpRight size={15} />
      </button>
    </header>
  );
}
