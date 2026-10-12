import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  LayoutDashboard, 
  Lock, 
  Server, 
  Radio, 
  Sliders, 
  ListTodo, 
  Send, 
  Video
} from 'lucide-react';
import { detectMeetingPlatform, getPlatformDetails, validateMeetingUrl, formatBotJoinConfirmation } from './notta-bot-utils.js';

/**
 * Animated soundwave equalizer bars
 */
function SoundwaveEqualizer({ active = true }) {
  return (
    <div className="flex items-center gap-1 h-5 px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 shadow-inner" aria-hidden="true">
      <span className={`w-1 rounded-full bg-indigo-400 ${active ? 'animate-pulse' : 'h-2'}`} style={{ height: active ? '14px' : '6px' }} />
      <span className={`w-1 rounded-full bg-cyan-300 ${active ? 'animate-pulse' : 'h-3'}`} style={{ height: active ? '18px' : '10px', animationDelay: '150ms' }} />
      <span className={`w-1 rounded-full bg-violet-400 ${active ? 'animate-pulse' : 'h-1.5'}`} style={{ height: active ? '12px' : '8px', animationDelay: '300ms' }} />
      <span className={`w-1 rounded-full bg-emerald-400 ${active ? 'animate-pulse' : 'h-2.5'}`} style={{ height: active ? '16px' : '4px', animationDelay: '75ms' }} />
    </div>
  );
}

/**
 * Pipeline Steps Data for Act 2
 */
const PIPELINE_STEPS = [
  {
    id: 'capture',
    num: '01',
    badge: 'Universal Ingestion',
    title: 'Audio Capture & Timeline Sync',
    desc: 'Instant ingestion from Google Meet, Zoom, Teams, Webex or local audio files. Precise millisecond waveform scrubbing.',
    color: 'from-blue-500 to-indigo-600',
    accent: 'text-indigo-400',
    border: 'border-indigo-500/30',
    highlights: [
      'Multi-platform URL capture (Meet, Zoom, Teams, Webex)',
      'Direct drag-and-drop FLAC, WAV, MP3, MP4, MKV up to 256 MiB',
      'Millisecond-accurate timeline scrubbing with seekable audio'
    ],
    mockType: 'capture'
  },
  {
    id: 'diarize',
    num: '02',
    badge: 'Voiceprint Clustering',
    title: 'Speaker Diarization & Semantic RAG',
    desc: 'Distinguishes who spoke what with sub-word acoustic embeddings. Grounded semantic question-answering with citation jumps.',
    color: 'from-emerald-500 to-teal-600',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/30',
    highlights: [
      'Automatic speaker attribution with custom name re-tagging',
      'Native bilingual support for Vietnamese & technical English',
      'Semantic Q&A grounded against verified audio timestamps'
    ],
    mockType: 'diarize'
  },
  {
    id: 'dispatch',
    num: '03',
    badge: 'Workflow Automation',
    title: 'Executive Minutes & 1-Click Dispatch',
    desc: 'Synthesizes decisions and actionable tasks. Dispatches directly to GitHub Issues and Gmail without storing third-party API tokens.',
    color: 'from-violet-500 to-purple-600',
    accent: 'text-purple-400',
    border: 'border-purple-500/30',
    highlights: [
      'Automatic extraction of decisions, blockers, and owners',
      'RFC 3986 client-side deep links for zero-token GitHub sync',
      'Pre-formatted executive minutes ready for Gmail composer'
    ],
    mockType: 'dispatch'
  }
];

/**
 * Modernized, Vibrant, and Compact Landing Page
 * Addresses user feedback:
 * 1. Rich multi-color palette (Aurora violet/indigo/cyan/emerald, glowing borders, high-contrast badges)
 * 2. Logical, concise 4-Act structure (cuts out 60% of unnecessary vertical scrolling)
 */
export default function LandingPage({
  onLaunchApp,
  onOpenDashboard
}) {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [dispatchStatus, setDispatchStatus] = useState(null);

  const detectedPlatform = useMemo(() => detectMeetingPlatform(meetingUrl), [meetingUrl]);
  const platformInfo = useMemo(() => detectedPlatform ? getPlatformDetails(detectedPlatform) : null, [detectedPlatform]);
  const isValidUrl = useMemo(() => validateMeetingUrl(meetingUrl), [meetingUrl]);

  const handleQuickJoin = (e) => {
    e.preventDefault();
    if (!isValidUrl) return;
    const confirmation = formatBotJoinConfirmation({ url: meetingUrl });
    setDispatchStatus(confirmation);
  };

  const activeStep = PIPELINE_STEPS[activeStepIdx];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Background Cyber Dot Grid & Vivid Ambient Aurora Blooms */}
      <div 
        className="absolute inset-0 pointer-events-none -z-10" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 w-[42rem] h-[28rem] rounded-full bg-violet-600/20 blur-[130px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[28%] -right-20 w-[38rem] h-[32rem] rounded-full bg-cyan-500/15 blur-[140px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[65%] -left-20 w-[36rem] h-[30rem] rounded-full bg-emerald-500/12 blur-[130px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* 1. STICKY TOP NAVBAR */}
      <header className="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">AI Meeting Assistant</span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-medium">
              100% On-Device
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Dashboard</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onLaunchApp}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-90 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </header>

      {/* 2. ACT 1: HERO & ALL-IN-ONE INGESTION */}
      <section className="relative pt-12 pb-16 px-4 sm:px-8 max-w-6xl mx-auto space-y-8">
        
        {/* Hero Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-violet-500/30 text-violet-300 text-xs font-medium shadow-md shadow-violet-500/10 backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-[11px]">Local Whisper Large • Ollama • Zero Telemetry</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.12]">
            Turn Every Discussion Into <br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Decisive Action Items.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-normal leading-relaxed">
            Automatic speaker diarization, real-time waveform sync, executive minutes, and one-click GitHub & Gmail dispatch — running 100% on your workstation.
          </p>
        </div>

        {/* All-in-One Hero Stage: Interactive Meeting Ingest + Live Conference Mockup */}
        <div className="rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 hover:border-violet-500/40 shadow-2xl p-5 sm:p-7 space-y-6 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/10 via-violet-500/10 to-transparent pointer-events-none rounded-tr-3xl" />

          {/* Quick Meeting Ingestion Form */}
          <div className="space-y-3 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Video className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-white tracking-tight uppercase font-mono">
                  Quick Capture: Paste Meeting URL or Drag File
                </span>
              </div>

              {/* Detected Platform Badge */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                {platformInfo ? (
                  <span className={`px-2.5 py-0.5 rounded-full border ${platformInfo.badgeClass} font-semibold flex items-center gap-1`}>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{platformInfo.label} Detected</span>
                  </span>
                ) : (
                  <span className="text-slate-500">Supports: Meet, Zoom, Teams, Webex, YouTube</span>
                )}
              </div>
            </div>

            <form onSubmit={handleQuickJoin} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="Paste meeting link: https://meet.google.com/... or https://zoom.us/j/..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs text-white placeholder-slate-500 transition-all font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!isValidUrl}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Join & Capture</span>
                </button>

                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Upload Audio File</span>
                </button>
              </div>
            </form>

            {dispatchStatus && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between"
              >
                <span>{dispatchStatus.readyMessage}</span>
                <a
                  href={dispatchStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-white"
                >
                  Open Call
                </a>
              </motion.div>
            )}
          </div>

          {/* Live Conference Stage Visualizer */}
          <div className="pt-2 border-t border-slate-800/80 space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-semibold text-white">Live Conference Room: Q4 Architecture Review</span>
              </div>
              <div className="flex items-center gap-3">
                <SoundwaveEqualizer active={true} />
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
                  LOCAL DIARIZATION ACTIVE
                </span>
              </div>
            </div>

            {/* Video Tile Grid (3 Speakers with Vibrant Avatars) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-indigo-500/40 flex flex-col justify-between h-28 relative overflow-hidden group shadow-lg shadow-indigo-500/10">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px] font-bold">
                    SPEAKER A
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Alex Rivera</p>
                  <p className="text-[10px] text-indigo-400 font-mono">Product Lead • Speaking</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-400" />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between h-28 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold">
                    SPEAKER B
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Dr. Sarah Chen</p>
                  <p className="text-[10px] text-emerald-400 font-mono">Speech AI Lead</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between h-28 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[9px] font-bold">
                    SPEAKER C
                  </span>
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Marcus Vance</p>
                  <p className="text-[10px] text-violet-400 font-mono">Staff Infrastructure</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-500" />
              </div>
            </div>

            {/* Attributed Streaming Dialogue Excerpt */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold shrink-0">
                  Alex [00:14]
                </span>
                <p className="text-slate-200">
                  "Target release is next Tuesday. Sarah, can you ensure the Pyannote voice clustering footprint stays under 1.5 GiB?"
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                  Sarah [00:22]
                </span>
                <p className="text-slate-200">
                  "Done. Tested on RTX 4080: 1.2 GiB VRAM allocation, 12x real-time speedup with FP16 weights."
                </p>
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* 3. ACT 2: THE 3-STEP INTELLIGENCE PIPELINE (INTERACTIVE STEPPER TABS) */}
      <section className="py-14 px-4 sm:px-8 max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium">
            <Sliders className="w-3.5 h-3.5" />
            <span>Linear 3-Step Pipeline</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How Conversations Become Deliverables
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A compact, cohesive flow that replaces fragmented note-taking tools. Select a phase to explore:
          </p>
        </div>

        {/* Stepper Tabs Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PIPELINE_STEPS.map((s, idx) => {
            const isActive = activeStepIdx === idx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStepIdx(idx)}
                className={`p-4 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                  isActive 
                    ? 'bg-slate-900/90 border-cyan-400/50 shadow-xl shadow-cyan-500/10' 
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-xs font-bold ${isActive ? s.accent : 'text-slate-500'}`}>
                    {s.num}. {s.badge}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">{s.title}</h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{s.desc}</p>
                {isActive && (
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Phase Interactive Mock Display */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              {/* Left Column (5 cols): Description & Highlights */}
              <div className="lg:col-span-5 space-y-4">
                <span className={`inline-block px-2.5 py-0.5 rounded-full bg-white/5 border ${activeStep.border} ${activeStep.accent} font-mono text-[10px] font-bold uppercase`}>
                  Phase {activeStep.num} • {activeStep.badge}
                </span>
                <h3 className="text-2xl font-extrabold text-white tracking-tight leading-snug">
                  {activeStep.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  {activeStep.desc}
                </p>

                <ul className="space-y-2 pt-2 text-xs text-slate-200">
                  {activeStep.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onLaunchApp}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    <span>Test In Studio Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column (7 cols): Vibrant Mock Demonstration */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-3">
                {activeStep.id === 'capture' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                      <span className="font-mono text-cyan-300 font-semibold">Waveform Audio Player (01:43:58)</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">Seekable</span>
                    </div>
                    {/* Simulated Waveform Canvas */}
                    <div className="h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center px-4 gap-1 overflow-hidden">
                      {Array.from({ length: 36 }).map((_, i) => {
                        const h = Math.sin(i * 0.4) * 20 + 24;
                        return (
                          <span
                            key={i}
                            className={`w-1 rounded-full transition-all ${i < 18 ? 'bg-cyan-400' : 'bg-slate-700'}`}
                            style={{ height: `${h}px` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Elapsed: 00:48:20</span>
                      <span className="text-cyan-400 font-semibold">Click bar to jump timestamp</span>
                      <span>Total: 01:43:58</span>
                    </div>
                  </div>
                )}

                {activeStep.id === 'diarize' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                      <span className="font-mono text-emerald-300 font-semibold">Sub-Word Diarization & Grounded RAG</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">3 Speakers</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-indigo-500/30 space-y-1">
                      <span className="text-[10px] font-mono text-indigo-400 font-semibold">Prompt: "What was the agreed deadline for the Whisper FP16 cutover?"</span>
                      <p className="text-slate-200 text-xs">
                        "Sarah Chen committed to Tuesday after verifying the 1.2 GiB VRAM allocation on the RTX 4080 (see [00:22])."
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">Grounded Citation: [00:22]</span>
                      <span className="text-slate-500 text-[10px]">• 100% verified against raw audio</span>
                    </div>
                  </div>
                )}

                {activeStep.id === 'dispatch' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                      <span className="font-mono text-violet-300 font-semibold">RFC 3986 1-Click Connectors Hub</span>
                      <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[10px]">Zero Tokens</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2 text-white font-bold text-xs">
                          <ListTodo className="w-4 h-4 text-violet-400" />
                          <span>GitHub Issues</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Creates new issue pre-filled with task, assignee, and meeting citation.</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2 text-white font-bold text-xs">
                          <Send className="w-4 h-4 text-cyan-400" />
                          <span>Gmail Minutes</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Opens Gmail composer with executive summary, decisions, and action items.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 4. ACT 3: DATA SOVEREIGNTY: ON-DEVICE VS CLOUD SAAS */}
      <section className="py-14 px-4 sm:px-8 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Why Local AI Beats Cloud Meeting Recorders
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Internal strategy discussions belong inside your workstation, not on remote third-party SaaS servers.
          </p>
        </div>

        {/* High-Contrast Comparison Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: On-Device (Vivid Emerald Glow) */}
          <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-emerald-500/40 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 blur-2xl pointer-events-none rounded-tr-3xl" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">This Assistant (On-Device)</h3>
                  <p className="text-[10px] text-emerald-400 font-mono font-medium">100% Workstation Stack</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                Zero Cloud Leaks
              </span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>100% Data Sovereignty:</strong> Audio, transcripts, and embeddings stay strictly in local memory and SQLite.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>No Monthly Subscriptions:</strong> Unlimited minutes powered by local GPUs (RTX 4080 / Apple Silicon / CPU).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Zero-Token Direct Links:</strong> RFC 3986 deep links to GitHub & Gmail without saving 3rd-party API tokens.</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Cloud SaaS (Muted Gray/Rose) */}
          <div className="p-6 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">Cloud Meeting Bots</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Notta / Otter / Fireflies SaaS</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 font-mono text-[10px] font-bold">
                External Cloud
              </span>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Voice recordings piped over public internet to external vendor data centers.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Expensive per-seat monthly subscription tiers with minute quotas.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Requires storing sensitive OAuth tokens and cloud permissions on external servers.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* 5. ACT 4: HIGH-CONVERSION CTA & DIRECT WORKSPACE LAUNCH */}
      <section className="py-16 px-4 sm:px-8 max-w-5xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-violet-950/40 via-slate-900/70 to-slate-950 border border-indigo-500/30 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-32 bg-violet-500/20 blur-3xl pointer-events-none" />

          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Capture Decisive Meetings?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Open the studio workspace now to paste your meeting link or upload an audio file. No signup required.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onLaunchApp}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-90 text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Enter Studio Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            <button
              type="button"
              onClick={onOpenDashboard}
              className="px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/70 text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span>Browse Past Records</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-10 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 mt-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Local AI Pipeline Operational (Whisper • Ollama • Pyannote)</span>
          </div>
          <p>© 2026 AI Meeting Assistant. Local Intelligence Architecture.</p>
        </div>
      </section>

    </div>
  );
}
