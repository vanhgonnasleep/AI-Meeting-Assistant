import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { ClarionMark } from '../../../shared/ui/BrandMarks.jsx';

export default function LandingHeader({ isLoggedIn = false, onLaunchApp, onPreview, onScrollTo }) {
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
          See it work
        </button>
        <button type="button" onClick={() => onScrollTo('your-tools')}>
          Your tools
        </button>
        {!isLoggedIn && (
          <button type="button" onClick={onPreview} className="inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer hover:text-[#4b59b4] transition-colors">
            Preview workspace
            <ArrowRight size={13} className="shrink-0" />
          </button>
        )}
      </nav>
      <button
        type="button"
        className="visual-button button-ink"
        onClick={onLaunchApp}
      >
        Open workspace
        <ArrowUpRight size={15} />
      </button>
    </header>
  );
}
