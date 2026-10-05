import { AudioLines, ArrowUpRight, Clock, Search, Trash2, X, Plus } from 'lucide-react';
import { formatMeetingDuration } from './navigation.js';

/**
 * Modernized MeetingRow component with Linear/Apple card styling
 */
export function MeetingRow({ meeting, onOpen, onDelete, disabled, compact = false }) {
  return (
    <div className={`group relative flex items-center rounded-2xl bg-slate-900/40 hover:bg-slate-900/75 border border-slate-800/80 hover:border-slate-700/80 transition-all ${compact ? 'p-3' : 'p-4'}`}>
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        disabled={disabled}
        aria-label={`Open meeting ${meeting.filename}`}
        className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
      >
        <span className={`rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10'}`}>
          <AudioLines size={compact ? 16 : 20} strokeWidth={1.7} />
        </span>

        <span className="flex-1 min-w-0">
          <strong className="block text-xs font-semibold text-slate-200 group-hover:text-white truncate">
            {meeting.filename || 'Untitled Meeting'}
          </strong>

          {!compact && meeting.executive_summary && (
            <span className="block text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {meeting.executive_summary}
            </span>
          )}

          <span className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[10px] text-slate-500 font-mono">
            <span>{meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Saved meeting'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-slate-500" />
              {formatMeetingDuration(meeting.duration) || 'Duration unavailable'}
            </span>
            <span>•</span>
            <span>{meeting.action_item_count || 0} tasks</span>
            {meeting.language && (
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase font-semibold text-[9px]">
                {meeting.language}
              </span>
            )}
          </span>
        </span>

        <ArrowUpRight size={17} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => onDelete(meeting.id, e)}
          disabled={disabled}
          aria-label={`Delete meeting ${meeting.filename}`}
          className="ml-2 p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
          title="Delete meeting"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default function MeetingLibrary({
  meetings,
  total,
  loading,
  error,
  opening,
  query,
  offset,
  onSearch,
  onPage,
  onOpen,
  onDelete,
  canOpen,
  onNewMeeting
}) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Meeting Library</h1>
          <p className="text-xs text-slate-400 mt-1">Browse, search, and manage your saved meeting records.</p>
        </div>
        <button
          type="button"
          onClick={onNewMeeting}
          disabled={!canOpen}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          <span>New Meeting</span>
        </button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md flex items-center bg-slate-900/80 border border-slate-800 rounded-2xl px-3 py-2 focus-within:border-indigo-500 transition-colors">
          <Search size={16} className="text-slate-500 mr-2 shrink-0" />
          <input
            type="search"
            aria-label="Search meeting library"
            value={query}
            maxLength={4000}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search recordings, summaries or action items..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear library search"
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {total} matching {total === 1 ? 'meeting' : 'meetings'}
        </span>
      </div>

      {!canOpen && (
        <p className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          Your current operation continues. Open another meeting after processing or saving finishes.
        </p>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => onPage(offset)} className="underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {opening && <p role="status" className="text-xs text-indigo-400 font-medium">Opening meeting…</p>}

      {/* Meeting Cards List */}
      <div className="space-y-2.5" aria-busy={loading}>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p>Loading your meetings…</p>
          </div>
        ) : meetings.length ? (
          meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              onOpen={onOpen}
              onDelete={onDelete}
              disabled={!canOpen || Boolean(opening)}
            />
          ))
        ) : (
          <div className="py-16 text-center space-y-3 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-8">
            <AudioLines size={36} className="mx-auto text-slate-600" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white">
                {query ? 'No matching meetings' : 'Your library starts here'}
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {query ? 'Try a different keyword or clear the search.' : 'Upload or record a meeting to create your first transcript and notes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={query ? () => onSearch('') : onNewMeeting}
              disabled={!canOpen}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-all"
            >
              {query ? 'Clear search' : 'Start a meeting'}
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs text-slate-400">
          <span>{total ? `${offset + 1}–${Math.min(offset + 20, total)} of ${total}` : '0 meetings'}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => onPage(Math.max(0, offset - 20))}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-all cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || offset + 20 >= total}
              onClick={() => onPage(offset + 20)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
