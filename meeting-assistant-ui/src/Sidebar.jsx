import { useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Clock, 
  FileAudio, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Cpu, 
  Loader2,
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { groupMeetingsByDate } from './history.js';

/**
 * Staff-level Collapsible Sidebar Component
 * 
 * UX Decisions:
 * 1. Cognitive Load Reduction: Date grouping (Today, Yesterday, 7 Days) reduces visual clutter.
 * 2. Snappy Ergonomics: Collapsible rail frees up full canvas for deep transcript reading.
 * 3. Accessibility: Strict keyboard Tab indices, ARIA labels, and active route markers.
 */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  meetings = [],
  currentMeetingId = null,
  onSelectMeeting,
  onDeleteMeeting,
  onNewMeeting,
  canStartNew = true,
  searchQuery = '',
  onSearchChange,
  loadingHistory = false,
  loadingMeetingId = null,
  healthStatus = { online: false, checking: true },
  activePage = 'studio',
  onNavigate,
}) {
  // Filter meetings by user search query
  const filteredMeetings = useMemo(() => {
    if (!searchQuery.trim()) return meetings;
    const q = searchQuery.toLowerCase();
    return meetings.filter((m) => 
      (m.filename || '').toLowerCase().includes(q) ||
      (m.summary || '').toLowerCase().includes(q)
    );
  }, [meetings, searchQuery]);

  const grouped = useMemo(() => groupMeetingsByDate(filteredMeetings), [filteredMeetings]);

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={label} className="mb-4">
        <div className="px-3 mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 font-mono">
            {label}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">
            {items.length}
          </span>
        </div>
        <div className="space-y-1">
          {items.map((meeting) => {
            const isActive = currentMeetingId === meeting.id;
            const isLoading = loadingMeetingId === meeting.id;
            const dur = formatMeetingDuration(meeting.duration);

            return (
              <div
                key={meeting.id}
                className="group relative flex items-center rounded-xl transition-all duration-150"
              >
                <button
                  type="button"
                  onClick={() => onSelectMeeting(meeting)}
                  disabled={isLoading}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all duration-150 border ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-200 font-medium shadow-sm'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={meeting.filename}
                >
                  <FileAudio className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="truncate text-xs leading-snug">
                      {meeting.filename || 'Untitled Meeting'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      {dur && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" /> {dur}
                        </span>
                      )}
                      {meeting.action_items_count > 0 && (
                        <span>• {meeting.action_items_count} tasks</span>
                      )}
                    </div>
                  </div>

                  {isLoading && (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  )}
                </button>

                {/* Inline Delete Button (Appears on Hover) */}
                <button
                  type="button"
                  onClick={(e) => onDeleteMeeting(meeting.id, e)}
                  aria-label={`Delete meeting ${meeting.filename || meeting.id}`}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      aria-label="Meeting history and navigation"
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-250 ease-out select-none ${
        isCollapsed ? 'w-0 -translate-x-full md:w-16 md:translate-x-0' : 'w-72 translate-x-0'
      }`}
    >
      {/* Brand & Collapse Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs tracking-tight text-white block truncate">
                AI Meeting Assistant
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                Local Intelligence
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 border border-slate-800 transition-all active:scale-95 cursor-pointer ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Action: New Meeting */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={onNewMeeting}
          disabled={!canStartNew}
          aria-label="Start new meeting"
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer ${
            isCollapsed ? 'p-2.5' : ''
          }`}
          title="Start a new meeting"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          {!isCollapsed && <span>New Meeting</span>}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Page Links */}
          <div className="px-3 pb-2 flex gap-1 text-xs shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activePage === 'overview' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3 h-3" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activePage === 'tasks' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activePage === 'projects' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-3 h-3" />
              <span>Projects</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-3 pb-3 shrink-0">
            <div className="relative flex items-center bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500/80 transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search past meetings..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                aria-label="Filter past meetings"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
                  aria-label="Clear search"
                >
                  ESC
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Date-Grouped History Feed */}
      <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
        {!isCollapsed ? (
          loadingHistory ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 space-y-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Loading history...</span>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="py-8 px-4 text-center text-slate-500 text-xs">
              {searchQuery ? 'No meetings match your search.' : 'No recorded meetings yet. Start one above!'}
            </div>
          ) : (
            <>
              {renderGroup('Today', grouped.today)}
              {renderGroup('Yesterday', grouped.yesterday)}
              {renderGroup('Previous 7 Days', grouped.pastWeek)}
              {renderGroup('Older', grouped.older)}
            </>
          )
        ) : (
          /* Collapsed Rail View */
          <div className="py-2 flex flex-col items-center space-y-2">
            {meetings.slice(0, 8).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMeeting(m)}
                title={m.filename}
                aria-label={`Open meeting ${m.filename || m.id}`}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  currentMeetingId === m.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileAudio className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Local AI Engine Status */}
      <div className="p-3 border-t border-slate-800/80 shrink-0 bg-slate-950/80">
        {!isCollapsed ? (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  healthStatus.online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div className="min-w-0">
                <span className="font-medium text-slate-300 block truncate text-[11px]">
                  {healthStatus.checking 
                    ? 'Checking AI Engine...' 
                    : healthStatus.online 
                      ? 'Local Llama 3 Online' 
                      : 'Ollama Offline'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {healthStatus.data?.gpu || 'Zero-cloud privacy'}
                </span>
              </div>
            </div>
            <div className="p-1 rounded-md bg-slate-800/60 border border-slate-700/50 text-slate-400">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={healthStatus.online ? 'Local AI Online' : 'Ollama Offline'}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                healthStatus.online ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
