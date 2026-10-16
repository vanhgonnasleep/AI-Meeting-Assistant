import { ArrowRight } from 'lucide-react';
import InteractiveDemo from './InteractiveDemo.jsx';

export default function FeatureShowcase({ onExploreDemo }) {
  return <section className="workspace-sample-demo">
    <div><span className="workspace-eyebrow">Less explaining. More trying.</span><h2>A small meeting.<br />The whole workflow.</h2><p>Play the recording. Explore the notes and follow-ups.</p><button type="button" onClick={onExploreDemo}>Try your own recording<ArrowRight size={14} /></button></div>
    <InteractiveDemo compact />
  </section>;
}
