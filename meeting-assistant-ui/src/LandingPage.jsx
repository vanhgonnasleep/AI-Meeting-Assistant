import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  LayoutDashboard, 
  Radio, 
  ListTodo, 
  Send, 
  Video, 
  FileAudio
} from 'lucide-react';
import { detectMeetingPlatform, getPlatformDetails, validateMeetingUrl, formatBotJoinConfirmation } from './notta-bot-utils.js';

/**
 * Animated soundwave equalizer bars (refined, subtle)
 */
function SoundwaveEqualizer({ active = true }) {
  return (
    <div className="flex items-center gap-1 h-5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20" aria-hidden="true">
      <span className={`w-0.5 rounded-full bg-indigo-400 ${active ? 'animate-pulse' : 'h-2'}`} style={{ height: active ? '13px' : '5px' }} />
      <span className={`w-0.5 rounded-full bg-cyan-300 ${active ? 'animate-pulse' : 'h-3'}`} style={{ height: active ? '17px' : '9px', animationDelay: '150ms' }} />
      <span className={`w-0.5 rounded-full bg-violet-400 ${active ? 'animate-pulse' : 'h-1.5'}`} style={{ height: active ? '11px' : '7px', animationDelay: '300ms' }} />
      <span className={`w-0.5 rounded-full bg-emerald-400 ${active ? 'animate-pulse' : 'h-2.5'}`} style={{ height: active ? '15px' : '4px', animationDelay: '75ms' }} />
    </div>
  );
}

/**
 * Three Natural Workflow Steps (Human, grounded framing)
 */
const WORKFLOW_STEPS = [
  {
    id: 'capture',
    num: '01',
    tabTitle: 'Capture',
    tagline: 'Drag audio or paste a link',
    description: 'Connect directly to live calls on Google Meet, Zoom, Teams, or Webex. Or drop your existing recording files (MP3, WAV, M4A, MP4) straight into the studio.',
    color: 'from-blue-500 to-indigo-600',
    accentText: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    points: [
      'Automatic detection for Google Meet, Zoom, Teams, and Webex URLs',
      'Direct drag-and-drop file ingestion up to 256 MiB',
      'Instant audio playback with click-to-seek waveform timeline'
    ]
  },
  {
    id: 'attribute',
    num: '02',
    tabTitle: 'Attribute',
    tagline: 'Know who said what',
    description: 'Clarion clusters speaker voiceprints with sub-word precision. Spoken dialogue in Vietnamese and English is transcribed accurately, complete with click-to-verify audio citations.',
    color: 'from-emerald-500 to-teal-600',
    accentText: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    points: [
      'Multi-speaker voiceprint attribution with 1-click name re-tagging',
      'Bilingual technical transcription (Vietnamese & English)',
      'Grounded transcript chat with direct timestamp citations [02:28]'
    ]
  },
  {
    id: 'dispatch',
    num: '03',
    tabTitle: 'Dispatch',
    tagline: 'Send notes straight to GitHub & Gmail',
    description: 'Transform spoken agreements into trackable outcomes. Pre-filled GitHub issues and executive email minutes open directly in your browser with zero API tokens stored.',
    color: 'from-violet-500 to-purple-600',
    accentText: 'text-violet-400',
    borderClass: 'border-purple-500/30',
    points: [
      'Automated extraction of decisions, blockers, and assigned deliverables',
      'Client-side RFC 3986 deep links: open GitHub issues with 1 click',
      'Clean executive brief formatting ready for Gmail composition'
    ]
  }
];

/**
 * Clarion Landing Page
 * Handcrafted, natural, human design (De-AI-ified):
 * - Clean brand identity (Clarion)
 * - Restrained obsidian aesthetic with sharp 1px borders
 * - Realistic engineering team dialogue
 * - Grounded, confident copywriting
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
    const confirmation = formatBotJoinConfirmation({ 
      url: meetingUrl,
      botName: 'Clarion Bot'
    });
    setDispatchStatus(confirmation);
  };

  const activeStep = WORKFLOW_STEPS[activeStepIdx];

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Subtle Tactile Mesh & Soft Ambient Spotlights */}
      <div 
        className="absolute inset-0 pointer-events-none -z-10 opacity-40" 
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute -top-32 left-1/3 w-[38rem] h-[26rem] rounded-full bg-indigo-600/12 blur-[120px]" />
        <div className="absolute top-[40%] -right-24 w-[32rem] h-[28rem] rounded-full bg-cyan-600/10 blur-[130px]" />
      </div>

      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-[#080c14]/85 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">Clarion</span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300">
              On-Device
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Dashboard</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onLaunchApp}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </header>

      {/* 2. HERO: HUMAN COPYWRITING + DIRECT CAPTURE & REALISTIC MOCKUP */}
      <section className="relative pt-14 pb-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-8">
        
        {/* Headline */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px]">Private speech engine • No third-party cloud</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Meeting notes that <br />
            <span className="bg-gradient-to-r from-white via-indigo-200 to-cyan-300 bg-clip-text text-transparent">
              actually make sense.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-normal leading-relaxed">
            Clarion records your calls, knows who said what, and turns commitments into clean action items — all executed locally on your machine.
          </p>
        </div>

        {/* Central Card: Quick Link Paste + Realistic Call Simulation */}
        <div className="rounded-2xl bg-[#0e1422]/90 backdrop-blur-2xl border border-white/[0.1] shadow-2xl p-5 sm:p-7 space-y-5 transition-all relative overflow-hidden">
          
          {/* Quick Capture Input */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-tight font-mono flex items-center gap-2">
                <Video className="w-3.5 h-3.5 text-indigo-400" />
                <span>Paste a meeting link or drop audio</span>
              </span>

              {platformInfo && (
                <span className={`px-2.5 py-0.5 rounded-full border ${platformInfo.badgeClass} font-mono text-[10px] font-semibold flex items-center gap-1`}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{platformInfo.label} recognized</span>
                </span>
              )}
            </div>

            <form onSubmit={handleQuickJoin} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs text-white placeholder-slate-500 font-mono transition-all"
              />

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!isValidUrl}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Connect Bot</span>
                </button>

                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <FileAudio className="w-3.5 h-3.5 text-slate-400" />
                  <span>Choose File</span>
                </button>
              </div>
            </form>

            {dispatchStatus && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-center justify-between"
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

          {/* Realistic Meeting Preview Stage */}
          <div className="pt-3 border-t border-white/[0.08] space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-200">Staging Latency & Reconnect Bug Sync</span>
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">(3 attendees)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <SoundwaveEqualizer active={true} />
                <span className="text-[10px] text-emerald-400 font-mono font-medium">Recording</span>
              </div>
            </div>

            {/* 3 Participant Avatars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-black/40 border border-indigo-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                  AR
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Alex Rivera</p>
                  <p className="text-[10px] text-indigo-300 font-mono">Product</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/30 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-xs text-emerald-300">
                  SC
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Sarah Chen</p>
                  <p className="text-[10px] text-emerald-300 font-mono">Speech AI</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                  MV
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Marcus Vance</p>
                  <p className="text-[10px] text-slate-400 font-mono">Infrastructure</p>
                </div>
              </div>
            </div>

            {/* Realistic Grounded Dialogue */}
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.08] space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono text-[10px] font-semibold shrink-0">
                  Alex [02:15]
                </span>
                <p className="text-slate-300 leading-snug">
                  "The latency dropped to 180ms on the staging cluster, but Safari still drops the WebSocket on tab backgrounding."
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold shrink-0">
                  Sarah [02:28]
                </span>
                <p className="text-slate-300 leading-snug">
                  "I saw that. It's the keep-alive ping interval. I'll push a 15-second heartbeat fix this afternoon."
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-semibold shrink-0">
                  Marcus [02:41]
                </span>
                <p className="text-slate-300 leading-snug">
                  "Great. I'll verify the staging deploy once Sarah's PR merges."
                </p>
              </div>
            </div>

            {/* Live Extracted Action Item Chip */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="font-semibold text-amber-200">Extracted Action Item:</span>
                <span className="text-slate-300">Push 15s WebSocket heartbeat fix</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-amber-300 font-medium">Assignee: Sarah</span>
                <span className="text-slate-500">• Due Today</span>
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* 3. WORKFLOW: 3 STEPS IN REFINED SEGMENTED CONTROLS */}
      <section className="py-12 px-4 sm:px-8 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            How Clarion Works
          </h2>
          <p className="text-xs text-slate-400">
            A cohesive three-part loop from audio to executed tasks.
          </p>
        </div>

        {/* Refined Segmented Control Tabs */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/10 gap-1">
            {WORKFLOW_STEPS.map((s, idx) => {
              const isActive = activeStepIdx === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStepIdx(idx)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-75">{s.num}</span>
                  <span>{s.tabTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Step Panel */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#0e1422]/70 border border-white/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-6 space-y-3">
                <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${activeStep.accentText}`}>
                  Step {activeStep.num} • {activeStep.tagline}
                </span>
                <h3 className="text-xl font-bold text-white">
                  {activeStep.tagline}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  {activeStep.description}
                </p>

                <ul className="space-y-2 pt-2 text-xs text-slate-300">
                  {activeStep.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mock Visual on the Right */}
              <div className="lg:col-span-6 p-4 rounded-xl bg-black/50 border border-white/[0.08] space-y-3">
                {activeStep.id === 'capture' && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span className="text-cyan-300">Audio Track (01:43:58)</span>
                      <span>FPS: 60 • Lossless</span>
                    </div>
                    <div className="h-12 rounded-lg bg-slate-900 border border-white/[0.08] flex items-center px-3 gap-1 overflow-hidden">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-1 rounded-full ${i < 16 ? 'bg-cyan-400' : 'bg-slate-700'}`}
                          style={{ height: `${(i % 5 + 2) * 5}px` }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">Scrub anywhere to listen and verify spoken words.</p>
                  </div>
                )}

                {activeStep.id === 'attribute' && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                      <span className="text-emerald-300">Grounded Transcript Q&A</span>
                      <span>EmbeddingGemma</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/20 text-xs">
                      <p className="text-slate-400 text-[11px] font-mono">Q: "When will the heartbeat fix ship?"</p>
                      <p className="text-slate-100 mt-1">
                        "Sarah Chen committed to pushing the 15-second heartbeat fix this afternoon (see <span className="text-emerald-400 underline font-mono">[02:28]</span>)."
                      </p>
                    </div>
                  </div>
                )}

                {activeStep.id === 'dispatch' && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                      <span>Ecosystem Connectors</span>
                      <span className="text-violet-300">Zero-Token RFC 3986</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-slate-900 border border-white/10 space-y-1">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <ListTodo className="w-3.5 h-3.5 text-violet-400" />
                          <span>GitHub Issues</span>
                        </span>
                        <p className="text-[10px] text-slate-400">Pre-populates title, body & citation.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-white/10 space-y-1">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Gmail Minutes</span>
                        </span>
                        <p className="text-[10px] text-slate-400">Executive brief ready to email attendees.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 4. ON-DEVICE VS CLOUD COMPARISON */}
      <section className="py-12 px-4 sm:px-8 max-w-4xl mx-auto space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Why On-Device Matters
          </h2>
          <p className="text-xs text-slate-400">
            Real privacy is keeping raw audio within your security perimeter.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Clarion On-Device */}
          <div className="p-5 rounded-2xl bg-[#0e1422]/90 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Clarion (On-Device)</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[10px]">
                Local Hardware
              </span>
            </div>

            <ul className="space-y-2 text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Audio & transcripts never leave your machine</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Runs on local GPU / Apple Silicon / CPU</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Unlimited recordings, zero monthly subscriptions</span>
              </li>
            </ul>
          </div>

          {/* Cloud Recorders */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Cloud Meeting Bots</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 font-mono text-[10px]">
                External SaaS
              </span>
            </div>

            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <span className="text-slate-500">✕</span>
                <span>Audio uploaded to third-party vendor servers</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-slate-500">✕</span>
                <span>Per-seat monthly plans with minute caps</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-slate-500">✕</span>
                <span>Corporate NDA and compliance exposure</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. CLEAN LAUNCH CTA */}
      <section className="py-16 px-4 sm:px-8 max-w-4xl mx-auto text-center space-y-5">
        <div className="p-8 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-[#0e1422] border border-white/10 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Start Your Next Meeting with Clarion.
          </h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Open the workspace to paste a meeting link or drop a recording file. No account or setup required.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onLaunchApp}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Open Studio Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>

            <button
              type="button"
              onClick={onOpenDashboard}
              className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all cursor-pointer"
            >
              <span>View Past Meetings</span>
            </button>
          </div>
        </div>

        <div className="pt-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/[0.06]">
          <span className="font-mono text-[11px]">Clarion • On-Device Meeting Intelligence</span>
          <span>© 2026 Clarion Architecture</span>
        </div>
      </section>

    </div>
  );
}
