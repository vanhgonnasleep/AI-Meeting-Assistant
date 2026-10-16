import { useState } from 'react';
import LazyPanel from './LazyPanel.jsx';
import { 
  FileText, 
  Sparkles, 
  ListTodo, 
  Check, 
  Copy, 
  Download, 
  Printer, 
  FileCode, 
  Users, 
  Edit2, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Play, 
  Volume2, 
  Clock, 
  UploadCloud, 
  FileAudio, 
  X, 
  Zap, 
  Sliders, 
  Loader2, 
  Target,
  Columns,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { formatMeetingDuration } from './navigation.js';
import { normalizeCitation } from './session.js';
import { formatUploadLimits } from './upload.js';
import ConnectorsModal from './ConnectorsModal.jsx';
import { GitHubMark, GmailMark } from './BrandMarks.jsx';

const loadPresentationDeck = () => import('./PresentationDeck.jsx');

const SPEAKER_BADGE_STYLES = [
  'bg-blue-500/15 text-blue-700 border-blue-500/30',
  'bg-purple-500/15 text-purple-700 border-purple-500/30',
  'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'bg-pink-500/15 text-pink-700 border-pink-500/30',
  'bg-teal-500/15 text-teal-700 border-teal-500/30',
  'bg-orange-500/15 text-orange-700 border-orange-500/30',
  'bg-cyan-500/15 text-cyan-700 border-cyan-500/30',
];

const SPEAKER_AVATAR_STYLES = [
  'bg-blue-600 text-white shadow-blue-500/25',
  'bg-purple-600 text-white shadow-purple-500/25',
  'bg-emerald-600 text-white shadow-emerald-500/25',
  'bg-amber-600 text-white shadow-amber-500/25',
  'bg-pink-600 text-white shadow-pink-500/25',
  'bg-teal-600 text-white shadow-teal-500/25',
  'bg-orange-600 text-white shadow-orange-500/25',
  'bg-cyan-600 text-white shadow-cyan-500/25',
];

const getSpeakerBadgeStyle = (speaker) => {
  if (!speaker) return 'bg-slate-100 text-slate-700 border-slate-300';
  const s = String(speaker);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_BADGE_STYLES[hash % SPEAKER_BADGE_STYLES.length];
};

const getSpeakerAvatarStyle = (speaker) => {
  if (!speaker) return 'bg-slate-100 text-slate-700 border border-slate-300';
  const s = String(speaker);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_AVATAR_STYLES[hash % SPEAKER_AVATAR_STYLES.length];
};

const getSpeakerInitial = (speaker) => {
  if (!speaker) return '?';
  const parts = String(speaker).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

/**
 * Staff-level Document Workspace Component
 * 
 * UX Decisions:
 * 1. Document Editor Metaphor: Refined editorial layout (Linear / Notion / Apple Notes)
 *    rather than a noisy chat bubble feed.
 * 2. Strict 8pt Grid: Spacing adheres to 8px, 16px, 24px, 32px intervals.
 * 3. Contrast Hierarchy: Headers in crisp slate-100, body in slate-200, metadata in slate-400.
 * 4. Micro-interactions: Click-to-seek audio on every turn, citation, decision, and risk.
 * 5. Smooth Skeletal Shimmer: AI Processing state renders full document outline shimmer.
 */
export default function DocumentWorkspace({
  result,
  isProcessing,
  elapsedTime,
  file,
  audioUrl,
  audioRef,
  currentMeetingId,
  meetingTitle,
  isDemoResult,
  warnings = [],
  completedTasks = {},
  updatingTasks = {},
  onToggleTask,
  onSeekAudio,
  onCopyAll,
  isCopied,
  onCopySummary,
  summaryCopied,
  onDownloadMarkdown,
  onDownloadJson,
  onDownloadTxt,
  onSaveMeeting,
  isSavingMeeting,
  isContentSaving = false,
  canSaveMeeting = true,
  onShowEditor,
  onRenameSpeaker,
  onCycleSpeaker,
  selectedModel,
  setSelectedModel,
  spokenLanguage,
  setSpokenLanguage,
  enableMmr,
  setEnableMmr,
  mmrLambda,
  setMmrLambda,
  showAdvancedMmr,
  setShowAdvancedMmr,
  enableDiarization,
  setEnableDiarization,
  numSpeakers,
  setNumSpeakers,
  speakerFilter,
  setSpeakerFilter,
  transcriptView,
  setTranscriptView,
  mmrTelemetry,
  metaInfo,
  saveToLibrary,
  setSaveToLibrary,
  getRootProps,
  getInputProps,
  isDragActive,
  uploadError,
  uploadLimits,
  handleReset,
  handleDemoSample,
  onStopWaiting,
}) {
  const [activeDocTab, setActiveDocTab] = useState('doc'); // 'doc' | 'summary' | 'tasks' | 'insights' | 'transcript'
  const [viewMode, setViewMode] = useState('studio'); // 'studio' | 'split' | 'zen'
  const [showConnectorsModal, setShowConnectorsModal] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const handleSkipAudio = (seconds) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
    }
  };

  const handleTogglePlaybackSpeed = () => {
    if (audioRef?.current) {
      const speeds = [1.0, 1.25, 1.5, 2.0];
      const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length] || 1.0;
      audioRef.current.playbackRate = next;
      setPlaybackSpeed(next);
    }
  };

  const wordCount = result?.transcript ? result.transcript.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadTime = Math.ceil(wordCount / 200);
  const totalTasks = result?.action_items?.length || 0;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const completionPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // -------------------------------------------------------------
  // STATE 1: SKELETAL LOADING STATE (AI IS PROCESSING)
  // -------------------------------------------------------------
  if (isProcessing) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        {/* Processing Banner */}
        <div className="bg-white/80 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-8 shadow-glass flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <span className="absolute -inset-2 rounded-2xl bg-indigo-500/10 animate-ping opacity-60" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              Analyzing Recording with Local AI
            </h3>
            <p className="text-xs text-slate-600 max-w-md">
              Running multi-agent pipeline (Whisper STT, MMR Redundancy Filter, Llama 3 Summary & Task Extraction).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 font-mono text-[11px] text-indigo-700">
              <Clock className="w-3 h-3" /> Elapsed: {elapsedTime}s
            </span>
            <div className="flex items-center gap-1 h-3" aria-hidden="true">
              <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse" />
              <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse delay-100" />
              <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse delay-200" />
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onStopWaiting}
              className="text-xs text-slate-600 hover:text-slate-800 underline transition-colors"
            >
              Stop waiting
            </button>
          </div>
        </div>

        {/* Shimmer Skeleton Document Layout */}
        <div className="space-y-6 opacity-60 pointer-events-none select-none">
          <div className="space-y-2">
            <div className="h-7 w-72 bg-slate-100 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-48 bg-slate-100/60 rounded-lg skeleton-shimmer" />
          </div>

          <div className="p-6 rounded-3xl bg-white/40 border border-slate-200 space-y-3">
            <div className="h-4 w-36 bg-slate-100 rounded skeleton-shimmer" />
            <div className="h-3 w-full bg-slate-100/60 rounded skeleton-shimmer" />
            <div className="h-3 w-5/6 bg-slate-100/60 rounded skeleton-shimmer" />
            <div className="h-3 w-3/4 bg-slate-100/60 rounded skeleton-shimmer" />
          </div>

          <div className="p-6 rounded-3xl bg-white/40 border border-slate-200 space-y-3">
            <div className="h-4 w-44 bg-slate-100 rounded skeleton-shimmer" />
            <div className="h-10 w-full bg-slate-100/40 rounded-xl skeleton-shimmer" />
            <div className="h-10 w-full bg-slate-100/40 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 2: EMPTY STATE / UPLOAD HERO
  // -------------------------------------------------------------
  if (!result) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        {/* Page Heading */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Meeting Studio
          </h1>
          <p className="text-xs text-slate-600">
            Upload an audio or video recording to transcribe, summarize, and extract actionable deliverables.
          </p>
        </div>

        {/* Configuration Bar */}
        <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-white/60 backdrop-blur-xl border border-slate-200 text-xs">
          {/* Model Switcher */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-300/60 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            <select
              aria-label="Processing model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
            >
              <option value="auto" className="bg-white text-slate-800">🤖 Auto (Adaptive)</option>
              <option value="llama3" className="bg-white text-slate-800">🚀 Llama 3 (8B - GPU)</option>
              <option value="llama3.2:3b" className="bg-white text-slate-800">⚡ Llama 3.2 (3B - Fast CPU)</option>
              <option value="llama3.2:1b" className="bg-white text-slate-800">🪶 Llama 3.2 (1B - Light)</option>
              <option value="instant_demo" className="bg-white text-slate-800">🎯 Instant Demo (Zero Compute)</option>
            </select>
          </div>

          {/* Spoken Language */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-300/60 text-slate-700">
            Language:
            <select 
              value={spokenLanguage} 
              onChange={(e) => setSpokenLanguage(e.target.value)}
              className="bg-white text-slate-800 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="">Auto-detect</option>
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </label>

          {/* MMR Toggle */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setEnableMmr(!enableMmr)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl border text-xs font-medium transition-all ${
                enableMmr 
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-700'
                  : 'bg-slate-100/60 border-slate-300/50 text-slate-600'
              }`}
              title="Maximal Marginal Relevance (Redundancy Filter)"
            >
              <span>MMR Filter</span>
              <span className={`text-[10px] px-1 rounded font-mono font-bold ${enableMmr ? 'text-indigo-700' : 'text-slate-500'}`}>
                {enableMmr ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedMmr(!showAdvancedMmr)}
              aria-label="MMR lambda settings"
              className={`px-2 py-1.5 rounded-r-xl border border-l-0 text-xs transition-all ${
                showAdvancedMmr ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-100/80 border-slate-300/60 text-slate-600'
              }`}
              title="Configure λ hyperparameter"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Diarization Toggle */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setEnableDiarization(!enableDiarization)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${enableDiarization ? 'rounded-l-xl' : 'rounded-xl'} border text-xs font-medium transition-all ${
                enableDiarization 
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-700'
                  : 'bg-slate-100/60 border-slate-300/50 text-slate-600'
              }`}
              title="Speaker Diarization (Identify speakers)"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Diarize</span>
            </button>
            {enableDiarization && (
              <select
                value={numSpeakers}
                onChange={(e) => setNumSpeakers(e.target.value)}
                className="bg-slate-100 text-slate-700 border border-l-0 border-purple-500/50 rounded-r-xl px-2 py-1.5 text-xs focus:outline-none"
                title="Expected speaker count"
              >
                <option value="">Auto Spk</option>
                <option value="2">2 Spk</option>
                <option value="3">3 Spk</option>
                <option value="4">4 Spk</option>
              </select>
            )}
          </div>
        </div>

        {/* Advanced MMR Slider */}
        <div className="rounded-2xl border border-slate-200 bg-white/50 p-4 space-y-2">
          <label className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer">
            <input type="checkbox" checked={saveToLibrary ?? true}
              disabled={selectedModel === 'instant_demo' || isContentSaving}
              onChange={event => setSaveToLibrary(event.target.checked)} className="accent-indigo-500" />
            Save results to library
          </label>
          <p className="text-xs text-slate-600">
            {selectedModel === 'instant_demo' ? 'Demo results are not added to the meeting library.'
              : saveToLibrary ? 'Keep the transcript, notes and action items for later. The original recording is not stored.'
                : 'Session only. Save or export the results before reloading or starting another meeting.'}
          </p>
        </div>
        {uploadError && <p role="alert" className="text-sm text-rose-700">{uploadError}</p>}

        {showAdvancedMmr && (
          <div className="bg-white/90 border border-indigo-500/40 rounded-2xl p-4 shadow-panel backdrop-blur-md space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">MMR Hyperparameter Tuning: Relevance vs Diversity</span>
              <span className="font-mono text-indigo-700 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                λ = {mmrLambda.toFixed(2)}
              </span>
            </div>
            <input 
              type="range"
              aria-label="MMR relevance and diversity balance"
              min="0.10"
              max="0.90"
              step="0.05"
              value={mmrLambda}
              onChange={(e) => setMmrLambda(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-[11px] text-slate-600">
              Higher λ preserves sentences closest to the central theme; lower λ penalizes repetition and extracts broader conversational variety.
            </p>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div 
          {...getRootProps({ role: 'button', 'aria-label': 'Choose meeting audio or video file' })}
          className={`relative group rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden ${
            isDragActive 
              ? 'border-indigo-400 bg-indigo-50/20'
              : file 
                ? 'border-emerald-500/50 bg-white/60'
                : 'border-slate-200 hover:border-indigo-500/50 bg-white/40 hover:bg-white/60'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4 relative z-10">
            {file ? (
              <div className="flex flex-col items-center gap-3 w-full max-w-md">
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 rounded-2xl shadow-inner">
                  <FileAudio className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-slate-600 mt-1">Ready for analysis • {formatUploadLimits(uploadLimits)}</p>
                </div>

                {audioUrl && (
                  <div className="w-full pt-2" onClick={(e) => e.stopPropagation()}>
                    <audio ref={audioRef} controls src={audioUrl} className="w-full h-8 rounded-lg" />
                  </div>
                )}

                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="mt-1 flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-700 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 transition-colors"
                >
                  <X className="w-3 h-3" /> Change File
                </button>
              </div>
            ) : (
              <>
                <div className="p-5 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 border border-indigo-500/20 text-indigo-700 rounded-3xl shadow-inner group-hover:scale-105 transition-transform duration-300">
                  <UploadCloud className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Drag and drop your meeting audio or video here
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    or click anywhere to browse from your computer ({formatUploadLimits(uploadLimits)})
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {['.MP3', '.WAV', '.M4A', '.OGG', '.FLAC', '.MP4', '.WEBM'].map((ext) => (
                    <span key={ext} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300/60">
                      {ext}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sample Meeting Card */}
        <div className="p-4 rounded-2xl bg-white/40 border border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-700">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Want to test right away without an audio file?</p>
              <p className="text-[11px] text-slate-600">Load a pre-packaged Q3 product and budget review audio sample.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDemoSample}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-700 border border-indigo-500/40 font-semibold transition-all active:scale-95 cursor-pointer"
          >
            Load Sample Audio
          </button>
        </div>

      </div>
    );
  }

  // -------------------------------------------------------------
  // SECTION RENDERERS
  // -------------------------------------------------------------
  const renderSummarySection = () => (
    <article className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Executive Summary</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopySummary}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 transition-all active:scale-95"
            title="Copy summary"
          >
            {summaryCopied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
            <span>{summaryCopied ? 'Copied' : 'Copy'}</span>
          </button>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            {metaInfo?.model || 'Local Model'}
          </span>
        </div>
      </div>

      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
        {result?.summary}
      </div>
    </article>
  );

  const renderTasksSection = () => (
    <article className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700">
            <ListTodo className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Extracted Action Deliverables</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-600">{completedCount} of {totalTasks} completed</span>
          {currentMeetingId && (
            <span className="text-[10px] text-emerald-700 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              SQLite Synced
            </span>
          )}
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${completionPercent}%` }} 
          />
        </div>
      )}

      <ul className="space-y-2">
        {result?.action_items?.map((item, idx) => {
          const isDone = completedTasks[idx];
          const isUpdating = updatingTasks[idx];

          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => onToggleTask(idx)}
                disabled={isUpdating || isContentSaving}
                aria-pressed={Boolean(isDone)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-3 cursor-pointer group hover:translate-x-1 hover:shadow-md ${
                  isDone 
                    ? 'bg-emerald-50/20 border-emerald-500/30 text-slate-600'
                    : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-800'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150 ${
                  isDone 
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20' 
                    : 'border-slate-300 group-hover:border-indigo-400'
                }`}>
                  {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium leading-snug ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                    {typeof item === 'object' ? item.task : String(item)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                    <span className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 border border-indigo-500/30">
                      <Users className="w-2.5 h-2.5 text-indigo-700" />
                      {(typeof item === 'object' ? item.assignee : null) || 'Unassigned'}
                    </span>
                    {typeof item === 'object' && item.deadline && (
                      <span className="flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30">
                        <Clock className="w-2.5 h-2.5" /> Due: {item.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );

  const renderInsightsSection = () => (
    <article className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Key Decisions & Risk Matrix</h2>
            <p className="text-[10px] text-slate-600">3-pillar governance intelligence with click-to-seek audio evidence</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
          Agent 5 Governance
        </span>
      </div>

      <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'grid-cols-1' : 'md:grid-cols-3'} gap-4`}>
        {/* Pillar 1: Decisions */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Decisions</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 font-bold">
              {(result?.insights?.decisions || []).length}
            </span>
          </div>
          <div className="space-y-2">
            {(!result?.insights?.decisions || result.insights.decisions.length === 0) ? (
              <p className="text-xs text-slate-500 italic py-2">No key decisions extracted.</p>
            ) : (
              result.insights.decisions.map((dec, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/60 border border-slate-200/80 space-y-1.5 group">
                  <p className="text-xs text-slate-800 leading-snug">{dec.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
                    {dec.speaker && (
                      <span className={`px-1.5 py-0.2 rounded border ${getSpeakerBadgeStyle(dec.speaker)}`}>
                        {dec.speaker}
                      </span>
                    )}
                    {dec.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(dec).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(dec).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-700 border border-emerald-500/30 font-mono transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                        title={`Jump audio to ${dec.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-emerald-300" />
                        <span>{dec.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 2: Risks & Blockers */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Risks & Blockers</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 font-bold">
              {(result?.insights?.risks || []).length}
            </span>
          </div>
          <div className="space-y-2">
            {(!result?.insights?.risks || result.insights.risks.length === 0) ? (
              <p className="text-xs text-slate-500 italic py-2">No critical delivery risks detected.</p>
            ) : (
              result.insights.risks.map((risk, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/60 border border-slate-200/80 space-y-1.5 group">
                  <p className="text-xs text-slate-800 leading-snug">{risk.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
                    {risk.speaker && (
                      <span className={`px-1.5 py-0.2 rounded border ${getSpeakerBadgeStyle(risk.speaker)}`}>
                        {risk.speaker}
                      </span>
                    )}
                    {risk.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(risk).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(risk).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 border border-amber-500/30 font-mono transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                        title={`Jump audio to ${risk.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-amber-300" />
                        <span>{risk.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 3: Open Questions */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Open Questions</span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 font-bold">
              {(result?.insights?.open_questions || []).length}
            </span>
          </div>
          <div className="space-y-2">
            {(!result?.insights?.open_questions || result.insights.open_questions.length === 0) ? (
              <p className="text-xs text-slate-500 italic py-2">No open questions recorded.</p>
            ) : (
              result.insights.open_questions.map((q, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white/60 border border-slate-200/80 space-y-1.5 group">
                  <p className="text-xs text-slate-800 leading-snug">{q.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
                    {q.speaker && (
                      <span className={`px-1.5 py-0.2 rounded border ${getSpeakerBadgeStyle(q.speaker)}`}>
                        {q.speaker}
                      </span>
                    )}
                    {q.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(q).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(q).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-blue-500/15 hover:bg-blue-500/30 text-blue-700 border border-blue-500/30 font-mono transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                        title={`Jump audio to ${q.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-blue-300" />
                        <span>{q.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );

  const renderTranscriptSection = () => (
    <article className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-700">
            <FileText className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Attributed Dialogue Transcript</h2>
        </div>

        {/* View Sub-Toggle (Raw / Segments / MMR) */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-[11px]">
          <button
            type="button"
            onClick={() => setTranscriptView('raw')}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
              transcriptView === 'raw' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Text
          </button>
          {result?.segments && result.segments.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscriptView('segments')}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                transcriptView === 'segments' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Segments ({result.segments.length})
            </button>
          )}
          {result?.condensed_transcript && (
            <button
              type="button"
              onClick={() => setTranscriptView('mmr')}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                transcriptView === 'mmr' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MMR Filtered
            </button>
          )}
        </div>
      </div>

      {/* Speaker Filter Pills */}
      {transcriptView === 'segments' && result?.segments && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2 text-[11px]">
          <span className="text-slate-500 font-mono text-[10px] mr-1">Filter Speaker:</span>
          <button
            type="button"
            onClick={() => setSpeakerFilter('all')}
            className={`px-2.5 py-0.5 rounded-lg transition-all ${
              speakerFilter === 'all'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
            }`}
          >
            All
          </button>
          {Array.from(new Set(result.segments.map(s => s.speaker).filter(Boolean))).map((speaker) => {
            const isSelected = speakerFilter === speaker;
            return (
              <div key={speaker} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSpeakerFilter(speaker)}
                  className={`px-2.5 py-0.5 rounded-l-lg transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold border-indigo-500'
                      : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  {speaker}
                </button>
                <button
                  type="button"
                  onClick={() => onRenameSpeaker(speaker)}
                  disabled={isContentSaving}
                  title={`Rename speaker "${speaker}"`}
                  className={`px-1.5 py-0.5 rounded-r-lg border border-l-0 transition-all cursor-pointer ${
                    isSelected ? 'bg-indigo-700 border-indigo-500 text-white hover:text-indigo-100' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Transcript Dialogue Scroll Container */}
      <div className={`overflow-y-auto pr-1 space-y-2.5 scrollbar-thin ${viewMode === 'split' ? 'max-h-[700px]' : 'max-h-[500px]'}`}>
        {transcriptView === 'segments' && result?.segments && result.segments.length > 0 ? (
          result.segments
            .map((seg, originalIdx) => ({ seg, originalIdx }))
            .filter(({ seg }) => speakerFilter === 'all' || !seg.speaker || seg.speaker === speakerFilter)
            .map(({ seg, originalIdx }, displayIdx) => (
              <div 
                key={originalIdx} 
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/50 hover:bg-slate-50/80 border border-slate-200/80 hover:border-indigo-500/30 transition-all duration-200 group"
              >
                {/* Notta-style circular speaker avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-md ${getSpeakerAvatarStyle(seg.speaker)}`}>
                  {getSpeakerInitial(seg.speaker)}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 tracking-tight">{seg.speaker || 'Speaker'}</span>
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(seg).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(seg).seconds)}
                        className="inline-flex items-center gap-1 font-mono text-[10px] text-teal-700 hover:text-teal-700 px-1.5 py-0.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all cursor-pointer disabled:opacity-40"
                        title={`Seek audio to ${seg.timestamp}`}
                      >
                        <Play className="w-2.5 h-2.5 fill-teal-400" />
                        <span>{seg.timestamp || `Turn #${displayIdx + 1}`}</span>
                      </button>
                    </div>

                    {seg.speaker && (
                      <button
                        type="button"
                        onClick={() => onCycleSpeaker(originalIdx)}
                        disabled={isContentSaving}
                        title="Click to cycle speaker attribution"
                        className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer ${getSpeakerBadgeStyle(seg.speaker)}`}
                      >
                        <span>{seg.speaker}</span>
                        <span className="text-[9px] opacity-60">⇄</span>
                      </button>
                    )}
                  </div>

                  <p 
                    className="text-xs text-slate-800 leading-relaxed font-sans cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => {
                      const secs = normalizeCitation(seg).seconds;
                      if (audioUrl && secs !== null) onSeekAudio(secs);
                    }}
                  >
                    {seg.text}
                  </p>
                </div>
              </div>
            ))
        ) : transcriptView === 'mmr' && result?.condensed_transcript ? (
          <div className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap p-3 rounded-2xl bg-slate-50/60 border border-slate-200">
            {mmrTelemetry?.applied && <p className="mb-3 text-amber-700">Selected {mmrTelemetry.selected_sentences} of {mmrTelemetry.original_sentences} sentences; original transcript remains available.</p>}
            {result.condensed_transcript}
          </div>
        ) : (
          <div className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap p-3 rounded-2xl bg-slate-50/60 border border-slate-200">
            {result?.transcript}
          </div>
        )}
      </div>
    </article>
  );

  // -------------------------------------------------------------
  // STATE 3: DOCUMENT WORKSPACE (RESULTS LOADED)
  // -------------------------------------------------------------
  return (
    <div className={`space-y-6 ${viewMode === 'split' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto py-4 select-text transition-all duration-300`}>
      
      {/* Document Header & Metadata */}
      <header className="pb-6 border-b border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate" title={file?.name || meetingTitle}>
                {file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document')}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isDemoResult 
                  ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                  : result?.review_status === 'reviewed' 
                    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                    : 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30'
              }`}>
                {isDemoResult ? 'DEMO' : result?.review_status === 'reviewed' ? 'REVIEWED' : 'DRAFT'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono">
              <span className="flex items-center gap-1 text-slate-700">
                <Clock className="w-3.5 h-3.5 text-indigo-700" />
                {formatMeetingDuration(result?.duration)}
              </span>
              <span>•</span>
              <span>~{wordCount} words</span>
              <span>•</span>
              <span>~{estimatedReadTime} min read</span>
              <span>•</span>
              <span className="uppercase text-slate-600">
                {result?.language ? `Lang: ${result.language}` : 'Auto-detected'}
              </span>
              {currentMeetingId && (
                <>
                  <span>•</span>
                  <span className="text-slate-500">Record #{currentMeetingId}</span>
                </>
              )}
            </div>
          </div>

          {/* Document Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* View Mode Switcher Pills (Apple Dynamic Glass style) */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 border border-slate-300/60 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('studio')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  viewMode === 'studio'
                    ? 'bg-indigo-600/30 text-indigo-700 border border-indigo-500/40 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
                title="Studio Document Editor"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-700" />
                <span>Studio</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  viewMode === 'split'
                    ? 'bg-teal-600/30 text-teal-700 border border-teal-500/40 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
                title="2-Column Split Inspector"
              >
                <Columns className="w-3.5 h-3.5 text-teal-700" />
                <span>Split</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('zen')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  viewMode === 'zen'
                    ? 'bg-sky-600/30 text-sky-700 border border-sky-500/40 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
                title="Fullscreen Zen Slide Deck Presentation"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-700" />
                <span>Zen Deck</span>
              </button>
            </div>

            {/* Connect Hub Pill Button */}
            <button
              type="button"
              onClick={() => setShowConnectorsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-purple-500/20 hover:from-sky-500/30 hover:to-purple-500/30 border border-sky-500/40 text-sky-700 hover:text-slate-900 text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Preview a GitHub issue or Gmail draft"
            >
              <GitHubMark size={14} /><GmailMark size={16} />
              <span>GitHub & Gmail</span>
            </button>

            {!currentMeetingId && !isDemoResult && (
              <button
                type="button"
                onClick={onSaveMeeting}
                disabled={isContentSaving || !canSaveMeeting}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                {isSavingMeeting ? 'Saving…' : 'Save this meeting'}
              </button>
            )}

            {currentMeetingId && !isDemoResult && (
              <button
                type="button"
                onClick={onShowEditor}
                disabled={isContentSaving}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
              >
                Edit & Review
              </button>
            )}

            {/* Copy All */}
            <button
              type="button"
              onClick={onCopyAll}
              className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
              title="Copy full document text"
              aria-label="Copy full document text"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Export Markdown */}
            <button
              type="button"
              onClick={onDownloadMarkdown}
              className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
              title="Export as Markdown (.MD)"
              aria-label="Export Markdown file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Print / PDF */}
            <button type="button" onClick={onDownloadJson} aria-label="Export JSON file"
              className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 text-slate-700" title="Export JSON file">
              <FileCode className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onDownloadTxt} aria-label="Export text file"
              className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 text-slate-700" title="Export text file">
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 text-slate-700 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
              title="Print or Save as PDF"
              aria-label="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Demo / Warnings Banner */}
        {(isDemoResult || warnings.length > 0) && (
          <div role="status" className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs space-y-1">
            {isDemoResult && <p className="font-medium">Demo data — results are from the pre-packaged sample meeting.</p>}
            {warnings.map((w, idx) => <p key={idx}>{w}</p>)}
          </div>
        )}

        {/* Interactive Audio Sync Player */}
        {audioUrl && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-700 shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Audio Sync Player</p>
                <p className="text-[10px] text-slate-600">Click any dialogue or citation to jump audio position</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSkipAudio(-5)}
                className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-all flex items-center gap-1 text-[10px] font-mono cursor-pointer active:scale-95"
                title="Rewind 5 seconds"
              >
                <RotateCcw className="w-3 h-3" />
                <span>-5s</span>
              </button>

              <button
                type="button"
                onClick={() => handleSkipAudio(5)}
                className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-all flex items-center gap-1 text-[10px] font-mono cursor-pointer active:scale-95"
                title="Forward 5 seconds"
              >
                <RotateCw className="w-3 h-3" />
                <span>+5s</span>
              </button>

              <button
                type="button"
                onClick={handleTogglePlaybackSpeed}
                className="px-2.5 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-700 hover:text-slate-900 border border-indigo-500/40 text-[10px] font-mono font-semibold transition-all cursor-pointer active:scale-95"
                title="Cycle playback speed (1.0x, 1.25x, 1.5x, 2.0x)"
              >
                {playbackSpeed.toFixed(2).replace(/\.00$/, '.0')}x
              </button>
            </div>

            <div className="w-full sm:w-auto flex-1 max-w-sm">
              <audio ref={audioRef} src={audioUrl} controls className="w-full h-8 rounded-lg outline-none" />
            </div>
          </div>
        )}
      </header>
      {!isDemoResult && <p className="text-xs text-slate-600">
        {currentMeetingId ? 'Saved to library' : 'Session only — save or export before reloading or starting another meeting.'}
      </p>}

      {/* VIEW MODE 1: STUDIO (STANDARD EDITOR) */}
      {viewMode === 'studio' && (
        <div className="space-y-6">
          {/* Document View Switcher Tabs */}
          <nav aria-label="Document sections" className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/70 border border-slate-200 text-xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveDocTab('doc')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeDocTab === 'doc' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Document
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('summary')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeDocTab === 'summary' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('tasks')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                activeDocTab === 'tasks' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Action Items</span>
              {totalTasks > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                  {completedCount}/{totalTasks}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('insights')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeDocTab === 'insights' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Decisions & Risks
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('transcript')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeDocTab === 'transcript' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transcript
            </button>
          </nav>

          {(activeDocTab === 'doc' || activeDocTab === 'summary') && renderSummarySection()}
          {(activeDocTab === 'doc' || activeDocTab === 'tasks') && renderTasksSection()}
          {(activeDocTab === 'doc' || activeDocTab === 'insights') && renderInsightsSection()}
          {(activeDocTab === 'doc' || activeDocTab === 'transcript') && renderTranscriptSection()}
        </div>
      )}

      {/* VIEW MODE 2: SPLIT INSPECTOR (NOTTA-STYLE 2-COLUMN PRODUCTIVITY) */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            {renderTranscriptSection()}
          </div>
          <div className="lg:col-span-5 space-y-6">
            {renderSummarySection()}
            {renderTasksSection()}
            {renderInsightsSection()}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: ZEN SLIDE DECK PRESENTATION (FULLSCREEN OVERLAY) */}
      {viewMode === 'zen' && (
        <LazyPanel load={loadPresentationDeck} name="the presentation" onClose={() => setViewMode('studio')} errorClassName="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4 p-6" fallback={<div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
          <p role="status" className="text-sm text-slate-600">Loading presentation…</p>
          <button type="button" onClick={() => setViewMode('studio')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">Close presentation</button>
        </div>}>
        {PresentationDeck => <PresentationDeck
          meetingData={{
            title: file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document'),
            date: metaInfo?.hardware ? metaInfo.hardware.split('•')[1]?.trim() : new Date().toISOString().split('T')[0],
            duration: formatMeetingDuration(result?.duration),
            summary: result?.summary,
            keyDecisions: result?.insights?.decisions?.map(d => typeof d === 'object' ? d.text : d) || result?.key_decisions || [],
            risks: result?.insights?.risks?.map(r => typeof r === 'object' ? r.text : r) || result?.risks || [],
            attendees: Array.from(new Set((result?.segments || []).map(s => s.speaker).filter(Boolean)))
          }}
          actionItems={result?.action_items?.map(item => typeof item === 'object' ? { text: item.task, assignee: item.assignee, due: item.deadline } : item) || []}
          completedTasks={new Set(Object.entries(completedTasks).filter(([, v]) => Boolean(v)).map(([k]) => { const n = Number(k); return Number.isFinite(n) ? n : k; }))}
          onToggleTask={onToggleTask}
          onExit={() => setViewMode('studio')}
        />}
        </LazyPanel>
      )}

      {/* Connectors Hub Modal Sheet */}
      <ConnectorsModal
        isOpen={showConnectorsModal}
        onClose={() => setShowConnectorsModal(false)}
        meetingData={{
          id: currentMeetingId,
          meetingId: currentMeetingId,
          title: file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document'),
          date: new Date().toISOString().split('T')[0],
          summary: result?.summary,
          keyDecisions: result?.insights?.decisions?.map(d => typeof d === 'object' ? d.text : d) || result?.key_decisions || [],
          risks: result?.insights?.risks?.map(r => typeof r === 'object' ? r.text : r) || result?.risks || [],
          attendees: Array.from(new Set((result?.segments || []).map(s => s.speaker).filter(Boolean)))
        }}
        actionItems={result?.action_items?.map(item => typeof item === 'object' ? { text: item.task, assignee: item.assignee, due: item.deadline } : item) || []}
        completedTasks={new Set(Object.entries(completedTasks).filter(([, v]) => Boolean(v)).map(([k]) => { const n = Number(k); return Number.isFinite(n) ? n : k; }))}
      />

      {/* Editorial Footer Note */}
      <footer className="pt-6 border-t border-slate-200/60 text-xs text-slate-500 text-center">
        Review generated notes and decisions against the source transcript before distribution.
      </footer>

    </div>
  );
}
