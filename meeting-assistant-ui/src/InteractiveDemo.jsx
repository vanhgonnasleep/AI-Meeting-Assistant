import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AudioLines, Play, Pause, FileText, Check, ArrowUpRight, Volume2, CircleCheck, ListTodo } from 'lucide-react';
import { ClarionMark, GitHubMark, GmailMark } from './BrandMarks.jsx';
import { DEMO_SAMPLE, sampleTurnAt } from './demo-sample.js';

const STEPS = [
  { label: 'Hear it', icon: AudioLines },
  { label: 'Make sense of it', icon: FileText },
  { label: 'Follow through', icon: ListTodo },
];
const WAVE = [10,16,24,14,32,46,26,18,38,58,34,22,48,64,42,28,18,36,54,30,20,40,60,46,26,16,34,48,30,20,26,12];
const clock = seconds => `00:${Math.floor(seconds).toString().padStart(2, '0')}`;

function AudioArtwork({ animated }) {
  const gradient = useId();
  return <div className="demo-audio-art" aria-hidden="true" data-animated={animated}>
    <svg className="demo-orbits" viewBox="0 0 500 270" fill="none">
      <defs><linearGradient id={gradient}><stop stopColor="#8e9ce9" /><stop offset="1" stopColor="#c0dcca" /></linearGradient></defs>
      <ellipse cx="250" cy="136" rx="190" ry="86" stroke={`url(#${gradient})`} strokeOpacity=".36" transform="rotate(-17 250 136)" />
      <ellipse cx="250" cy="136" rx="165" ry="110" stroke={`url(#${gradient})`} strokeOpacity=".25" transform="rotate(18 250 136)" />
      <circle cx="91" cy="111" r="5" fill="#aab8ed" /><circle cx="418" cy="142" r="4" fill="#9ec7b1" />
    </svg>
    <div className="demo-sound-disc"><div className="demo-spectrum">{WAVE.map((height, i) => <i key={i} style={{ '--wave-height': `${height}px`, '--wave-delay': `${i * -.085}s` }} />)}</div></div>
    <div className="demo-floating-quote quote-budget"><span className="demo-avatar lavender">A</span><div><small>One decision</small><strong>$50,000 for Q3</strong></div></div>
    <div className="demo-floating-quote quote-deadline"><span className="demo-avatar mint">B</span><div><small>One next step</small><strong>John · Friday</strong></div><Check size={14} /></div>
  </div>;
}

export default function InteractiveDemo({ compact = false }) {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioError, setAudioError] = useState('');
  const audio = useRef(null);
  const container = useRef(null);
  const reduceMotion = useReducedMotion();
  const id = useId();
  const turn = DEMO_SAMPLE.turns[sampleTurnAt(seconds)];
  const animate = autoPlay && visible && !reduceMotion && !playing;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !document.hidden), { threshold: .15 });
    observer.observe(container.current);
    const visibility = () => {
      const bounds = container.current?.getBoundingClientRect();
      setVisible(!document.hidden && Boolean(bounds && bounds.bottom > 0 && bounds.top < window.innerHeight));
      if (document.hidden) audio.current?.pause();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setStep(value => (value + 1) % STEPS.length), 5200);
    return () => clearInterval(timer);
  }, [animate]);
  useEffect(() => {
    const element = audio.current;
    return () => element?.pause();
  }, []);

  const chooseStep = value => { audio.current?.pause(); setStep(value); setAutoPlay(false); };
  const toggleAudio = async () => {
    setAutoPlay(false); setAudioError('');
    if (playing) { audio.current.pause(); return; }
    try { await audio.current.play(); }
    catch { setAudioError('Audio could not play. You can still explore the notes and follow-ups.'); }
  };

  return <section className={`interactive-demo ${compact ? 'demo-compact' : ''}`} ref={container} aria-label="Interactive meeting sample" onFocusCapture={event => {
    if (!event.target.closest('[data-autoplay-toggle]')) setAutoPlay(false);
  }}>
    <audio ref={audio} src={DEMO_SAMPLE.audio} preload="none" onTimeUpdate={event => setSeconds(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    <div className="demo-frame">
      <div className="demo-frame-header"><span className="demo-mini-brand"><ClarionMark size={16} />clarion<span>/</span><span>Q3 budget review</span></span>
        <div><span className="sample-badge">Sample</span>{!reduceMotion && <button type="button" data-autoplay-toggle onClick={() => setAutoPlay(value => !value)} aria-label={autoPlay ? 'Pause demo animation' : 'Play demo animation'} aria-pressed={autoPlay}>
          {autoPlay ? <Pause size={13} /> : <Play size={13} />}</button>}</div></div>
      <div className="demo-stage" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-step-${step}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} className={`demo-scene demo-scene-${step}`} initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -7 }} transition={{ duration: .24 }}>
            {step === 0 && <>
              <AudioArtwork animated={animate || playing} />
              <div className="demo-transcript-snippet"><span className={`demo-avatar ${turn.accent}`}>{turn.initial}</span><div><small>{turn.speaker}<span>{clock(seconds)}</span></small><p>“{turn.text}”</p></div></div>
              <div className="demo-audio-player"><button type="button" className="demo-audio-play" onClick={toggleAudio} aria-label={playing ? 'Pause sample audio' : 'Play 29-second sample audio'}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
                <input type="range" min="0" max={DEMO_SAMPLE.duration} step=".1" value={seconds} aria-label="Sample audio position" aria-valuetext={`${clock(seconds)} of 00:29`} onChange={event => { const value = Number(event.target.value); audio.current.currentTime = value; setSeconds(value); }} />
                <span>{clock(seconds)} / 00:29</span><Volume2 size={13} /></div>
              {audioError && <p className="demo-audio-error" role="status">{audioError}</p>}
            </>}
            {step === 1 && <div className="demo-notes-scene">
              <div className="demo-notes-source"><AudioLines size={17} /><span>29 seconds of conversation</span><div className="demo-tiny-wave" aria-hidden="true">{WAVE.slice(0, 17).map((h, i) => <i key={i} style={{ height: `${h / 4}px` }} />)}</div></div>
              <div className="demo-extract-line" aria-hidden="true"><i /></div>
              <div className="demo-note-document"><div className="demo-note-document-title"><span><FileText size={17} /></span><div><small>MEETING NOTES</small><h3>All the signal.</h3></div><CircleCheck size={17} /></div>
                <div className="demo-decision-highlight"><small>DECISION · 00:12</small><p><strong>$50,000</strong> for Q3 social campaigns.</p></div>
                <div className="demo-note-lines" aria-hidden="true"><i /><i /><i /></div>
                <div className="demo-note-owner"><span className="demo-avatar peach">J</span><div><strong>Financial breakdown</strong><small>John · Friday afternoon</small></div><span className="demo-status-pill">To do</span></div>
              </div>
              <span className="demo-evidence"><Check size={12} />Linked back to the conversation</span>
            </div>}
            {step === 2 && <div className="demo-followup-scene">
              <div className="demo-action-ticket"><div><ListTodo size={16} /><span>ACTION ITEM</span><span className="demo-status-pill">To do</span></div><h3>{DEMO_SAMPLE.task.text}</h3><footer><span className="demo-avatar peach">J</span><span>John</span><span>Friday afternoon</span></footer></div>
              <div className="demo-branch" aria-hidden="true"><span /><i /><i /></div>
              <div className="demo-destination-pair"><div><GitHubMark size={25} /><strong>GitHub issue</strong><small>Task + owner + deadline</small><ArrowUpRight size={14} /></div><div><GmailMark size={27} /><strong>Gmail draft</strong><small>Notes ready to share</small><ArrowUpRight size={14} /></div></div>
              <span className="demo-evidence">You review. You publish.</span>
            </div>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="demo-step-controls" role="tablist" aria-label="Explore the meeting workflow">{STEPS.map(({ label, icon: Icon }, index) => <button type="button" key={label} id={`${id}-step-${index}`} role="tab" aria-selected={step === index} aria-controls={`${id}-panel`} tabIndex={step === index ? 0 : -1}
        onClick={() => chooseStep(index)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
          if (next !== null) { event.preventDefault(); chooseStep(next); document.getElementById(`${id}-step-${next}`)?.focus(); }
        }}><Icon size={14} /><span>{label}</span>{step === index && <motion.i layoutId={`${id}-active-step`} transition={{ duration: .22 }} />}</button>)}</div>
    </div>
    <div className="demo-sample-caption"><span><i />Recorded sample · Prepared outputs</span><span>Sound only when you press play</span></div>
  </section>;
}
