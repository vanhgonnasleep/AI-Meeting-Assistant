import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowUpRight, 
  AudioLines, 
  FolderOpen, 
  ListTodo, 
  Plus, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  LayoutGrid,
  List,
  Activity
} from 'lucide-react';
import { appPageHref } from './navigation.js';
import { MeetingRow } from './MeetingLibrary.jsx';
import { createRequestGate } from './session.js';
import { 
  calculateCompletionRate, 
  formatMeetingPreview, 
  getCarouselScrollOffset 
} from './overview-utils.js';

/**
 * Ambient Liquid Aurora Glow Background
 * Creates deep organic light blooms behind frosted glass panels
 */
function AuroraGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      <div 
        className="absolute -top-32 -left-20 w-[28rem] h-[28rem] rounded-full bg-indigo-600/15 blur-[120px] animate-pulse" 
        style={{ animationDuration: '8s' }} 
      />
      <div 
        className="absolute top-1/4 -right-24 w-[30rem] h-[30rem] rounded-full bg-purple-600/12 blur-[130px] animate-pulse" 
        style={{ animationDuration: '10s' }} 
      />
      <div 
        className="absolute bottom-10 left-1/4 w-[32rem] h-[24rem] rounded-full bg-cyan-500/10 blur-[140px] animate-pulse" 
        style={{ animationDuration: '12s' }} 
      />
    </div>
  );
}

/**
 * Animated soundwave equalizer bars for the Hero banner
 */
function SoundwaveAura({ active = true }) {
  return (
    <div className="flex items-center gap-1 h-5 px-2 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 shadow-inner" aria-hidden="true">
      <span className={`w-1 rounded-full bg-indigo-400 ${active ? 'animate-pulse' : 'h-2'}`} style={{ height: active ? '13px' : '6px' }} />
      <span className={`w-1 rounded-full bg-indigo-300 ${active ? 'animate-pulse' : 'h-3'}`} style={{ height: active ? '18px' : '10px', animationDelay: '150ms' }} />
      <span className={`w-1 rounded-full bg-indigo-400 ${active ? 'animate-pulse' : 'h-1.5'}`} style={{ height: active ? '11px' : '8px', animationDelay: '300ms' }} />
      <span className={`w-1 rounded-full bg-indigo-200 ${active ? 'animate-pulse' : 'h-2.5'}`} style={{ height: active ? '16px' : '4px', animationDelay: '75ms' }} />
    </div>
  );
}

/**
 * Interactive Recent Meeting Card for Swipe Carousel
 */
function RecentMeetingCard({ meeting, onOpen, disabled }) {
  const preview = formatMeetingPreview(meeting);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="snap-start min-w-[280px] sm:min-w-[310px] max-w-[320px] flex-shrink-0"
    >
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        disabled={disabled}
        aria-label={`Open meeting ${preview.title}`}
        className="w-full h-full p-5 rounded-3xl bg-slate-900/50 hover:bg-slate-900/80 backdrop-blur-2xl border border-white/10 hover:border-indigo-500/50 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between group cursor-pointer text-left relative overflow-hidden"
      >
        {/* Subtle glass gradient corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 via-transparent to-transparent pointer-events-none rounded-tr-3xl" />

        {/* Card Header: Date & Duration Badges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="font-mono text-slate-400">{preview.dateText}</span>
            <div className="flex items-center gap-1.5">
              {preview.language && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono text-[9px] font-bold uppercase tracking-wider">
                  {preview.language}
                </span>
              )}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 font-mono text-[10px] text-slate-300">
                <Clock className="w-3 h-3 text-slate-400" />
                {preview.durationText}
              </span>
            </div>
          </div>

          {/* Title & Summary */}
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition-colors line-clamp-1 tracking-tight">
              {preview.title}
            </h3>
            <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed font-normal">
              {preview.summary}
            </p>
          </div>
        </div>

        {/* Card Footer: Audio Indicator, Tasks, Action Pill */}
        <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <AudioLines className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-mono text-slate-400 font-medium">
              {preview.taskCount} tasks
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all">
            <span>Open</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}

/**
 * Modernized Overview Dashboard with Apple Dynamic Glass & Swipe Carousel
 */
export default function Overview({ apiBase, refreshKey, onOpen, canOpen, onNewMeeting, processing }) {
  const [data, setData] = useState({ meetings: [], analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [viewMode, setViewMode] = useState('carousel'); // 'carousel' | 'list'
  
  const gate = useRef(createRequestGate());
  const carouselRef = useRef(null);

  useEffect(() => {
    const currentGate = gate.current;
    const request = currentGate.begin();
    const load = async () => {
      try {
        const [records, stats] = await Promise.all([
          fetch(`${apiBase}/api/meetings?limit=8&offset=0&compact=true`, { signal: request.signal }),
          fetch(`${apiBase}/api/analytics`, { signal: request.signal }).catch(() => null),
        ]);
        if (!records.ok) throw new Error('Unable to load recent meetings. Please retry.');
        const recordsData = await records.json();
        const statsData = stats?.ok ? await stats.json() : null;
        if (request.isCurrent()) { 
          setData({ meetings: recordsData.meetings || [], analytics: statsData?.analytics || null }); 
          setError(null); 
        }
      } catch (failure) { 
        if (request.isCurrent()) setError(failure.message); 
      } finally { 
        if (request.isCurrent()) setLoading(false); 
      }
    };
    load();
    return () => currentGate.cancel();
  }, [apiBase, refreshKey, retry]);

  const { meetings, analytics } = data;
  const onRetry = () => { setLoading(true); setRetry(value => value + 1); };
  const metric = value => Number.isFinite(value) ? value.toLocaleString() : '—';

  const completionRate = calculateCompletionRate(
    analytics?.completed_action_items,
    analytics?.pending_action_items
  );

  const handleScrollCarousel = useCallback((direction) => {
    if (!carouselRef.current) return;
    const offset = getCarouselScrollOffset(direction, 320);
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative space-y-8 max-w-5xl mx-auto py-4">
      {/* Dynamic Aurora Ambient Background */}
      <AuroraGlow />

      {/* Page Heading with Pill Badge */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Executive Intelligence Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Your meetings.<br />
          <span className="text-slate-400 font-light">A clear, actionable next step.</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl font-normal leading-relaxed">
          A centralized place for your recordings, automated executive minutes, and synchronized deliverables.
        </p>
      </div>

      {/* Hero CTA Banner: Apple Dynamic Frosted Glass */}
      <div className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/15 via-purple-500/10 to-transparent pointer-events-none rounded-tr-3xl" />
        
        <div className="space-y-2 max-w-lg z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <AudioLines className="w-5 h-5" />
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              {processing ? 'Your recording is being processed' : 'Turn conversations into structured deliverables'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            {processing 
              ? 'You can browse past records and sync action items while the active audio stream processes in the background.' 
              : 'Upload audio or video recordings, enable speaker diarization, and generate executive summaries with action items.'}
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <SoundwaveAura active={Boolean(processing)} />

          {processing ? (
            <a 
              href={appPageHref('studio')} 
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
            >
              <span>View Processing</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          ) : (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button" 
              onClick={onNewMeeting} 
              disabled={!canOpen}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Start a Meeting</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Key Metric Highlights with Dynamic Glow & Progress Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saved Meetings */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 hover:border-indigo-500/40 shadow-sm transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Saved Meetings</span>
            <AudioLines className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{metric(analytics?.total_meetings)}</p>
          <p className="text-[10px] text-slate-500">Persisted in local database</p>
        </motion.div>

        {/* Pending Action Items */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 hover:border-amber-500/40 shadow-sm transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Pending Tasks</span>
            <ListTodo className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 tracking-tight">{metric(analytics?.pending_action_items)}</p>
          <p className="text-[10px] text-slate-500">Deliverables awaiting execution</p>
        </motion.div>

        {/* Completed Action Items with Progress Bar */}
        <motion.div 
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 hover:border-emerald-500/40 shadow-sm transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Completed Tasks</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">({completionRate}%)</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 tracking-tight">{metric(analytics?.completed_action_items)}</p>
          <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mt-1">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }} 
            />
          </div>
        </motion.div>
      </div>

      {/* 2-Column Split: Recent Meetings & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Meetings (8 Cols) with Swipe Carousel */}
        <div className="md:col-span-8 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Recent Meetings</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 font-mono text-[10px] text-slate-400">
                {meetings.length} records
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Carousel vs List View Mode Toggle */}
              <div className="inline-flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700/60 text-slate-400 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('carousel')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${viewMode === 'carousel' ? 'bg-indigo-600 text-white' : 'hover:text-white'}`}
                  title="Carousel swipe view"
                  aria-label="Carousel swipe view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'hover:text-white'}`}
                  title="List view"
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Carousel navigation arrows */}
              {viewMode === 'carousel' && meetings.length > 2 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('left')}
                    aria-label="Scroll carousel left"
                    className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('right')}
                    aria-label="Scroll carousel right"
                    className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <a 
                href={appPageHref('meetings')} 
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors ml-1"
              >
                <span>View library</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={onRetry} className="underline hover:text-white">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
              <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p>Loading recent meetings…</p>
            </div>
          ) : meetings.length ? (
            viewMode === 'carousel' ? (
              /* Swipe Carousel View with Scroll Snap */
              <div
                ref={carouselRef}
                tabIndex={0}
                role="region"
                aria-label="Recent meetings carousel"
                className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {meetings.map(meeting => (
                  <RecentMeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onOpen={onOpen}
                    disabled={!canOpen}
                  />
                ))}
              </div>
            ) : (
              /* Classic List View */
              <div className="space-y-2">
                {meetings.slice(0, 4).map(meeting => (
                  <MeetingRow 
                    key={meeting.id} 
                    meeting={meeting} 
                    onOpen={onOpen} 
                    disabled={!canOpen} 
                    compact 
                  />
                ))}
              </div>
            )
          ) : (
            <div className="py-12 text-center space-y-2 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-6">
              <AudioLines className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">Processed recordings will appear here.</p>
            </div>
          )}
        </div>

        {/* Right Column: Keep the Work Moving (4 Cols) */}
        <div className="md:col-span-4 space-y-3">
          <h2 className="text-sm font-bold text-white tracking-tight pb-1">Keep Work Moving</h2>
          
          <div className="space-y-2.5">
            <a 
              href={appPageHref('tasks')} 
              className="p-4 rounded-3xl bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <ListTodo className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors">Action Items</strong>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Track owners, deadlines, and unfinished deliverables.
                </p>
              </div>
            </a>

            <a 
              href={appPageHref('projects')} 
              className="p-4 rounded-3xl bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-2xl bg-purple-500/15 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-semibold text-white group-hover:text-purple-200 transition-colors">Projects & Decisions</strong>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Trace governance decisions across related meetings.
                </p>
              </div>
            </a>
          </div>

          <div className="p-4 rounded-3xl bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-slate-400 leading-relaxed flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>All AI-extracted notes and decisions are grounded against the source audio and transcript.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
