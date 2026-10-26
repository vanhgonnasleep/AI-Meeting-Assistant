import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import { userMessage } from '../../shared/lib/user-errors.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, ArrowUpRight, Clock, Search, Trash2, X, Plus } from 'lucide-react';
import { formatMeetingDuration } from '../../app/navigation.js';
import { createRequestGate } from '../../shared/lib/request-gate.js';
import { workspaceRequest } from '../workspace/workspace.js';

/**
 * Modernized MeetingRow component with Linear/Apple card styling,
 * perfectly normalized to match Overview card sizes, padding and typography.
 */
export function MeetingRow({ meeting, onOpen, onDelete, disabled, compact = false }) {
  return (
    <div
      className={`group relative flex items-center rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 ease-out ${
        compact ? 'p-3.5' : 'p-5'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        disabled={disabled}
        aria-label={`Open meeting ${meeting.filename}`}
        className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer active:scale-[0.99] transition-all duration-150 ease-out"
      >
        <span
          className={`rounded-xl bg-[#e8ecfe] border border-[#d5dcf8] flex items-center justify-center text-[#3c4999] group-hover:bg-[#3c4999] group-hover:text-white transition-all shrink-0 ${
            compact ? 'w-9 h-9' : 'w-11 h-11'
          }`}
        >
          <AudioLines size={compact ? 18 : 22} strokeWidth={1.7} />
        </span>

        <span className="flex-1 min-w-0">
          <strong className="block text-sm sm:text-base font-semibold text-slate-900 group-hover:text-[#3c4999] transition-colors truncate tracking-tight">
            {meeting.filename || 'Untitled Meeting'}
          </strong>

          {!compact && meeting.executive_summary && (
            <span className="block text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">
              {meeting.executive_summary}
            </span>
          )}

          <span className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>
              {meeting.created_at && Number.isFinite(new Date(meeting.created_at).getTime())
                ? new Date(meeting.created_at).toLocaleDateString()
                : 'Saved meeting'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatMeetingDuration(meeting.duration) || 'Duration unavailable'}
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums text-[11px] font-medium">
              {meeting.action_item_count || 0}{' '}
              {meeting.action_item_count === 1 ? 'task' : 'tasks'}
            </span>
            {meeting.language && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                {meeting.language}
              </span>
            )}
          </span>
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3c4999] group-hover:translate-x-0.5 transition-all shrink-0 ml-3">
          <span>Open</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => onDelete(meeting.id, e)}
          disabled={disabled}
          aria-label={`Delete meeting ${meeting.filename}`}
          className="ml-2 p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
          title="Delete meeting"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function MeetingLibrary({
  apiBase,
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
  onNewMeeting,
  filters = { project: '', days: '', sort: 'newest' },
  onFiltersChange,
}) {
  const hasFilters = Boolean(query || filters.project || filters.days);
  const [projects, setProjects] = useState([]);
  const [projectError, setProjectError] = useState(null);
  const projectsGate = useRef(createRequestGate());
  const loadProjects = useCallback(async () => {
    const request = projectsGate.current.begin();
    try {
      const data = await workspaceRequest(`${apiBase}/api/projects`, { signal: request.signal });
      if (request.isCurrent()) {
        setProjects(Array.isArray(data.projects) ? data.projects : []);
        setProjectError(null);
      }
    } catch (failure) {
      if (request.isCurrent()) setProjectError(userMessage(failure, 'load'));
    }
  }, [apiBase]);

  useEffect(() => {
    const gate = projectsGate.current;
    void loadProjects();
    window.addEventListener('focus', loadProjects);
    return () => {
      gate.cancel();
      window.removeEventListener('focus', loadProjects);
    };
  }, [loadProjects]);

  return (
    <div className="space-y-7 max-w-[1400px] mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Meeting Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse, search, and manage your saved meeting records.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewMeeting}
          disabled={!canOpen}
          aria-label="Start new meeting"
          title="Start new meeting"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] active:scale-[0.98] disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all duration-150 ease-out shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Meeting</span>
        </button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-md flex items-center bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus-within:ring-2 focus-within:ring-[#3c4999]/20 focus-within:border-[#3c4999] transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="search"
            aria-label="Search meeting library"
            value={query}
            maxLength={500}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search recordings, summaries or action items..."
            className="w-full bg-transparent outline-hidden text-xs text-slate-800 placeholder-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear library search"
              className="text-slate-400 hover:text-slate-600 ml-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-mono tabular-nums">
          {error ? 'Meetings unavailable' : <>{total} matching {total === 1 ? 'meeting' : 'meetings'}</>}
        </span>
      </div>

      {/* Filters Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs" aria-label="Library filters and sorting">
        <label className="text-xs text-slate-600 flex flex-col gap-1.5">
          <span className="font-medium text-slate-700">Project</span>
          <select
            aria-label="Filter by project"
            value={filters.project}
            onChange={(event) => onFiltersChange?.({ ...filters, project: event.target.value })}
            className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-[#3c4999]/20 focus:border-[#3c4999] outline-hidden cursor-pointer"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1.5">
          <span className="font-medium text-slate-700">Date</span>
          <select
            aria-label="Filter by date"
            value={filters.days}
            onChange={(event) => onFiltersChange?.({ ...filters, days: event.target.value })}
            className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-[#3c4999]/20 focus:border-[#3c4999] outline-hidden cursor-pointer"
          >
            <option value="">All dates</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1.5">
          <span className="font-medium text-slate-700">Sort by</span>
          <select
            aria-label="Sort meetings"
            value={filters.sort}
            onChange={(event) => onFiltersChange?.({ ...filters, sort: event.target.value })}
            className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs sm:text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-[#3c4999]/20 focus:border-[#3c4999] outline-hidden cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="duration">Longest duration</option>
            <option value="tasks">Most tasks</option>
          </select>
        </label>
      </div>

      {!error && projectError && (
        <FeedbackNotice title="Projects are unavailable" onRetry={loadProjects} onDismiss={() => setProjectError(null)}>
          {projectError}
        </FeedbackNotice>
      )}

      {!canOpen && (
        <p className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-700">
          Your current operation continues. Open another meeting after processing or saving finishes.
        </p>
      )}

      {error && (
        <FeedbackNotice key={error} title="Your library couldn’t be loaded" onRetry={() => onPage(offset)}>
          {error}
        </FeedbackNotice>
      )}

      {opening && <p role="status" className="text-xs sm:text-sm text-indigo-700 font-medium">Opening meeting…</p>}

      {/* Meeting Cards List */}
      <div className="space-y-3" aria-busy={loading}>
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-[#3c4999] rounded-full animate-spin" />
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
        ) : error ? (
          <div className="library-recovery p-6 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-sm text-slate-700 mb-3">Your meetings haven’t loaded yet.</p>
            <button
              type="button"
              onClick={() => onPage(offset)}
              className="px-4 py-2 rounded-xl bg-[#3c4999] hover:bg-[#303c7e] text-white text-xs font-semibold"
            >
              Reload library
            </button>
          </div>
        ) : (
          <div className="py-14 text-center space-y-3 bg-white/60 border border-dashed border-slate-200 rounded-3xl p-8">
            <AudioLines className="w-10 h-10 mx-auto text-slate-400" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-800">
                {hasFilters ? 'No meetings match these filters' : 'Your library starts here'}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {hasFilters
                  ? 'Try another search, project or date range.'
                  : 'Upload or record a meeting to create your first transcript and notes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={
                hasFilters
                  ? () => {
                      onSearch('');
                      onFiltersChange?.({ ...filters, project: '', days: '' });
                    }
                  : onNewMeeting
              }
              disabled={!canOpen}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3c4999] text-white text-xs font-semibold shadow-xs hover:bg-[#303c7e] transition-all cursor-pointer"
            >
              {hasFilters ? (
                'Clear filters'
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Start a meeting</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 text-xs text-slate-600 font-mono tabular-nums">
          <span>{total ? `${offset + 1}–${Math.min(offset + 20, total)} of ${total}` : '0 meetings'}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => onPage(Math.max(0, offset - 20))}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 text-slate-800 text-xs font-semibold shadow-2xs transition-all duration-150 ease-out cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || offset + 20 >= total}
              onClick={() => onPage(offset + 20)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40 text-slate-800 text-xs font-semibold shadow-2xs transition-all duration-150 ease-out cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
