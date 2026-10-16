import { CircleDot, Paperclip, Minus, Square, X } from 'lucide-react';
import { GitHubMark, GmailMark } from '../../shared/ui/BrandMarks.jsx';

export default function ConnectorPreview({ provider, repo = 'your-team/project', title = '', body = '', to = '', subject = '' }) {
  const github = provider === 'github';
  return <article className={`connector-preview ${github ? 'preview-github' : 'preview-gmail'}`} aria-label={`${github ? 'GitHub issue' : 'Gmail message'} draft preview`}>
    <div className="draft-window-bar"><span className="draft-window-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{github ? 'github.com' : 'mail.google.com'}</span><span className="draft-label">Draft preview</span></div>
    {github ? <>
      <div className="draft-product-header"><GitHubMark size={21} /><span className="draft-repo">{repo || 'your-team/project'}</span><span className="draft-product-kind">Issues</span></div>
      <div className="draft-issue-content"><span className="draft-issue-kicker"><CircleDot size={14} />New issue</span>
        <h3>{title || 'Choose an action item to preview'}</h3>
        <div className="draft-issue-body">{body ? body.split('\n').map((line, index) => <div key={index}>{line.startsWith('### ') ? <strong>{line.slice(4)}</strong> : line.split(/(\*\*[^*]+\*\*)/g).map((part, n) => part.startsWith('**') ? <strong key={n}>{part.slice(2, -2)}</strong> : part)}{!line && <br />}</div>) : <p>Your task, owner, deadline and source meeting appear here.</p>}</div>
        <div className="draft-tags"><span>deliverable</span><span>ai-action-item</span></div>
      </div>
    </> : <>
      <div className="draft-product-header"><GmailMark /><span>New message</span><span className="draft-mail-window-icons" aria-hidden="true"><Minus size={12} /><Square size={10} /><X size={12} /></span></div>
      <div className="draft-mail-fields"><div><span>To</span><span>{to || 'Add recipients before sending'}</span></div><div><span>Subject</span><strong>{subject || 'Meeting notes'}</strong></div></div>
      <div className="draft-mail-body">{body || 'Your meeting summary and follow-ups appear here.'}</div>
      <div className="draft-compose-bottom" aria-hidden="true"><span>Send</span><Paperclip size={14} /><span className="draft-unsent">Not sent</span></div>
    </>}
  </article>;
}
