import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Check, 
  CheckCircle2, 
  Sparkles, 
  Radio, 
  FileText, 
  ListTodo, 
  ExternalLink, 
  ArrowRight, 
  Volume2 
} from 'lucide-react';
import { 
  TOUR_STEPS, 
  getNextStepIndex, 
  getPrevStepIndex 
} from './tour-utils.js';

/**
 * FeatureShowcase: Interactive Guided Walkthrough Deck
 * Demonstrates the 4 core pillars of the AI Meeting Assistant with live animated mock UI widgets.
 */
export default function FeatureShowcase({ onExploreDemo }) {
  const [activeStep, setActiveStep] = useState(0);
  const [activeTurn, setActiveTurn] = useState(0);

  const step = TOUR_STEPS[activeStep];

  const handleNext = () => setActiveStep(prev => getNextStepIndex(prev, TOUR_STEPS.length));
  const handlePrev = () => setActiveStep(prev => getPrevStepIndex(prev, TOUR_STEPS.length));

  // Audio preview turn rotation demo for Step 2
  useEffect(() => {
    if (activeStep !== 1) return;
    const interval = setInterval(() => {
      setActiveTurn(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeStep]);

  return (
    <section className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-slate-200/80 shadow-glass space-y-6">
      {/* Background glow orb */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-bl from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Top Header & Step Navigation Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-700 border border-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase font-mono">
            How Local AI Orchestrates Your Meetings
          </h2>
        </div>

        {/* Step Tabs & Navigation Arrows */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50/70 p-1 rounded-2xl border border-slate-200">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeStep === idx 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                0{idx + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous step"
              className="p-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next step"
              className="p-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Showcase Grid: Left Description ↔ Right Interactive Mock UI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[340px]">
        
        {/* Left Column (5 Cols): Narrative & Feature Value */}
        <div className="lg:col-span-5 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 font-mono text-[10px] font-bold tracking-wider">
                {step.badge}
              </span>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {step.headline}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {step.description}
                </p>
              </div>

              {/* Feature Highlights Checklist */}
              <ul className="space-y-2 pt-1 text-xs text-slate-700">
                {step.highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              {onExploreDemo && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onExploreDemo}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    <span>{step.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column (7 Cols): Dynamic Simulated Mock Widget */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="relative p-6 rounded-3xl bg-slate-50/80 border border-slate-200 shadow-glass overflow-hidden"
            >
              
              {/* SLIDE 1: Simulated Video Conference Grid & Waveform */}
              {step.id === 'capture' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-semibold text-slate-900 font-mono">Live Conference Room (Q4 Review)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-indigo-700">
                      4 Participants
                    </span>
                  </div>

                  {/* 2x2 Video Tile Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {step.mockVisual.participants.map((p, idx) => (
                      <div 
                        key={idx}
                        className={`p-4 rounded-2xl border flex flex-col justify-between h-24 transition-all ${
                          p.isSpeaking 
                            ? 'bg-white border-indigo-500/60 shadow-lg shadow-indigo-500/20'
                            : 'bg-white/50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            p.isBot 
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {p.avatar}
                          </span>
                          {p.isSpeaking && (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-700">
                              <Radio className="w-3 h-3 animate-pulse" /> Speaking
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{p.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Audio Wave Bar */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/80 border border-indigo-500/20 text-xs">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-indigo-700 animate-pulse" />
                      <span className="text-slate-700 text-[11px] font-mono">Local Whisper Stream Buffer: 48kHz Stereo</span>
                    </div>
                    <div className="flex items-center gap-1 h-3" aria-hidden="true">
                      <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse" />
                      <span className="w-1 h-2 bg-indigo-300 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-4 bg-indigo-400 rounded-full animate-pulse delay-150" />
                      <span className="w-1 h-2.5 bg-indigo-200 rounded-full animate-pulse delay-300" />
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 2: Multi-Speaker Diarization & Audio Sync */}
              {step.id === 'transcript' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
                    <span className="font-mono text-slate-900 font-semibold">Attributed Timeline & Audio Seek</span>
                    <span className="font-mono text-[10px] text-teal-700">Pyannote 3.1 Clustered</span>
                  </div>

                  <div className="space-y-2.5">
                    {step.mockVisual.turns.map((turn, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                          activeTurn === idx 
                            ? 'bg-white border-teal-500/50 shadow-md shadow-teal-500/10'
                            : 'bg-white/40 border-slate-200/80'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-900 shrink-0 ${
                          idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-purple-600' : 'bg-emerald-600'
                        }`}>
                          {turn.initial}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-900">{turn.speaker}</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 font-mono text-[10px]">
                              <Play className="w-2 h-2 fill-teal-400" /> {turn.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-snug">{turn.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-teal-50/20 border border-teal-500/20 text-[11px] text-teal-700 flex items-center justify-between font-mono">
                    <span>Click any phrase to jump audio scrubber instantly</span>
                    <span>100% Grounded</span>
                  </div>
                </div>
              )}

              {/* SLIDE 3: Governance, Decisions & Risks */}
              {step.id === 'governance' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
                    <span className="font-mono text-slate-900 font-semibold">Synthesized Governance Matrix</span>
                    <span className="font-mono text-[10px] text-amber-700">Llama 3 8B Distilled</span>
                  </div>

                  {/* Decisions Pillar */}
                  <div className="p-3 rounded-2xl bg-white/60 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Binding Decisions (2)</span>
                    </div>
                    {step.mockVisual.decisions.map((d, idx) => (
                      <p key={idx} className="text-xs text-slate-700 pl-4 border-l-2 border-emerald-500/40 leading-snug">
                        • {d}
                      </p>
                    ))}
                  </div>

                  {/* Tasks Checklist */}
                  <div className="p-3 rounded-2xl bg-white/60 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>Extracted Action Items</span>
                    </div>
                    {step.mockVisual.tasks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                            t.done ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-300'
                          }`}>
                            {t.done && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span className={t.done ? 'line-through text-slate-500' : ''}>{t.text}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 font-mono text-[10px]">
                          @{t.assignee}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SLIDE 4: Connectors Hub Dispatch */}
              {step.id === 'connectors' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-200">
                    <span className="font-mono text-slate-900 font-semibold">Executive Dispatch Hub</span>
                    <span className="font-mono text-[10px] text-sky-700">Zero-Token REST & Mailto</span>
                  </div>

                  {/* GitHub Dispatch Card */}
                  <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-900">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">GitHub Issues Sync</h4>
                        <p className="text-[10px] text-slate-600 font-mono">Repo: {step.mockVisual.githubRepo}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 text-[10px] font-mono font-bold">
                      {step.mockVisual.issuesGenerated} Issues Ready
                    </span>
                  </div>

                  {/* Gmail Dispatch Card */}
                  <div className="p-3.5 rounded-2xl bg-white/60 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-rose-500/15 text-rose-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Executive Gmail Dispatch</h4>
                        <p className="text-[10px] text-slate-600 font-mono">To: {step.mockVisual.gmailRecipient}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-700 text-[10px] font-mono font-bold">
                      Pre-rendered
                    </span>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Progress Dots Bottom Indicator */}
      <div className="flex items-center justify-center gap-2 pt-2">
        {TOUR_STEPS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveStep(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              activeStep === idx 
                ? 'w-8 bg-indigo-500 shadow-sm shadow-indigo-500/50' 
                : 'w-2 bg-slate-100 hover:bg-slate-200'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
