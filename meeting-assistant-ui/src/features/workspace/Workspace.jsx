import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import { userMessage } from '../../shared/lib/user-errors.js';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createRequestGate } from '../../shared/lib/request-gate.js';
import { buildTaskQuery, workspaceRequest } from './workspace.js';

const inputStyle = 'w-full rounded-xl bg-slate-50 border border-slate-200 p-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-all';
const buttonStyle = 'rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer';

export function WorkspaceDialog({ title, onClose, children, maxWidth = 'max-w-4xl' }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    className={`w-[calc(100%_-_2rem)] ${maxWidth} max-h-[90vh] rounded-3xl border border-slate-300 bg-white p-5 text-slate-800 shadow-glass backdrop:bg-slate-900/25`}>
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
      <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
      <button type="button" onClick={onClose} className={buttonStyle} aria-label={`Close ${title}`}>Close</button>
    </div>
    {children}
  </dialog>;
}

export default function Workspace({ apiBase, onClose, onOpenMeeting, presentation = 'dialog', initialSection = 'tasks', onSectionChange, canOpenMeeting = true }) {
  const [tab, setTab] = useState(initialSection);
  const [filters, setFilters] = useState({ q: '', status: '', assignee: '', project_id: '' });
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState({ tasks: [], entries: [], total: 0, has_more: false });
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(null);
  const [projectError, setProjectError] = useState(null);
  const [reload, setReload] = useState(0);
  const pageGate = useRef(createRequestGate());
  const projectsGate = useRef(createRequestGate());
  const createGate = useRef(createRequestGate());
  const openGate = useRef(createRequestGate());

  useEffect(() => {
    const gates = [pageGate.current, projectsGate.current, createGate.current, openGate.current];
    return () => gates.forEach(gate => gate.cancel());
  }, []);

  const loadProjects = useCallback(async () => {
    const request = projectsGate.current.begin();
    try {
      const data = await workspaceRequest(`${apiBase}/api/projects`, { signal: request.signal });
      if (request.isCurrent()) { setProjects(Array.isArray(data.projects) ? data.projects : []); setProjectError(null); }
    } catch (failure) { if (request.isCurrent()) setProjectError(userMessage(failure, 'load')); }
  }, [apiBase]);
  useEffect(() => { loadProjects(); }, [loadProjects, reload]);

  useEffect(() => {
    const currentGate = pageGate.current;
    const request = currentGate.begin();
    const url = tab === 'tasks' ? `${apiBase}/api/tasks?${buildTaskQuery(filters, offset)}`
      : projectId ? `${apiBase}/api/projects/${projectId}/timeline?limit=50&offset=${offset}` : null;
    const load = async () => {
      try {
        const data = url ? await workspaceRequest(url, { signal: request.signal }) : { entries: [], total: 0, has_more: false };
        if (request.isCurrent()) setPage(data);
      } catch (failure) { if (request.isCurrent()) setError(userMessage(failure, 'load')); }
      finally { if (request.isCurrent()) setBusy(false); }
    };
    load();
    return () => currentGate.cancel();
  }, [apiBase, tab, filters, offset, projectId, reload]);

  const resetPage = () => { pageGate.current.cancel(); setPage({ tasks: [], entries: [], total: 0, has_more: false }); setBusy(true); setError(null); };
  const changeFilter = (key, value) => { resetPage(); setOffset(0); setFilters(previous => ({ ...previous, [key]: value })); };
  const changeTab = value => { if (value === tab) return; resetPage(); setOffset(0); setTab(value); onSectionChange?.(value); };
  const changePage = value => { resetPage(); setOffset(value); };
  const createProject = async event => {
    event.preventDefault();
    const request = createGate.current.begin();
    setCreating(true); setProjectError(null);
    try {
      const data = await workspaceRequest(`${apiBase}/api/projects`, { method: 'POST', body: { name: name.trim() }, signal: request.signal });
      if (!request.isCurrent()) return;
      setName(''); resetPage(); setProjectId(String(data.project.id)); setOffset(0); setReload(value => value + 1);
    } catch (failure) { if (request.isCurrent()) setProjectError(userMessage(failure, 'load')); }
    finally { if (request.isCurrent()) setCreating(false); }
  };
  const openMeeting = async meetingId => {
    if (!canOpenMeeting) return;
    const request = openGate.current.begin();
    setOpening(true); setError(null);
    try {
      const opened = await onOpenMeeting(meetingId);
      if (request.isCurrent() && !opened) setError('Unable to open this meeting. It may have been deleted.');
    } catch (failure) { if (request.isCurrent()) setError(userMessage(failure, 'load')); }
    finally { if (request.isCurrent()) setOpening(false); }
  };
  const rows = tab === 'tasks' ? (page.tasks || []) : (page.entries || []);

  const contents = <>
    {presentation === 'page' && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {tab === 'tasks' ? 'Action items' : 'Projects & decisions'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {tab === 'tasks'
              ? 'Find what needs doing, who owns it, and the meeting it came from.'
              : 'Connect related meetings and revisit the decisions behind your work.'}
          </p>
        </div>
      </div>
    )}

    <div className="space-y-4 pt-2">
      {/* Sub-tab switcher only in modal dialog */}
      {presentation !== 'page' && (
        <div className="flex gap-2" role="tablist" aria-label="Workspace sections">
          {['tasks', 'projects'].map(value => (
            <button
              key={value}
              id={`workspace-tab-${value}`}
              type="button"
              role="tab"
              aria-controls="workspace-panel"
              tabIndex={tab === value ? 0 : -1}
              aria-selected={tab === value}
              onKeyDown={event => {
                const next = event.key === 'Home' ? 'tasks' : event.key === 'End' ? 'projects' : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (tab === 'tasks' ? 'projects' : 'tasks') : null;
                if (next) { event.preventDefault(); changeTab(next); document.getElementById(`workspace-tab-${next}`)?.focus(); }
              }}
              className={`${buttonStyle} ${tab === value ? 'border-indigo-400 text-indigo-700 bg-white font-semibold' : ''}`}
              onClick={() => changeTab(value)}
            >
              {value === 'tasks' ? 'All tasks' : 'Projects & decisions'}
            </button>
          ))}
        </div>
      )}

      {!error && projectError && (
        <FeedbackNotice key={projectError} title="Project action needs attention" onDismiss={() => setProjectError(null)}>
          {projectError}
        </FeedbackNotice>
      )}

      {tab === 'tasks' ? (
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            <span className="font-medium text-slate-700">Search tasks</span>
            <input
              className={inputStyle}
              placeholder="Search descriptions..."
              value={filters.q}
              maxLength={4000}
              onChange={event => changeFilter('q', event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            <span className="font-medium text-slate-700">Assignee</span>
            <input
              className={inputStyle}
              placeholder="Filter by owner..."
              value={filters.assignee}
              maxLength={128}
              onChange={event => changeFilter('assignee', event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            <span className="font-medium text-slate-700">Task status</span>
            <select
              className={inputStyle}
              value={filters.status}
              onChange={event => changeFilter('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {['pending', 'in_progress', 'completed', 'done'].map(value => (
                <option key={value} value={value}>{value.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            <span className="font-medium text-slate-700">Project filter</span>
            <select
              className={inputStyle}
              value={filters.project_id}
              onChange={event => changeFilter('project_id', event.target.value)}
            >
              <option value="">All projects</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <form onSubmit={createProject} className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
            <label className="flex-1 text-xs text-slate-600 flex flex-col gap-1">
              <span className="font-medium text-slate-700">New project name</span>
              <input
                className={inputStyle}
                placeholder="Enter project name..."
                value={name}
                required
                maxLength={128}
                onChange={event => setName(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all shrink-0 cursor-pointer"
              disabled={creating || !name.trim()}
            >
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </form>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <label className="block text-xs text-slate-600">
              <span className="font-medium text-slate-700">Project timeline</span>
              <select
                className="mt-1 w-full rounded-xl bg-slate-50 border border-slate-200 p-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-all"
                value={projectId}
                onChange={event => { resetPage(); setOffset(0); setProjectId(event.target.value); }}
              >
                <option value="">Choose a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name} ({project.meeting_count} meetings)</option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-slate-500">Decision history keeps each meeting's source and human-selected status.</p>
          </div>
        </div>
      )}

      {error && (
        <FeedbackNotice key={error} title="Workspace couldn’t be loaded" onRetry={() => { resetPage(); setReload(value => value + 1); }}>
          {error}
        </FeedbackNotice>
      )}

      {opening && <p role="status" className="text-indigo-700 text-xs">Opening source meeting…</p>}
      {!canOpenMeeting && <p className="shell-hint">Open a source meeting after the current processing or save finishes.</p>}

      <div
        id="workspace-panel"
        role={presentation === 'page' ? 'region' : 'tabpanel'}
        aria-label={presentation === 'page' ? 'Workspace records' : undefined}
        aria-labelledby={presentation === 'page' ? undefined : `workspace-tab-${tab}`}
        className={`workspace-data-panel ${presentation === 'page' ? 'space-y-3' : 'max-h-[40vh] overflow-y-auto space-y-2'}`}
        aria-busy={busy}
      >
        {busy ? (
          <p role="status" className="p-6 text-center text-xs text-slate-500">Loading…</p>
        ) : error && rows.length === 0 ? (
          <div className="library-recovery p-6 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs text-slate-600 mb-2">
              {tab === 'tasks' ? 'Your action items haven’t loaded yet.' : 'Project decisions haven’t loaded yet.'}
            </p>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-[#3c4999] text-white text-xs font-semibold"
              onClick={() => { resetPage(); setReload(value => value + 1); }}
            >
              {tab === 'tasks' ? 'Reload action items' : 'Reload project decisions'}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500 bg-white/60 rounded-2xl border border-slate-200/80">
            {tab === 'projects' && !projectId ? 'Choose or create a project to see its decisions.' : 'No matching records.'}
          </p>
        ) : (
          rows.map(row => {
            const status = row.status || (tab === 'tasks' ? 'pending' : 'proposed');
            const isDone = status === 'completed' || status === 'done' || status === 'approved';
            const isInProgress = status === 'in_progress';
            const badgeClass = isDone
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : isInProgress
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200';

            return (
              <button
                type="button"
                key={`${row.meeting_id}-${tab === 'tasks' ? row.task_idx : row.decision_idx}`}
                disabled={opening || !canOpenMeeting}
                onClick={() => openMeeting(row.meeting_id)}
                className="group block w-full text-left p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-xs transition-all disabled:opacity-40 cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors leading-relaxed">
                    {tab === 'tasks' ? row.task : row.text}
                  </p>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider shrink-0 font-mono ${badgeClass}`}>
                    {status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-semibold text-slate-800">{row.filename}</span>
                    {row.timestamp && <span className="font-mono text-[11px] text-slate-400">{row.timestamp}</span>}
                    {tab === 'tasks' && (
                      <>
                        <span>•</span>
                        <span>Assignee: <strong className="text-slate-700 font-medium">{row.assignee || 'Unassigned'}</strong></span>
                        {row.deadline && (
                          <>
                            <span>•</span>
                            <span>Deadline: <strong className="text-slate-700 font-medium">{row.deadline}</strong></span>
                          </>
                        )}
                      </>
                    )}
                    {tab === 'projects' && (
                      <>
                        <span>•</span>
                        <span>Meeting review: {row.review_status === 'reviewed' ? 'Reviewed' : 'Draft'}</span>
                        {row.created_at && (
                          <>
                            <span>•</span>
                            <span>{new Date(row.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <span className="text-[#3c4999] group-hover:translate-x-0.5 transition-transform font-medium inline-flex items-center gap-1 text-[11px]">
                    Open source meeting #{row.meeting_id} →
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs">
        <button
          type="button"
          className={buttonStyle}
          disabled={busy || offset === 0}
          onClick={() => changePage(Math.max(0, offset - 50))}
        >
          Previous page
        </button>
        <span className="text-slate-500 font-mono">
          {error && !rows.length ? 'Records unavailable' : page.total ? `${offset + 1}–${Math.min(offset + 50, page.total)} of ${page.total}` : '0 records'}
        </span>
        <button
          type="button"
          className={buttonStyle}
          disabled={busy || !page.has_more}
          onClick={() => changePage(offset + 50)}
        >
          Next page
        </button>
      </div>
    </div>
  </>;

  return presentation === 'page' ? (
    <div className="workspace-page max-w-[1400px] mx-auto py-2 space-y-6">{contents}</div>
  ) : (
    <WorkspaceDialog title="Meeting workspace" onClose={onClose}>{contents}</WorkspaceDialog>
  );
}
