import { useCallback, useEffect, useRef, useState } from 'react';
import { createRequestGate } from './session';
import { buildTaskQuery, workspaceRequest } from './workspace';

const inputStyle = 'w-full rounded-xl bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-indigo-400';
const buttonStyle = 'rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40';

export function WorkspaceDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="workspace-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}
    className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] rounded-3xl border border-slate-700 bg-slate-900 p-5 text-slate-200 shadow-2xl backdrop:bg-slate-950/80">
    <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
      <h2 id="workspace-dialog-title" className="text-lg font-semibold text-white">{title}</h2>
      <button type="button" onClick={onClose} className={buttonStyle} aria-label={`Close ${title}`}>Close</button>
    </div>
    {children}
  </dialog>;
}

export default function Workspace({ apiBase, onClose, onOpenMeeting }) {
  const [tab, setTab] = useState('tasks');
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
    } catch (failure) { if (request.isCurrent()) setProjectError(failure.message); }
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
      } catch (failure) { if (request.isCurrent()) setError(failure.message); }
      finally { if (request.isCurrent()) setBusy(false); }
    };
    load();
    return () => currentGate.cancel();
  }, [apiBase, tab, filters, offset, projectId, reload]);

  const resetPage = () => { pageGate.current.cancel(); setPage({ tasks: [], entries: [], total: 0, has_more: false }); setBusy(true); setError(null); };
  const changeFilter = (key, value) => { resetPage(); setOffset(0); setFilters(previous => ({ ...previous, [key]: value })); };
  const changeTab = value => { if (value === tab) return; resetPage(); setOffset(0); setTab(value); };
  const changePage = value => { resetPage(); setOffset(value); };
  const createProject = async event => {
    event.preventDefault();
    const request = createGate.current.begin();
    setCreating(true); setProjectError(null);
    try {
      const data = await workspaceRequest(`${apiBase}/api/projects`, { method: 'POST', body: { name: name.trim() }, signal: request.signal });
      if (!request.isCurrent()) return;
      setName(''); resetPage(); setProjectId(String(data.project.id)); setOffset(0); setReload(value => value + 1);
    } catch (failure) { if (request.isCurrent()) setProjectError(failure.message); }
    finally { if (request.isCurrent()) setCreating(false); }
  };
  const openMeeting = async meetingId => {
    const request = openGate.current.begin();
    setOpening(true); setError(null);
    try {
      const opened = await onOpenMeeting(meetingId);
      if (request.isCurrent() && !opened) setError('Unable to open this meeting. It may have been deleted.');
    } catch (failure) { if (request.isCurrent()) setError(failure.message); }
    finally { if (request.isCurrent()) setOpening(false); }
  };
  const rows = tab === 'tasks' ? (page.tasks || []) : (page.entries || []);
  return <WorkspaceDialog title="Meeting workspace" onClose={onClose}>
    <div className="space-y-4 pt-4">
      <div className="flex gap-2" role="tablist" aria-label="Workspace sections">
        {['tasks', 'projects'].map(value => <button key={value} id={`workspace-tab-${value}`} type="button" role="tab" aria-controls="workspace-panel" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value}
          onKeyDown={event => {
            const next = event.key === 'Home' ? 'tasks' : event.key === 'End' ? 'projects' : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (tab === 'tasks' ? 'projects' : 'tasks') : null;
            if (next) { event.preventDefault(); changeTab(next); document.getElementById(`workspace-tab-${next}`)?.focus(); }
          }}
          className={`${buttonStyle} ${tab === value ? 'border-indigo-400 text-indigo-200' : ''}`} onClick={() => changeTab(value)}>{value === 'tasks' ? 'All tasks' : 'Projects & decisions'}</button>)}
      </div>
      {projectError && <p role="alert" className="text-rose-300">{projectError} <button type="button" className="underline" onClick={loadProjects}>Retry projects</button></p>}
      {tab === 'tasks' ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">Search tasks<input className={inputStyle} value={filters.q} maxLength={4000} onChange={event => changeFilter('q', event.target.value)} /></label>
        <label className="text-xs text-slate-400">Assignee<input className={inputStyle} value={filters.assignee} maxLength={128} onChange={event => changeFilter('assignee', event.target.value)} /></label>
        <label className="text-xs text-slate-400">Task status<select className={inputStyle} value={filters.status} onChange={event => changeFilter('status', event.target.value)}>
          <option value="">All statuses</option>{['pending', 'in_progress', 'completed', 'done'].map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
        </select></label>
        <label className="text-xs text-slate-400">Project filter<select className={inputStyle} value={filters.project_id} onChange={event => changeFilter('project_id', event.target.value)}>
          <option value="">All projects</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
      </div> : <div className="space-y-3">
        <form onSubmit={createProject} className="flex items-end gap-2">
          <label className="flex-1 text-xs text-slate-400">New project name<input className={inputStyle} value={name} required maxLength={128} onChange={event => setName(event.target.value)} /></label>
          <button type="submit" className={buttonStyle} disabled={creating || !name.trim()}>{creating ? 'Creating…' : 'Create project'}</button>
        </form>
        <label className="block text-xs text-slate-400">Project timeline<select className={inputStyle} value={projectId} onChange={event => { resetPage(); setOffset(0); setProjectId(event.target.value); }}>
          <option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} ({project.meeting_count} meetings)</option>)}
        </select></label>
        <p className="text-xs text-slate-400">Decision history keeps each meeting's source and human-selected status.</p>
      </div>}
      {error && <p role="alert" className="text-rose-300">{error} <button type="button" className="underline" onClick={() => { resetPage(); setReload(value => value + 1); }}>Retry</button></p>}
      {opening && <p role="status" className="text-indigo-300">Opening source meeting…</p>}
      <div id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${tab}`} className="max-h-[40vh] overflow-y-auto space-y-2" aria-busy={busy}>
        {busy ? <p role="status" className="p-4 text-slate-400">Loading…</p> : rows.length === 0 ? <p className="p-4 text-slate-400">{tab === 'projects' && !projectId ? 'Choose or create a project to see its decisions.' : 'No matching records.'}</p>
          : rows.map(row => <button type="button" key={`${row.meeting_id}-${tab === 'tasks' ? row.task_idx : row.decision_idx}`} disabled={opening}
            onClick={() => openMeeting(row.meeting_id)} className="block w-full text-left p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-400 disabled:opacity-40">
            <p className="text-sm text-white">{tab === 'tasks' ? row.task : row.text}</p>
            <p className="text-xs text-indigo-300 mt-1">{row.filename} · {row.status || 'proposed'}{row.timestamp ? ` · ${row.timestamp}` : ''}</p>
            {tab === 'projects' && <p className="text-xs text-slate-400 mt-1">Meeting review: {row.review_status === 'reviewed' ? 'Reviewed' : 'Draft'}</p>}
            <p className="text-xs text-slate-400 mt-1">{tab === 'tasks' ? `${row.assignee || 'Unassigned'}${row.deadline ? ` · ${row.deadline}` : ''}` : row.created_at ? new Date(row.created_at).toLocaleString() : ''} · Open source meeting #{row.meeting_id}</p>
          </button>)}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs">
        <button type="button" className={buttonStyle} disabled={busy || offset === 0} onClick={() => changePage(Math.max(0, offset - 50))}>Previous page</button>
        <span>{page.total ? `${offset + 1}–${Math.min(offset + 50, page.total)} of ${page.total}` : '0 records'}</span>
        <button type="button" className={buttonStyle} disabled={busy || !page.has_more} onClick={() => changePage(offset + 50)}>Next page</button>
      </div>
    </div>
  </WorkspaceDialog>;
}
