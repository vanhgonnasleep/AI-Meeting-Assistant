import { useCallback, useEffect, useRef, useState } from 'react';
import { createRequestGate } from './session';
import { applyEditorResponse, buildReviewPayload, buildReviewStatusPayload, workspaceRequest } from './workspace';
import { WorkspaceDialog } from './Workspace.jsx';

const inputStyle = 'w-full rounded-xl bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-indigo-400';
const buttonStyle = 'rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40';

export default function MeetingEditor({ apiBase, meetingId, model = 'auto', onClose, onUpdated }) {
  const [state, setState] = useState({ meeting: null, draft: null, busy: true, error: null, conflict: false });
  const [projects, setProjects] = useState([]);
  const [projectError, setProjectError] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [notice, setNotice] = useState('');
  const gate = useRef(createRequestGate());
  const projectsGate = useRef(createRequestGate());
  useEffect(() => {
    const recordRequests = gate.current;
    const projectRequests = projectsGate.current;
    return () => { recordRequests.cancel(); projectRequests.cancel(); };
  }, []);

  const load = useCallback(async () => {
    const request = gate.current.begin();
    setState(previous => ({ ...previous, busy: true, error: null }));
    try {
      const data = await workspaceRequest(`${apiBase}/api/meetings/${meetingId}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      setState(previous => applyEditorResponse(previous, data));
      setSelectedProject(data.meeting.project_id == null ? '' : String(data.meeting.project_id));
      setNotice('Latest saved record loaded.');
    } catch (error) { if (request.isCurrent()) setState(previous => applyEditorResponse(previous, { error })); }
  }, [apiBase, meetingId]);
  const loadProjects = useCallback(async () => {
    const request = projectsGate.current.begin();
    try {
      const data = await workspaceRequest(`${apiBase}/api/projects`, { signal: request.signal });
      if (request.isCurrent()) { setProjects(data.projects || []); setProjectError(null); }
    } catch (failure) { if (request.isCurrent()) setProjectError(failure.message); }
  }, [apiBase]);
  useEffect(() => { load(); loadProjects(); }, [load, loadProjects]);

  const { meeting, draft, busy, error, conflict } = state;
  const savePayload = meeting && draft ? buildReviewPayload(meeting, draft) : null;
  const dirty = savePayload && Object.keys(savePayload).length > 2;
  const sourceChanged = savePayload && (Object.hasOwn(savePayload, 'segments') || Object.hasOwn(savePayload, 'raw_transcript'));
  const mutate = async (path, body, success, method = 'PATCH') => {
    const request = gate.current.begin();
    setState(previous => ({ ...previous, busy: true, error: null })); setNotice('');
    try {
      const data = await workspaceRequest(`${apiBase}/api/meetings/${meetingId}/${path}`, { method, body, signal: request.signal });
      if (!request.isCurrent()) return;
      setState(previous => applyEditorResponse(previous, data));
      setSelectedProject(data.meeting.project_id == null ? '' : String(data.meeting.project_id));
      setNotice(success);
      onUpdated(data.meeting);
    } catch (failure) { if (request.isCurrent()) setState(previous => applyEditorResponse(previous, { error: failure })); }
  };
  const change = (field, value) => { setNotice(''); setState(previous => ({ ...previous, draft: { ...previous.draft, [field]: value } })); };
  const changeItem = (field, index, key, value) => change(field, draft[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const changeInsight = (kind, index, key, value) => change('insights', { ...draft.insights,
    [kind]: draft.insights[kind].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
  const save = event => { event.preventDefault(); if (!busy && !conflict && dirty) mutate('review', savePayload, 'Changes saved as draft. Review the corrected record separately.'); };
  return <WorkspaceDialog title="Edit & review meeting" onClose={onClose}>
    <div className="space-y-4 pt-4">
      {busy && <p role="status" className="text-indigo-300">{meeting ? 'Saving or regenerating…' : 'Loading latest meeting…'}</p>}
      {notice && <p role="status" className="text-emerald-300 text-sm">{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-700 p-3 text-rose-200 text-sm">
        <p>{error}</p>
        {conflict && <p className="mt-1">This meeting changed elsewhere. Your draft is preserved. Copy any changes you need before reloading.</p>}
        <button type="button" className={`${buttonStyle} mt-2`} disabled={busy} onClick={load}>{draft ? 'Reload latest (discard draft)' : 'Retry loading'}</button>
      </div>}
      {meeting && draft && <>
        <p className="text-sm text-slate-400">{meeting.filename} · Revision {meeting.revision || 0} · {meeting.review_status === 'reviewed' ? 'Reviewed' : 'Draft'}</p>
        <form onSubmit={save}>
          <fieldset disabled={busy || conflict} className="space-y-5 max-h-[52vh] overflow-y-auto pr-1 disabled:opacity-60">
            <section className="space-y-2">
              <h3 className="font-semibold text-white">Transcript</h3>
              {draft.segments.length ? draft.segments.map((segment, index) => <label key={index} className="block text-xs text-slate-400">
                Segment {index + 1} · {segment.speaker || 'Speaker'} {segment.timestamp || ''}
                <textarea className={inputStyle} rows={3} maxLength={4000} value={segment.text} onChange={event => changeItem('segments', index, 'text', event.target.value)} />
              </label>) : <label className="block text-xs text-slate-400">Transcript text<textarea className={inputStyle} rows={8} maxLength={1000000} value={draft.raw_transcript} onChange={event => change('raw_transcript', event.target.value)} /></label>}
              {sourceChanged && <p className="text-xs text-amber-200">Source corrections clear saved chat and unchanged extracted insights. Save, then regenerate the summary if needed.</p>}
            </section>
            <label className="block text-sm font-semibold text-white">Summary<textarea className={`${inputStyle} mt-2 font-normal`} rows={7} maxLength={50000} value={draft.executive_summary} onChange={event => change('executive_summary', event.target.value)} /></label>
            <section className="space-y-3">
              <h3 className="font-semibold text-white">Action items</h3>
              {draft.action_items.length === 0 && <p className="text-sm text-slate-400">No action items.</p>}
              {draft.action_items.map((task, index) => <div key={index} className="border border-slate-800 rounded-xl p-3 space-y-2">
                <label className="block text-xs text-slate-400">Task {index + 1}<textarea required maxLength={4000} rows={2} className={inputStyle} value={task.task} onChange={event => changeItem('action_items', index, 'task', event.target.value)} /></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="text-xs text-slate-400">Assignee<input maxLength={128} className={inputStyle} value={task.assignee} onChange={event => changeItem('action_items', index, 'assignee', event.target.value)} /></label>
                  <label className="text-xs text-slate-400">Deadline<input maxLength={128} className={inputStyle} value={task.deadline} onChange={event => changeItem('action_items', index, 'deadline', event.target.value)} /></label>
                  <label className="text-xs text-slate-400">Status<select className={inputStyle} value={task.status} onChange={event => changeItem('action_items', index, 'status', event.target.value)}>{['pending', 'in_progress', 'completed', 'done'].map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></label>
                </div>
                <button type="button" className="text-xs text-rose-300 underline" onClick={() => change('action_items', draft.action_items.filter((_, taskIndex) => taskIndex !== index))}>Remove task {index + 1}</button>
              </div>)}
              <button type="button" className={buttonStyle} onClick={() => change('action_items', [...draft.action_items, { task: '', assignee: '', deadline: '', status: 'pending' }])}>Add task</button>
            </section>
            {['decisions', 'risks', 'open_questions'].map(kind => <section key={kind} className="space-y-3">
              <h3 className="font-semibold text-white">{kind === 'open_questions' ? 'Open questions' : kind === 'decisions' ? 'Decisions' : 'Risks'}</h3>
              {kind === 'decisions' && <p className="text-xs text-slate-400">Extracted decisions start as proposed. Choose approved only after human review.</p>}
              {draft.insights[kind].map((item, index) => <div key={index} className="space-y-2 rounded-xl border border-slate-800 p-3">
                <label className="block text-xs text-slate-400">{kind.replace('_', ' ')} {index + 1} {item.timestamp || ''}<textarea rows={2} required maxLength={4000} className={inputStyle} value={item.text} onChange={event => changeInsight(kind, index, 'text', event.target.value)} /></label>
                {kind === 'decisions' && <label className="block text-xs text-slate-400">Decision status<select className={inputStyle} value={item.status} onChange={event => changeInsight(kind, index, 'status', event.target.value)}>{['proposed', 'approved', 'superseded', 'cancelled'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
                <button type="button" className="text-xs text-rose-300 underline" onClick={() => change('insights', { ...draft.insights, [kind]: draft.insights[kind].filter((_, itemIndex) => itemIndex !== index) })}>Remove {kind === 'decisions' ? 'decision' : kind === 'risks' ? 'risk' : 'question'} {index + 1}</button>
              </div>)}
              <button type="button" className={buttonStyle} onClick={() => change('insights', { ...draft.insights, [kind]: [...draft.insights[kind], { text: '', ...(kind === 'decisions' ? { status: 'proposed' } : {}) }] })}>Add {kind === 'decisions' ? 'decision' : kind === 'risks' ? 'risk' : 'question'}</button>
            </section>)}
          </fieldset>
          <div className="border-t border-slate-800 pt-3 mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${buttonStyle} border-indigo-500 bg-indigo-600`} disabled={busy || conflict || !dirty}>Save changes</button>
            <button type="button" className={buttonStyle} disabled={busy || conflict || dirty || meeting.review_status === 'reviewed'} onClick={() => mutate('review', buildReviewStatusPayload(meeting), 'Meeting marked reviewed.')}>Mark reviewed</button>
            <button type="button" className={buttonStyle} disabled={busy || conflict || dirty} onClick={() => mutate('regenerate-summary', { expected_revision: meeting.revision || 0, model: model === 'instant_demo' ? 'auto' : model }, 'Summary regenerated. Review the new summary separately.', 'POST')}>Regenerate summary</button>
          </div>
          {dirty && <p className="text-xs text-amber-200 mt-2">Save your draft before reviewing, regenerating or assigning a project.</p>}
        </form>
        <div className="border-t border-slate-800 pt-3 space-y-2">
          {projectError && <p role="alert" className="text-sm text-rose-300">{projectError} <button type="button" className="underline" onClick={loadProjects}>Retry projects</button></p>}
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-slate-400">Meeting project<select className={inputStyle} disabled={busy || conflict} value={selectedProject} onChange={event => setSelectedProject(event.target.value)}>
              <option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select></label>
            <button type="button" className={buttonStyle} disabled={busy || conflict || dirty || selectedProject === (meeting.project_id == null ? '' : String(meeting.project_id))}
              onClick={() => mutate('project', { expected_revision: meeting.revision || 0, project_id: selectedProject ? Number(selectedProject) : null }, 'Project assignment saved.')}>Assign project</button>
          </div>
        </div>
      </>}
    </div>
  </WorkspaceDialog>;
}
