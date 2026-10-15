import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Copy, Check, ExternalLink, Mail, Eye, EyeOff, CircleCheck, Loader2 } from 'lucide-react';
import { WorkspaceDialog } from './Workspace.jsx';
import { GitHubMark, GmailMark } from './BrandMarks.jsx';
import ConnectorPreview from './ConnectorPreview.jsx';
import { buildGitHubIssuePayload, buildGitHubIssueUrl, buildGmailDispatchUrl, formatEmailMinutes, postGitHubIssue, extractAssignee, isValidGitHubRepo, getKnownRecipientEmails } from './connectors.js';

const readSetting = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
const taskText = task => typeof task === 'string' ? task : task?.text || task?.task || task?.title || '';

export default function ConnectorsModal(props) {
  return props.isOpen ? <ConnectorSheet key={props.meetingData?.id || props.meetingData?.title || 'session'} {...props} /> : null;
}

function ConnectorSheet({ onClose, meetingData = {}, actionItems = [], completedTasks = new Set() }) {
  const [activeTab, setActiveTab] = useState('github');
  const [repo, setRepo] = useState(() => readSetting('ma_github_repo'));
  const [token, setToken] = useState(() => readSetting('ma_github_token'));
  const [showToken, setShowToken] = useState(false);
  const [deselected, setDeselected] = useState(() => new Set());
  const [previewIndex, setPreviewIndex] = useState(0);
  const [recipients, setRecipients] = useState(() => getKnownRecipientEmails(meetingData.attendees || []));
  const [emailTemplate, setEmailTemplate] = useState('brief');
  const [status, setStatus] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState('');
  const copyTimer = useRef(null);
  const id = useId();
  const busy = creating;
  useEffect(() => { try { localStorage.setItem('ma_github_repo', repo); } catch { /* Browser storage is optional. */ } }, [repo]);
  useEffect(() => { try { if (token) localStorage.setItem('ma_github_token', token); else localStorage.removeItem('ma_github_token'); } catch { /* Browser storage is optional. */ } }, [token]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const selected = actionItems.map((task, index) => ({ task, index })).filter(({ index }) => !deselected.has(index));
  const activeTask = selected.find(item => item.index === previewIndex) || selected[0];
  const issue = activeTask ? buildGitHubIssuePayload(activeTask.task, { title: meetingData.title, date: meetingData.date, meetingId: meetingData.id || meetingData.meetingId }) : null;
  const validRepo = isValidGitHubRepo(repo);
  const issueUrl = issue && validRepo ? buildGitHubIssueUrl(repo, issue) : '';
  const emailBody = useMemo(() => formatEmailMinutes({ ...meetingData, actionItems }, { template: emailTemplate }), [meetingData, actionItems, emailTemplate]);
  const emailSubject = `${emailTemplate === 'brief' ? 'Executive Briefing' : 'Meeting Minutes & Action Items'}: ${meetingData.title || 'Meeting'}`;
  const gmailUrl = buildGmailDispatchUrl({ to: recipients, subject: emailSubject, body: emailBody });
  const gmailPreviewBody = new URL(gmailUrl).searchParams.get('body') || '';
  const shortened = gmailPreviewBody !== emailBody;

  const toggleTask = index => setDeselected(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const copyText = async (text, kind) => {
    try { await navigator.clipboard.writeText(text); setCopied(kind); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(''), 2200); }
    catch { setStatus({ type: 'error', message: 'Clipboard is unavailable. Select and copy the preview text instead.' }); }
  };
  const createBatch = async () => {
    if (!validRepo || !token.trim() || !selected.length || busy) return;
    let created = 0;
    setCreating(true);
    setStatus({ type: 'loading', message: `Creating ${selected.length} issue(s)…` });
    try {
      for (const { task } of selected) {
        await postGitHubIssue({ repo: repo.trim(), token: token.trim(), payload: buildGitHubIssuePayload(task, { title: meetingData.title, date: meetingData.date, meetingId: meetingData.id || meetingData.meetingId }) });
        created++;
      }
      setStatus({ type: 'success', message: `Created ${created} issue(s) in ${repo.trim()}.` });
    } catch (error) { setStatus({ type: 'error', message: `${created} created. ${error.message}` }); }
    finally { setCreating(false); }
  };
  const switchTab = value => { setActiveTab(value); setStatus(null); };

  return <WorkspaceDialog title="Send to your tools" maxWidth="max-w-5xl" onClose={onClose}>
    <div className="connector-sheet">
      <p className="connector-sheet-intro">Choose a destination. See exactly what opens.</p>
      <div className="connector-tabs" role="tablist" aria-label="Export destination">{['github', 'gmail'].map(value => <button key={value} type="button" id={`${id}-${value}`} role="tab" aria-selected={activeTab === value} aria-controls={`${id}-panel`} tabIndex={activeTab === value ? 0 : -1} onClick={() => switchTab(value)} onKeyDown={event => {
        if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'github' : event.key === 'End' ? 'gmail' : value === 'github' ? 'gmail' : 'github'; switchTab(next); document.getElementById(`${id}-${next}`)?.focus(); }
      }}>{value === 'github' ? <GitHubMark /> : <GmailMark />}<span><strong>{value === 'github' ? 'GitHub issue' : 'Gmail draft'}</strong><small>{value === 'github' ? 'Give an action item a home' : 'Give your team the short version'}</small></span><ArrowUpRight size={15} /></button>)}</div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeTab}`} className="connector-sheet-grid">
        <div className="connector-settings">
          {activeTab === 'github' ? <>
            <label className="connector-field">Repository<input value={repo} onChange={event => setRepo(event.target.value)} maxLength={140} placeholder="your-team/your-project" autoComplete="off" aria-invalid={Boolean(repo) && !validRepo} /></label>
            {repo && !validRepo && <p className="connector-field-hint" role="status">Use owner/repository, without a full URL.</p>}
            <div className="connector-task-heading"><strong>Choose the task to preview</strong><span>{selected.length} selected</span></div>
            <div className="connector-task-list">{actionItems.length ? actionItems.map((task, index) => <div key={index} className={activeTask?.index === index ? 'is-previewed' : ''}>
              <label><input type="checkbox" checked={!deselected.has(index)} onChange={() => toggleTask(index)} disabled={busy} /><span><strong>{taskText(task) || 'Untitled task'}</strong><small>{task?.assignee || extractAssignee(taskText(task)) || 'Unassigned'}{task?.due || task?.deadline ? ` · ${task.due || task.deadline}` : ''}{completedTasks.has(index) ? ' · Completed' : ''}</small></span></label>
              <button type="button" aria-label={`Preview issue for ${taskText(task)}`} aria-pressed={activeTask?.index === index} disabled={deselected.has(index)} onClick={() => setPreviewIndex(index)}>Preview</button>
            </div>) : <p>No action items in this meeting yet.</p>}</div>
            <p className="connector-field-hint">One selected task opens as one issue draft.</p>
            <button type="button" className="connector-copy" disabled={!selected.length} onClick={() => copyText(selected.map(({ task }) => buildGitHubIssuePayload(task, { title: meetingData.title }).body).join('\n\n---\n\n'), 'tasks')}>{copied === 'tasks' ? <Check size={14} /> : <Copy size={14} />}{copied === 'tasks' ? 'Copied' : 'Copy selected tasks'}</button>
          </> : <>
            <label className="connector-field">Recipients<input value={recipients} maxLength={1000} onChange={event => setRecipients(event.target.value)} placeholder="Add email addresses" autoComplete="off" /></label>
            <p className="connector-field-hint">Speaker names are not email addresses. Add the people you want to include.</p>
            <fieldset className="connector-template"><legend>What should the draft include?</legend>{[['brief', 'The short version', 'Summary & decisions'], ['comprehensive', 'The full picture', 'Notes, risks & action items']].map(([value, label, hint]) => <label key={value} className={emailTemplate === value ? 'is-selected' : ''}><input type="radio" name={`${id}-template`} value={value} checked={emailTemplate === value} onChange={() => setEmailTemplate(value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}</fieldset>
            {shortened && <p className="connector-field-hint">The draft is shortened to fit a browser link. Copy the full minutes to include everything.</p>}
            <button type="button" className="connector-copy" onClick={() => copyText(emailBody, 'email')}>{copied === 'email' ? <Check size={14} /> : <Copy size={14} />}{copied === 'email' ? 'Copied full minutes' : 'Copy full minutes'}</button>
          </>}
        </div>
        <div className="connector-live-preview" data-provider={activeTab}><div className="connector-preview-label"><span>WHAT WILL OPEN</span><span><CircleCheck size={12} />Not sent</span></div>
          <ConnectorPreview provider={activeTab} repo={repo.trim()} title={issue?.title} body={activeTab === 'github' ? issue?.body : gmailPreviewBody} to={recipients} subject={emailSubject} />
          <div className="connector-open-destination"><span><ExternalLink size={12} />{activeTab === 'github' ? 'github.com → New issue' : 'mail.google.com → New message'}</span><small>You review and submit there.</small></div>
          {activeTab === 'github' ? <a className={`visual-button button-ink connector-open-link ${!issueUrl || busy ? 'is-disabled' : ''}`} href={issueUrl && !busy ? issueUrl : undefined} aria-disabled={!issueUrl || busy} tabIndex={issueUrl && !busy ? 0 : -1} target="_blank" rel="noopener noreferrer"><GitHubMark size={17} />Open issue draft<ArrowUpRight size={15} /></a>
            : <a className={`visual-button connector-open-link button-gmail ${gmailUrl.length > 2000 ? 'is-disabled' : ''}`} href={gmailUrl.length <= 2000 ? gmailUrl : undefined} aria-disabled={gmailUrl.length > 2000} tabIndex={gmailUrl.length <= 2000 ? 0 : -1} target="_blank" rel="noopener noreferrer"><GmailMark size={20} />Open Gmail draft<ArrowUpRight size={15} /></a>}
          {activeTab === 'gmail' && <a className="connector-native-mail" href={buildGmailDispatchUrl({ to: recipients, subject: emailSubject, body: emailBody, format: 'mailto' })}><Mail size={12} />Use your mail app instead</a>}
        </div>
      </div>
      {activeTab === 'github' && <details className="connector-advanced"><summary>Advanced: create issues directly with a token</summary><div><p>This creates all selected issues immediately. Your token is stored in this browser.</p><label className="connector-field">Personal access token<span className="connector-token-field"><input type={showToken ? 'text' : 'password'} value={token} autoComplete="off" onChange={event => setToken(event.target.value)} placeholder="GitHub token" /><button type="button" onClick={() => setShowToken(value => !value)} aria-label={showToken ? 'Hide token' : 'Show token'}>{showToken ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label><button type="button" className="visual-button button-ink" disabled={busy || !validRepo || !token.trim() || !selected.length} onClick={createBatch}>{busy && <Loader2 size={13} className="animate-spin" />}Create {selected.length} issues directly</button></div></details>}
      {status && <p role={status.type === 'error' ? 'alert' : 'status'} className={`connector-status status-${status.type}`}>{status.message}</p>}
    </div>
  </WorkspaceDialog>;
}
