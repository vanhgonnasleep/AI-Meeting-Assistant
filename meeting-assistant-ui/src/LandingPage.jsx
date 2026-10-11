import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Layers, 
  LayoutDashboard, 
  Lock, 
  Server, 
  Globe2, 
  ChevronDown, 
  Radio, 
  Sliders
} from 'lucide-react';
import NottaBotCard from './NottaBotCard.jsx';
import FeatureShowcase from './FeatureShowcase.jsx';

/**
 * Animated soundwave equalizer bars
 */
function EqualizerPulse() {
  return (
    <div className="flex items-center gap-1 h-4 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20" aria-hidden="true">
      <span className="w-0.5 h-3 rounded-full bg-indigo-400 animate-pulse" />
      <span className="w-0.5 h-4 rounded-full bg-indigo-300 animate-pulse" style={{ animationDelay: '120ms' }} />
      <span className="w-0.5 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: '240ms' }} />
      <span className="w-0.5 h-3.5 rounded-full bg-indigo-200 animate-pulse" style={{ animationDelay: '60ms' }} />
    </div>
  );
}

/**
 * FAQ Accordion Item
 */
function FaqItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border border-slate-800/80 rounded-2xl bg-slate-900/30 backdrop-blur-md overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white hover:text-indigo-300 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-4 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * LandingPage Component (Outside Presentation Layer)
 * 
 * Provides an executive product tour, live feature slide deck, interactive
 * platform bot joiner, privacy comparisons, and a seamless launch CTA
 * into the inner workspace (Studio / Overview).
 */
export default function LandingPage({
  onLaunchApp,
  onOpenDashboard
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const FAQS = [
    {
      q: 'Does any audio or transcript data leave my computer?',
      a: 'Zero. All speech recognition (Whisper), speaker diarization (voiceprint clustering), and summary generation (Ollama / Gemma) run 100% locally on your machine. No cloud telemetry or third-party servers are involved.'
    },
    {
      q: 'Which video conferencing platforms are supported?',
      a: 'The system natively ingests links from Google Meet, Zoom, Microsoft Teams, Cisco Webex, and YouTube. You can also drag and drop raw recorded files (MP3, WAV, FLAC, M4A, MP4, MKV) directly into the Studio Workspace.'
    },
    {
      q: 'How does speaker diarization work?',
      a: 'Our audio pipeline extracts acoustic voiceprint embeddings across time slices, clustering segments by unique speaker timbre. You can easily re-attribute names or correct speaker tags in the Studio Document Editor.'
    },
    {
      q: 'How are GitHub Issues and Gmail minutes dispatched without API keys?',
      a: 'We leverage RFC 3986 compliant browser-level URI protocols. Clicking dispatch opens your authenticated GitHub new-issue tab or Gmail composer with the structured agenda, decisions, and action items pre-filled, requiring zero API tokens.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      
      {/* Ambient Liquid Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[46rem] h-[30rem] rounded-full bg-indigo-600/15 blur-[140px] animate-pulse" style={{ animationDuration: '9s' }} />
        <div className="absolute top-[35%] -right-40 w-[36rem] h-[36rem] rounded-full bg-purple-600/10 blur-[150px] animate-pulse" style={{ animationDuration: '11s' }} />
        <div className="absolute top-[70%] -left-32 w-[34rem] h-[30rem] rounded-full bg-cyan-500/10 blur-[130px] animate-pulse" style={{ animationDuration: '13s' }} />
      </div>

      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">AI Meeting Assistant</span>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-[10px] font-mono text-indigo-300">
              Local Engine
            </span>
          </div>
        </div>

        {/* Center Nav Anchors */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-medium">
          <button 
            type="button" 
            onClick={() => scrollToSection('features')} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            Features
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection('bot-joiner')} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            Meeting Joiner
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection('tour-deck')} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            Product Tour
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection('privacy')} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            Security & Privacy
          </button>
          <button 
            type="button" 
            onClick={() => scrollToSection('faq')} 
            className="hover:text-white transition-colors cursor-pointer"
          >
            FAQ
          </button>
        </nav>

        {/* Right Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Dashboard</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onLaunchApp}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-16 pb-20 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-8">
        
        {/* Top Floating Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-indigo-300 text-xs font-medium shadow-lg shadow-indigo-500/5 backdrop-blur-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-[11px]">Private On-Device Intelligence • Zero Cloud Storage</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Turn Every Discussion Into <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              Decisive Action Items.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Automatic speaker diarization, real-time waveform sync, executive summaries, and one-click GitHub & Gmail dispatch — running 100% on your own hardware.
          </p>
        </div>

        {/* Dual Primary CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onLaunchApp}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Launch Studio Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <button
            type="button"
            onClick={() => scrollToSection('tour-deck')}
            className="px-5 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/70 text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Explore Feature Tour</span>
          </button>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="px-5 py-3 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800 text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <span>Past Recordings</span>
          </button>
        </div>

        {/* Interactive Mock Video Call Stage */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="relative rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl p-4 sm:p-6 overflow-hidden">
            {/* Top Bar of Virtual Meeting */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                <div className="text-left">
                  <h2 className="text-xs font-bold text-white tracking-tight">Q4 Product & Engineering Architecture Sync</h2>
                  <p className="text-[10px] text-slate-400 font-mono">Channel: Google Meet (ID: meet.google.com/abc-defg-hij)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <EqualizerPulse />
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-semibold flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-spin" />
                  Recording & Attributing
                </span>
              </div>
            </div>

            {/* Video Tile Grid Simulation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[9px] font-bold">
                    SPEAKER A
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Alex Rivera</p>
                  <p className="text-[10px] text-slate-400">Product Lead</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold">
                    SPEAKER B
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Dr. Sarah Chen</p>
                  <p className="text-[10px] text-slate-400">AI Speech Researcher</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold">
                    SPEAKER C
                  </span>
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Marcus Vance</p>
                  <p className="text-[10px] text-slate-400">Staff Infrastructure</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
              </div>
            </div>

            {/* Live Attributed Transcript Feed Simulation */}
            <div className="space-y-2 text-left bg-slate-950/50 p-4 rounded-2xl border border-slate-800/70">
              <div className="flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] shrink-0 font-semibold">
                  Alex [00:14]
                </span>
                <p className="text-xs text-slate-300">
                  "Let's finalize the Whisper pipeline cutover for Tuesday. Sarah, can you benchmark memory limits?"
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] shrink-0 font-semibold">
                  Sarah [00:22]
                </span>
                <p className="text-xs text-slate-300">
                  "Already tested on RTX 4080: 1.2 GiB VRAM footprint, 12x real-time speedup with FP16 weights."
                </p>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* 3. SECTION: AUTOMATED PLATFORM CAPTURE & MEETING JOINER */}
      <section id="bot-joiner" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Radio className="w-3.5 h-3.5" />
            <span>Universal Meeting URL Ingestion</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connect to Any Platform in Seconds
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Paste meeting links from Google Meet, Zoom, Microsoft Teams, or Webex. The bot confirms meeting credentials and handles the audio feed automatically.
          </p>
        </div>

        {/* Embedded Interactive Bot Card */}
        <div className="pt-2">
          <NottaBotCard disabled={false} />
        </div>
      </section>

      {/* 4. SECTION: INTERACTIVE GUIDED FEATURE TOUR DECK */}
      <section id="tour-deck" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Operational Walkthrough</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explore the 4-Stage Intelligence Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Click through each operational phase below to test the interactive mock audio scrubber, speaker attribution chips, and workflow connectors.
          </p>
        </div>

        {/* Embedded Feature Showcase Deck */}
        <div className="pt-2">
          <FeatureShowcase onExploreDemo={onLaunchApp} />
        </div>
      </section>

      {/* 5. SECTION: ON-DEVICE PRIVACY GUARANTEE VS CLOUD SAAS */}
      <section id="privacy" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hardware-Accelerated Data Sovereignty</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Why Local AI Beats Cloud Meeting Recorders
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Corporate strategy discussions belong inside your security perimeter, not on remote third-party SaaS servers.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Column 1: On-Device Assistant (Our Stack) */}
          <div className="p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-emerald-500/30 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl pointer-events-none rounded-tr-3xl" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">This Assistant (On-Device)</h3>
                  <p className="text-[10px] text-emerald-400 font-mono font-medium">100% Private Workstation Stack</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold">
                Zero Leaks
              </span>
            </div>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Zero Cloud Transmission:</strong> Audio, transcripts, and embeddings stay strictly in your local SQLite and memory space.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>No Recurring Per-User Seats:</strong> Run unlimited minutes powered by local GPUs (RTX 4080 / Apple Silicon / CPU).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>RFC 3986 Direct Deep Links:</strong> One-click push to GitHub Issues and Gmail without storing third-party API secret tokens.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Full Air-Gapped Readiness:</strong> Works without an internet connection for secure engineering environments.</span>
              </li>
            </ul>
          </div>

          {/* Column 2: Traditional Cloud SaaS Recorders */}
          <div className="p-6 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-md space-y-5">
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

            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Voice recordings piped across public internet to external vendor data centers.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Expensive monthly tier limits with minute quotas and per-seat licensing.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Requires storing sensitive OAuth tokens and cloud permissions on external servers.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <span>Potential NDA and enterprise privacy compliance audit liabilities.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* 6. SECTION: KEY FEATURES GRID */}
      <section id="features" className="py-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Engineered for Executive Speed
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A specialized toolkit combining speech science with linear software craftsmanship.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Sub-Word Diarization</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clusters voices with high temporal precision, maintaining accurate attribution even when speakers interrupt or debate.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-purple-500/40 transition-all space-y-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Globe2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Bilingual Excellence</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seamlessly transcribes and analyzes both Vietnamese and English technical conversations with domain-specific terminology.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-cyan-500/40 transition-all space-y-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Zen Presentation Deck</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Transform raw meeting transcripts into a full-screen, arrow-navigable executive slide deck in one click for team standups.
            </p>
          </div>
        </div>
      </section>

      {/* 7. SECTION: TECHNICAL FAQ */}
      <section id="faq" className="py-16 px-4 sm:px-8 max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Everything you need to know about security, architecture, and platform compatibility.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {FAQS.map((faq, index) => (
            <FaqItem
              key={faq.q}
              question={faq.q}
              answer={faq.a}
              isOpen={openFaqIndex === index}
              onToggle={() => setOpenFaqIndex(openFaqIndex === index ? -1 : index)}
            />
          ))}
        </div>
      </section>

      {/* 8. FOOTER CALL-TO-ACTION */}
      <section className="py-20 px-4 sm:px-8 max-w-5xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-indigo-950/40 via-slate-900/70 to-slate-950 border border-indigo-500/30 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-32 bg-indigo-500/15 blur-3xl pointer-events-none" />

          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Upgrade Your Meetings?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Launch the workspace now to paste your first meeting link or upload an audio file. No signup or cloud credentials needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onLaunchApp}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
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

        {/* Bottom Credits */}
        <div className="pt-12 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 mt-12">
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
