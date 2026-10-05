import { useEffect, useRef, useState } from 'react';
import { 
  ArrowUpRight, 
  AudioLines, 
  FolderOpen, 
  ListTodo, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { appPageHref } from './navigation.js';
import { MeetingRow } from './MeetingLibrary.jsx';
import { createRequestGate } from './session.js';

/**
 * Modernized Overview Dashboard with Apple/Linear styling
 * 
 * UX Decisions:
 * 1. High-Contrast Typography: Heading hierarchy with generous breathing room.
 * 2. Visual Metric Cards: 3 stats cards with colored accents (Total, Pending, Completed).
 * 3. Hero Action Banner: One-click CTA to start a new meeting or view ongoing processing.
 * 4. Recent Activity: Clean cards displaying recent meetings with duration and action item counts.
 */
export default function Overview({ apiBase, refreshKey, onOpen, canOpen, onNewMeeting, processing }) {
  const [data, setData] = useState({ meetings: [], analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const gate = useRef(createRequestGate());

  useEffect(() => {
    const currentGate = gate.current;
    const request = currentGate.begin();
    const load = async () => {
      try {
        const [records, stats] = await Promise.all([
          fetch(`${apiBase}/api/meetings?limit=4&offset=0&compact=true`, { signal: request.signal }),
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      
      {/* Page Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Your meetings.<br />
          <span className="text-slate-400 font-normal">A clear next step.</span>
        </h1>
        <p className="text-xs text-slate-400 max-w-xl">
          A centralized place for your recordings, the decisions you made, and what happens next.
        </p>
      </div>

      {/* Hero CTA Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800/80 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <AudioLines className="w-5 h-5" />
            </span>
            <h2 className="text-base font-semibold text-white">
              {processing ? 'Your recording is being processed' : 'Turn a conversation into working notes'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {processing 
              ? 'You can browse this workspace while the current recording is processed in the background.' 
              : 'Upload audio or video, choose the spoken language, and get a transcript you can review.'}
          </p>
        </div>

        {processing ? (
          <a 
            href={appPageHref('studio')} 
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <span>View processing</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        ) : (
          <button 
            type="button" 
            onClick={onNewMeeting} 
            disabled={!canOpen}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start a meeting</span>
          </button>
        )}
      </div>

      {/* Key Metric Highlights (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saved Meetings */}
        <div className="p-5 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Saved Meetings</span>
            <AudioLines className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{metric(analytics?.total_meetings)}</p>
          <p className="text-[10px] text-slate-500">Persisted in local database</p>
        </div>

        {/* Pending Action Items */}
        <div className="p-5 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Pending Tasks</span>
            <ListTodo className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 tracking-tight">{metric(analytics?.pending_action_items)}</p>
          <p className="text-[10px] text-slate-500">Deliverables awaiting execution</p>
        </div>

        {/* Completed Action Items */}
        <div className="p-5 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 tracking-tight">{metric(analytics?.completed_action_items)}</p>
          <p className="text-[10px] text-slate-500">Successfully finished items</p>
        </div>
      </div>

      {/* 2-Column Split: Recent Meetings & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Meetings (8 Cols) */}
        <div className="md:col-span-8 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-white tracking-tight">Recent Meetings</h2>
            <a 
              href={appPageHref('meetings')} 
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View library</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={onRetry} className="underline hover:text-white">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
              <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p>Loading recent meetings…</p>
            </div>
          ) : meetings.length ? (
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
              className="p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
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
              className="p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start gap-3 group"
            >
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
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

          <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">
            All AI-extracted notes and decisions are grounded against the source transcript.
          </p>
        </div>

      </div>

    </div>
  );
}
