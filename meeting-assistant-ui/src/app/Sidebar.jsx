import { useMemo, useEffect, useRef } from 'react';
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
import { appPageHref } from './navigation.js';
import { groupMeetingsByDate } from '../features/meetings/history.js';
import { formatMeetingDuration } from './navigation.js';
import { useMobileViewport } from '../shared/hooks/mobile-viewport.js';
import { ClarionMark, ClarionWordmark } from '../shared/ui/BrandMarks.jsx';

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
  const sidebarRef = useRef(null);
  const isMobile = useMobileViewport();
  const drawerOpen = isMobile && !isCollapsed;
  useEffect(() => {
    if (!drawerOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...sidebarRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select')]
      .filter(element => element.getClientRects().length);
    const frame = requestAnimationFrame(() => sidebarRef.current?.focus());
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onToggleCollapse(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!elements.includes(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [drawerOpen, onToggleCollapse]);
  // The server searches transcript, summary and tasks as well as filenames.
  const grouped = useMemo(() => groupMeetingsByDate(meetings), [meetings]);

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={label} className="mb-4">
        <div className="px-3 mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 font-mono">
            {label}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
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
                  disabled={isLoading || !canStartNew}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all duration-150 border ${
                    isActive
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-700 font-medium shadow-xs'
                      : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                  title={meeting.filename}
                >
                  <FileAudio className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-700' : 'text-slate-500 group-hover:text-slate-600'}`} />

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
                    <Loader2 className="w-3.5 h-3.5 text-indigo-700 animate-spin shrink-0" />
                  )}
                </button>

                {/* Inline Delete Button (Appears on Hover) */}
                <button
                  type="button"
                  onClick={(e) => onDeleteMeeting(meeting.id, e)}
                  aria-label={`Delete meeting ${meeting.filename || meeting.id}`}
                  disabled={!canStartNew}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-500/10 transition-all cursor-pointer"
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
    <>
    {drawerOpen && <button type="button" className="mobile-sidebar-backdrop fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-xs md:hidden"
      aria-label="Close navigation menu" tabIndex={-1} onClick={onToggleCollapse} />}
    <aside
      id="meeting-sidebar"
      ref={sidebarRef}
      tabIndex={-1}
      role={drawerOpen ? 'dialog' : undefined}
      aria-modal={drawerOpen ? true : undefined}
      inert={isMobile && isCollapsed}
      aria-label="Meeting history and navigation"
      className={`clarion-sidebar fixed top-0 bottom-0 left-0 z-[60] md:z-30 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/80 transition-all duration-250 ease-out select-none ${
        isCollapsed ? 'w-0 -translate-x-full md:w-16 md:translate-x-0' : 'w-72 translate-x-0'
      }`}
    >
      {/* Brand & Collapse Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/80 shrink-0">
        {!isCollapsed ? (
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-85 transition-opacity cursor-pointer group"
            title="Go to Product Tour & Landing Page"
          >
            <ClarionWordmark markSize={18} textSize="text-[17px]" showTagline={true} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="w-8 h-8 rounded-[10px] bg-[#6370ce] shadow-[inset_0_1px_0_#9eabed] flex items-center justify-center text-white shrink-0 hover:opacity-90 transition-opacity cursor-pointer mx-auto"
            title="Go to Product Tour & Landing Page"
          >
            <ClarionMark size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-slate-200 transition-all active:scale-95 cursor-pointer ${
            isCollapsed ? 'hidden' : ''
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
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#303c63] hover:bg-[#40507b] active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-[#303c63] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer ${
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
          <nav className="workspace-nav" aria-label="Workspace navigation">
            <small>Workspace</small>
            {[
              ['overview', 'Overview', LayoutDashboard],
              ['studio', 'Meeting studio', FileAudio],
              ['meetings', 'Meeting library', Clock],
              ['tasks', 'Action items', CheckCircle2],
              ['projects', 'Projects', FolderOpen],
            ].map(([id, label, Icon]) => (
              <a key={id} href={appPageHref(id)} aria-current={activePage === id ? 'page' : undefined}
                onClick={event => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault(); onNavigate(id);
                }}>
                <Icon /><span>{label}</span>
              </a>
            ))}
          </nav>

          {/* Search Bar */}
          <div className="px-3 pb-3 shrink-0">
            <div className="relative flex items-center bg-white/80 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500/80 transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search past meetings..."
                className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-500 outline-hidden"
                aria-label="Filter past meetings"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-mono"
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
              <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
              <span>Loading history...</span>
            </div>
          ) : meetings.length === 0 ? (
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
                disabled={!canStartNew || loadingMeetingId === m.id}
                title={m.filename}
                aria-label={`Open meeting ${m.filename || m.id}`}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  currentMeetingId === m.id
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileAudio className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Local AI Engine Status */}
      <div className="p-3 border-t border-slate-200/80 shrink-0 bg-slate-50/80">
        {!isCollapsed ? (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  healthStatus.online ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div className="min-w-0">
                <span className="font-medium text-slate-700 block truncate text-[11px]">
                  {healthStatus.checking
                    ? 'Checking meeting assistant…'
                    : healthStatus.online
                      ? 'Meeting assistant ready'
                      : 'Meeting assistant unavailable'}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {healthStatus.data?.gpu || 'Your library remains available'}
                </span>
              </div>
            </div>
            <div className="p-1 rounded-md bg-slate-100/60 border border-slate-300/50 text-slate-600">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={healthStatus.online ? 'Meeting assistant ready' : 'Meeting assistant unavailable'}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                healthStatus.online ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
