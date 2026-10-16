import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import { userMessage } from '../../shared/lib/user-errors.js';
import { apiFetch } from '../auth/api-client.js';
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
  LayoutGrid,
  List,
  Activity
} from 'lucide-react';
import { appPageHref } from '../../app/navigation.js';
import { MeetingRow } from '../meetings/MeetingLibrary.jsx';
import { createRequestGate } from '../meetings/session.js';
import {
  calculateCompletionRate,
  formatMeetingPreview,
  getCarouselScrollOffset
} from './overview-utils.js';
import FeatureShowcase from '../landing/FeatureShowcase.jsx';

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
      className="snap-start min-w-[280px] sm:min-w-[310px] max-w-[320px] shrink-0"
    >
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        disabled={disabled}
        aria-label={`Open meeting ${preview.title}`}
        className="w-full h-full p-5 rounded-3xl bg-white/50 hover:bg-white/80 backdrop-blur-xl border border-slate-200/80 hover:border-indigo-500/50 shadow-panel hover:shadow-glass hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between group cursor-pointer text-left relative overflow-hidden"
      >
        {/* Subtle glass gradient corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-indigo-500/10 via-transparent to-transparent pointer-events-none rounded-tr-3xl" />

        {/* Card Header: Date & Duration Badges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="font-mono text-slate-600">{preview.dateText}</span>
            <div className="flex items-center gap-1.5">
              {preview.language && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 border border-indigo-500/30 font-mono text-[9px] font-bold uppercase tracking-wider">
                  {preview.language}
                </span>
              )}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100/80 border border-slate-300/60 font-mono text-[10px] text-slate-700">
                <Clock className="w-3 h-3 text-slate-600" />
                {preview.durationText}
              </span>
            </div>
          </div>

          {/* Title & Summary */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-1 tracking-tight">
              {preview.title}
            </h3>
            <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed font-normal">
              {preview.summary}
            </p>
          </div>
        </div>

        {/* Card Footer: Audio Indicator, Tasks, Action Pill */}
        <div className="pt-4 mt-4 border-t border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-slate-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <AudioLines className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11px] font-mono text-slate-600 font-medium">
              {preview.taskCount} tasks
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all">
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
          apiFetch(`${apiBase}/api/meetings?limit=8&offset=0&compact=true`, { signal: request.signal }),
          apiFetch(`${apiBase}/api/analytics`, { signal: request.signal }).catch(() => null),
        ]);
        if (!records.ok) throw new Error('Unable to load recent meetings. Please retry.');
        const recordsData = await records.json();
        const statsData = stats?.ok ? await stats.json() : null;
        if (request.isCurrent()) {
          setData({ meetings: recordsData.meetings || [], analytics: statsData?.analytics || null });
          setError(null);
        }
      } catch (failure) {
        if (request.isCurrent()) setError(userMessage(failure, 'load'));
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
    <div className="clarion-overview relative space-y-7 mx-auto">
      <div className="overview-intro">
        <div>
          <div className="workspace-eyebrow">Your workspace</div>
          <h1>Pick up the thread.</h1>
        </div>
        <span className="workspace-context"><Activity />Your local workspace</span>
      </div>

      <section className="overview-hero" aria-label="Start a meeting">
        <div>
          <div className="workspace-eyebrow">From conversation to action</div>
          <h2>{processing ? 'Your notes are on their way.' : 'One recording. A clear next step.'}</h2>
          <p>{processing ? 'Processing locally. Your library is still ready to browse.' : 'Bring the audio. Leave with notes, owners and deadlines.'}</p>
          <div className="overview-hero-action">
            {processing ? <a href={appPageHref('studio')} className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-2">View processing<ArrowUpRight size={15} /></a>
              : <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .98 }} type="button" disabled={!canOpen} onClick={onNewMeeting}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-40"><Plus size={15} />New meeting</motion.button>}
            <small>Audio & video welcome</small>
          </div>
        </div>
        <div className="overview-hero-visual" aria-hidden="true">
          <div className="meeting-miniature">
            <div className="meeting-miniature-header"><AudioLines size={14} />A conversation, made clear<span>00:32</span></div>
            <div className="meeting-spectrum">{[8,12,18,13,25,34,20,12,29,38,26,17,30,42,33,19,12,26,36,22,14,29,40,31,18,11,24,32,21,13,18,10].map((height, index) => <i key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * -.07}s` }} />)}</div>
            <div className="meeting-miniature-line" /><div className="meeting-miniature-line" />
          </div>
          <div className="meeting-miniature-note"><CheckCircle2 /><span>One less thing to keep in your head.</span></div>
        </div>
      </section>

      {/* Key Metric Highlights with Dynamic Glow & Progress Indicator */}
      <div className="overview-metrics-grid grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saved Meetings */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-slate-200/80 hover:border-indigo-500/40 shadow-xs transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Saved Meetings</span>
            <AudioLines className="w-4 h-4 text-indigo-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{metric(analytics?.total_meetings)}</p>
          <p className="text-[10px] text-slate-500">Persisted in local database</p>
        </motion.div>

        {/* Pending Action Items */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-slate-200/80 hover:border-amber-500/40 shadow-xs transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Pending Tasks</span>
            <ListTodo className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-bold text-amber-700 tracking-tight">{metric(analytics?.pending_action_items)}</p>
          <p className="text-[10px] text-slate-500">Deliverables awaiting execution</p>
        </motion.div>

        {/* Completed Action Items with Progress Bar */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="p-5 rounded-3xl bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-slate-200/80 hover:border-emerald-500/40 shadow-xs transition-all space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Completed Tasks</span>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">({completionRate}%)</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 tracking-tight">{metric(analytics?.completed_action_items)}</p>
          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden mt-1">
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
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Meetings</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300/60 font-mono text-[10px] text-slate-600">
                {meetings.length} records
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Carousel vs List View Mode Toggle */}
              <div className="inline-flex rounded-xl bg-slate-100/80 p-0.5 border border-slate-300/60 text-slate-600 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('carousel')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${viewMode === 'carousel' ? 'bg-indigo-600 text-white' : 'hover:text-slate-900'}`}
                  title="Carousel swipe view"
                  aria-label="Carousel swipe view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'hover:text-slate-900'}`}
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
                    className="p-1 rounded-lg bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('right')}
                    aria-label="Scroll carousel right"
                    className="p-1 rounded-lg bg-slate-100/80 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <a
                href={appPageHref('meetings')}
                className="text-xs text-indigo-700 hover:text-indigo-700 flex items-center gap-1 font-medium transition-colors ml-1"
              >
                <span>View library</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {error && <FeedbackNotice key={error} title="Recent meetings couldn’t be loaded" onRetry={onRetry}>{error}</FeedbackNotice>}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
              <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p>Loading recent meetings…</p>
            </div>
          ) : error ? <div className="library-recovery">
            <p>Recent meetings haven’t loaded yet.</p>
            <button type="button" onClick={onRetry}>Reload recent meetings</button>
          </div> : meetings.length ? (
            viewMode === 'carousel' ? (
              /* Swipe Carousel View with Scroll Snap */
              <div
                ref={carouselRef}
                tabIndex={0}
                role="region"
                aria-label="Recent meetings carousel"
                className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory focus:outline-hidden"
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
            <div className="py-12 text-center space-y-2 bg-white/30 border border-dashed border-slate-200 rounded-3xl p-6">
              <AudioLines className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-xs text-slate-600">Processed recordings will appear here.</p>
            </div>
          )}
        </div>

        {/* Right Column: Keep the Work Moving (4 Cols) */}
        <div className="md:col-span-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight pb-1">Keep Work Moving</h2>

          <div className="space-y-2.5">
            <a
              href={appPageHref('tasks')}
              className="p-4 rounded-3xl bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-slate-200/80 hover:border-slate-300/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-2xl bg-indigo-500/15 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <ListTodo className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">Action Items</strong>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Track owners, deadlines, and unfinished deliverables.
                </p>
              </div>
            </a>

            <a
              href={appPageHref('projects')}
              className="p-4 rounded-3xl bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-slate-200/80 hover:border-slate-300/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-2xl bg-purple-500/15 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-semibold text-slate-900 group-hover:text-purple-700 transition-colors">Projects & Decisions</strong>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Trace governance decisions across related meetings.
                </p>
              </div>
            </a>
          </div>

          <div className="p-4 rounded-3xl bg-indigo-50/20 border border-indigo-500/20 text-[11px] text-slate-600 leading-relaxed flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-indigo-700 shrink-0" />
            <span>All AI-extracted notes and decisions are grounded against the source audio and transcript.</span>
          </div>
        </div>

      </div>

      <details className="overview-explore">
        <summary><span>Try the interactive sample<small>29 seconds, from audio to follow-up</small></span><span aria-hidden="true">+</span></summary>
        <div><FeatureShowcase onExploreDemo={onNewMeeting} /></div>
      </details>

    </div>
  );
}
