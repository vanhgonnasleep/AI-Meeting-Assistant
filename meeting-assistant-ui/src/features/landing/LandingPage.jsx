import { ArrowRight, ArrowUpRight, LockKeyhole, AudioLines, FileText, Check, Laptop, MousePointer2 } from 'lucide-react';
import { ClarionMark, GitHubMark, GmailMark } from '../../shared/ui/BrandMarks.jsx';
import InteractiveDemo from './InteractiveDemo.jsx';
import ConnectorPreview from '../connectors/ConnectorPreview.jsx';
import { DEMO_SAMPLE } from './demo-sample.js';
import { buildGitHubIssuePayload } from '../connectors/connectors.js';

export default function LandingPage({ onLaunchApp, onOpenDashboard }) {
  const scrollTo = section => document.getElementById(section)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const issue = buildGitHubIssuePayload(DEMO_SAMPLE.task, { title: DEMO_SAMPLE.title, date: 'Recorded sample' });
  return <div className="clarion-landing visual-landing">
    <header className="visual-nav">
      <button type="button" className="visual-wordmark" onClick={onOpenDashboard} aria-label="Clarion dashboard"><span><ClarionMark /></span>clarion<span className="brand-period">.</span></button>
      <nav aria-label="Product navigation"><button type="button" onClick={() => scrollTo('sample-demo')}>See it work</button><button type="button" onClick={() => scrollTo('your-tools')}>Your tools</button><button type="button" onClick={onOpenDashboard}>Dashboard</button></nav>
      <button type="button" className="visual-button button-ink" onClick={onLaunchApp}>Open workspace<ArrowUpRight size={15} /></button>
    </header>

    <main>
      <section className="visual-hero" aria-labelledby="visual-hero-title">
        <div className="visual-hero-copy">
          <span className="visual-eyebrow"><i />A little less meeting. A lot more doing.</span>
          <h1 id="visual-hero-title">Let the ideas<br />keep <span className="hero-moving-word">moving.<svg viewBox="0 0 300 17" aria-hidden="true"><path d="M3 12Q127 0 296 9" /></svg></span></h1>
          <p>Your conversation, turned into clear notes and next steps. All on your computer.</p>
          <div className="visual-hero-actions"><button type="button" className="visual-button button-periwinkle" onClick={onLaunchApp}>Try your recording<ArrowRight size={16} /></button><button type="button" className="visual-demo-link" onClick={() => scrollTo('sample-demo')}><span><MousePointer2 size={14} /></span>Play with the sample</button></div>
          <div className="hero-file-note"><AudioLines size={14} /><span>Audio & video in.</span><FileText size={14} /><span>Clarity out.</span></div>
        </div>
        <div id="sample-demo" className="visual-hero-demo"><span className="demo-margin-note">A real recording. A little clarity.<svg viewBox="0 0 72 36" aria-hidden="true"><path d="M2 3Q15 36 62 22m-9-7 10 7-10 8" /></svg></span><InteractiveDemo /></div>
      </section>

      <div className="visual-proof-strip" aria-label="What you can do"><span><Check size={14} />Listen back</span><i /><span><Check size={14} />Know the next step</span><i /><span><Check size={14} />Take it to your tools</span><i /><span><LockKeyhole size={14} />Local AI</span></div>

      <section id="your-tools" className="visual-handoffs" aria-labelledby="handoff-title">
        <div className="visual-section-heading"><div><span className="visual-eyebrow">The meeting ends. The work moves.</span><h2 id="handoff-title">From “we should”<br />to <span>“on it.”</span></h2></div><p>Not another place to check.<br />A head start in the tools you use.</p></div>
        <div className="handoff-connection" aria-hidden="true"><span><FileText size={17} />Your meeting notes</span><i /><span className="handoff-core"><ClarionMark size={24} /></span><i /><span><GitHubMark size={18} /><GmailMark size={20} /></span></div>
        <div className="visual-handoff-grid">
          <section className="handoff-card handoff-github">
            <div className="handoff-card-heading"><span className="handoff-brand-icon"><GitHubMark size={27} /></span><div><h3>A task. Already an issue.</h3><p>GitHub · prefilled title, owner & deadline</p></div><ArrowUpRight size={19} /></div>
            <ConnectorPreview provider="github" repo="your-team/your-project" title={issue.title} body={issue.body} />
            <div className="handoff-destination"><code>github.com / your-repo / issues / new</code><span>You review & submit</span></div>
          </section>
          <section className="handoff-card handoff-gmail">
            <div className="handoff-card-heading"><span className="handoff-brand-icon"><GmailMark size={31} /></span><div><h3>The follow-up, half done.</h3><p>Gmail · meeting notes in a new draft</p></div><ArrowUpRight size={19} /></div>
            <ConnectorPreview provider="gmail" subject="Meeting notes: Q3 budget review" body={`Hi team,\n\n${DEMO_SAMPLE.summary}\n\nNext up\nJohn — financial report by Friday afternoon.\n\nThanks!`} />
            <div className="handoff-destination"><code>mail.google.com / compose</code><span>You choose who gets it</span></div>
          </section>
        </div>
        <div className="handoff-footnote"><span>Sample drafts above. Your meeting supplies the real content.</span><button type="button" onClick={onLaunchApp}>Use with your meeting<ArrowRight size={14} /></button></div>
      </section>

      <section className="visual-local-panel" aria-labelledby="local-panel-title">
        <div className="local-device-art" aria-hidden="true"><div className="local-device-orbit" /><span className="local-file-chip"><AudioLines size={18} /><i /><i /><i /></span><div className="local-device"><div><ClarionMark size={36} /><span>Working locally</span><i /></div><span /></div><span className="local-note-chip"><CircleNote /><Check size={14} /></span><span className="local-lock"><LockKeyhole size={17} /></span></div>
        <div><span className="visual-eyebrow">Room to think. Space to keep it yours.</span><h2 id="local-panel-title">Your meeting.<br /><span>Your machine.</span></h2><p>Whisper and Ollama do the thinking locally.<br />You decide what to share, and where.</p><div className="local-panel-facts"><span><Laptop size={14} />Local processing</span><span><LockKeyhole size={14} />No account needed</span></div></div>
      </section>

      <section className="visual-final-cta"><div><span className="visual-eyebrow">Give your next conversation somewhere to go.</span><h2>More present.<br /><span>Less catching up.</span></h2></div><button type="button" className="visual-button button-ink" onClick={onLaunchApp}>Open your workspace<ArrowUpRight size={17} /></button></section>
    </main>
    <footer className="visual-footer"><span className="visual-wordmark"><ClarionMark size={19} />clarion.</span><span>Built for the conversation. And what comes next.</span><span>Local meeting intelligence · 2026</span></footer>
  </div>;
}

function CircleNote() { return <svg viewBox="0 0 38 42" width="29" height="32" fill="none"><rect x="4" y="2" width="30" height="38" rx="6" fill="white" stroke="#b4c7bf" /><path d="M11 13h15M11 20h15M11 27h9" stroke="#8da99c" strokeWidth="2" strokeLinecap="round" /></svg>; }
