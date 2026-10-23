import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  AudioLines,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
  FileAudio,
} from 'lucide-react';
import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import { userMessage } from '../../shared/lib/user-errors.js';
import { apiFetch } from '../auth/api-client.js';
import { MeetingRow } from '../meetings/MeetingLibrary.jsx';
import { createRequestGate } from '../meetings/session.js';
import {
  calculateCompletionRate,
  formatMeetingPreview,
} from './overview-utils.js';

/**
 * Clean, Scientific Meeting Card (Redline Reference Architecture)
 */
function RedlineMeetingCard({ meeting, onOpen, disabled }) {
  const preview = formatMeetingPreview(meeting);
  const initials = (preview.title || 'ME')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'ME';

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="h-full"
    >
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        disabled={disabled}
        aria-label={`Open meeting ${preview.title}`}
        title={preview.title}
        className="w-full h-full p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 border-t-4 border-t-[#3c4999] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between text-left cursor-pointer group relative"
      >
        <div className="space-y-3 w-full">
          {/* Header Row: Initials Avatar + Title & Time */}
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#e8ecfe] text-[#3c4999] font-bold text-xs flex items-center justify-center shrink-0 border border-[#d5dcf8]">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <h3
                className="text-sm font-semibold text-slate-900 group-hover:text-[#3c4999] transition-colors truncate tracking-tight"
                title={preview.title}
              >
                {preview.title}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {preview.dateText}
              </p>
            </div>
            {preview.language && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                {preview.language}
              </span>
            )}
          </div>

          {/* Executive Summary Snippet */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {preview.summary}
          </p>
        </div>

        {/* Footer: Duration, Task Count & Open Action */}
        <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 w-full">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {preview.durationText}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
              {preview.taskCount} {preview.taskCount === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3c4999] group-hover:translate-x-0.5 transition-all">
            <span>Open</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}

/**
 * Modernized Workspace Dashboard (Redline Reference Style)
 */
export default function Overview({
  account = null,
  apiBase,
  refreshKey,
  onOpen,
  canOpen,
  onNewMeeting,
  processing = false,
}) {
  const [data, setData] = useState({ meetings: [], analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');

  const gate = useRef(createRequestGate());

  useEffect(() => {
    const currentGate = gate.current;
    const request = currentGate.begin();
    const load = async () => {
      try {
        const [records, stats] = await Promise.all([
          apiFetch(`${apiBase}/api/meetings?limit=12&offset=0&compact=true`, {
            signal: request.signal,
          }),
          apiFetch(`${apiBase}/api/analytics`, {
            signal: request.signal,
          }).catch(() => null),
        ]);
        if (!records.ok)
          throw new Error('Unable to load recent meetings. Please retry.');
        const recordsData = await records.json();
        const statsData = stats?.ok ? await stats.json() : null;
        if (request.isCurrent()) {
          setData({
            meetings: recordsData.meetings || [],
            analytics: statsData?.analytics || null,
          });
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
  const onRetry = () => {
    setLoading(true);
    setRetry((value) => value + 1);
  };
  const metric = (value) =>
    Number.isFinite(value) ? value.toLocaleString() : '—';

  const completionRate = calculateCompletionRate(
    analytics?.completed_action_items,
    analytics?.pending_action_items,
  );

  // Time-of-day greeting & user display name
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = account?.name || 'there';

  // Filtered meetings by local search query
  const filteredMeetings = useMemo(() => {
    if (!searchQuery.trim()) return meetings;
    const q = searchQuery.toLowerCase();
    return meetings.filter(
      (m) =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.filename && m.filename.toLowerCase().includes(q)) ||
        (m.executive_summary && m.executive_summary.toLowerCase().includes(q)),
    );
  }, [meetings, searchQuery]);

  return (
    <div className="clarion-overview relative space-y-7 max-w-[1400px] mx-auto">
      {/* 1. Header Greeting (Redline Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {greeting}, <span className="text-[#3c4999]">{displayName}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            You have{' '}
            <strong className="text-slate-800">
              {metric(analytics?.total_meetings ?? meetings.length)}
            </strong>{' '}
            saved meetings and{' '}
            <strong className="text-slate-800">
              {metric(analytics?.pending_action_items ?? 0)}
            </strong>{' '}
            pending action items in your workspace.
          </p>
        </div>

        {processing && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-[#3c4999]">
            <span className="w-2 h-2 rounded-full bg-[#3c4999] animate-pulse" />
            <span>AI Engine is processing audio…</span>
          </div>
        )}
      </div>

      {/* 2. Three Horizontal KPI Cards (Redline Reference Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Saved Meetings */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-[#e8ecfe] border border-[#d5dcf8] flex items-center justify-center shrink-0 text-[#3c4999]">
            <AudioLines className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {metric(analytics?.total_meetings ?? meetings.length)}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Saved Meetings
            </p>
          </div>
        </motion.div>

        {/* Card 2: Pending Tasks */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-amber-700 tracking-tight">
              {metric(analytics?.pending_action_items ?? 0)}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Pending Tasks
            </p>
          </div>
        </motion.div>

        {/* Card 3: Completed Tasks */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold text-emerald-700 tracking-tight">
                {metric(analytics?.completed_action_items ?? 0)}
              </p>
              <span className="text-xs font-semibold text-emerald-700 font-mono">
                ({completionRate}%)
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Completed Tasks
            </p>
          </div>
        </motion.div>
      </div>

      {/* 3. Section Toolbar: Meeting List + Search + View Toggle + New Meeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Meeting List
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-mono">
            {filteredMeetings.length}{' '}
            {filteredMeetings.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Inline Meeting Search */}
          <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus-within:border-indigo-500 transition-all w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings..."
              className="w-full bg-transparent outline-hidden text-xs text-slate-800 placeholder-slate-400"
              aria-label="Search meetings in list"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 ml-1"
                aria-label="Clear meeting search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-slate-600 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#3c4999] text-white shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#3c4999] text-white shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
              title="List view"
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary CTA Button: + New Meeting */}
          <button
            type="button"
            onClick={onNewMeeting}
            disabled={!canOpen}
            aria-label="Start new meeting"
            title="Start new meeting"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Meeting</span>
          </button>
        </div>
      </div>

      {/* 4. Main Meeting Cards / List Area */}
      {error && (
        <FeedbackNotice
          key={error}
          title="Recent meetings couldn’t be loaded"
          onRetry={onRetry}
        >
          {error}
        </FeedbackNotice>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
          <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-[#3c4999] rounded-full animate-spin" />
          <p>Loading meetings…</p>
        </div>
      ) : error ? (
        <div className="library-recovery p-6 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-700 mb-3">
            Recent meetings haven’t loaded yet.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-[#3c4999] hover:bg-[#303c7e] text-white text-xs font-semibold"
          >
            Reload recent meetings
          </button>
        </div>
      ) : filteredMeetings.length ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMeetings.map((meeting) => (
              <RedlineMeetingCard
                key={meeting.id}
                meeting={meeting}
                onOpen={onOpen}
                disabled={!canOpen}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMeetings.map((meeting) => (
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
        <div className="py-14 text-center space-y-3 bg-white/60 border border-dashed border-slate-200 rounded-3xl p-8">
          <FileAudio className="w-10 h-10 mx-auto text-slate-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              {searchQuery
                ? 'No meetings match your search query.'
                : 'No recorded meetings yet.'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : 'Click + New Meeting to record or upload an audio file and generate structured notes.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={onNewMeeting}
              disabled={!canOpen}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3c4999] text-white text-xs font-semibold shadow-xs hover:bg-[#303c7e] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Record or Upload Audio</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
