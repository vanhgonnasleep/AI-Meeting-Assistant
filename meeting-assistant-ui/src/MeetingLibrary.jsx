import { AudioLines, ArrowUpRight, Clock, Search, Trash2, X } from 'lucide-react';
import { formatMeetingDuration } from './navigation.js';

export function MeetingRow({ meeting, onOpen, onDelete, disabled, compact = false }) {
  return <div className={`library-row ${compact ? 'compact' : ''}`}>
    <button type="button" className="library-open" onClick={() => onOpen(meeting)} disabled={disabled} aria-label={`Open meeting ${meeting.filename}`}>
      <span className="library-record-icon"><AudioLines size={21} strokeWidth={1.5} /></span>
      <span className="library-record-copy"><strong>{meeting.filename}</strong>
        {!compact && <span className="library-summary">{meeting.executive_summary || 'No summary recorded.'}</span>}
        <span className="library-meta"><span>{meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Saved meeting'}</span>
          <span><Clock size={12} />{formatMeetingDuration(meeting.duration) || 'Duration unavailable'}</span>
          <span>{meeting.action_item_count || 0} action items</span>
          {meeting.language && <span className="library-language">{meeting.language}</span>}</span>
      </span>
      <ArrowUpRight size={18} className="library-open-arrow" />
    </button>
    {onDelete && <button type="button" className="library-delete" onClick={event => onDelete(meeting.id, event)} disabled={disabled}
      aria-label={`Delete meeting ${meeting.filename}`}><Trash2 size={16} /></button>}
  </div>;
}

export default function MeetingLibrary({ meetings, total, loading, error, opening, query, offset,
  onSearch, onPage, onOpen, onDelete, canOpen, onNewMeeting }) {
  return <div className="library-page">
    <div className="shell-page-heading"><div><h1>Meeting library</h1><p>Find a conversation, revisit its notes, and continue the work.</p></div>
      <button type="button" className="shell-primary" onClick={onNewMeeting} disabled={!canOpen}>New meeting<ArrowUpRight size={16} /></button></div>
    <div className="library-toolbar"><label className="library-search"><Search size={19} />
      <input type="search" aria-label="Search meeting library" value={query} maxLength={4000} onChange={event => onSearch(event.target.value)} placeholder="Search recordings, notes or action items" />
      {query && <button type="button" onClick={() => onSearch('')} aria-label="Clear library search"><X size={17} /></button>}</label>
      <span>{total} matching {total === 1 ? 'meeting' : 'meetings'}</span></div>
    {!canOpen && <p className="shell-hint">Your current operation continues. Open another meeting after processing or saving finishes.</p>}
    {error && <p role="alert" className="shell-error">{error}<button type="button" onClick={() => onPage(offset)}>Retry</button></p>}
    {opening && <p role="status" className="shell-hint">Opening meeting…</p>}
    <div className="library-list" aria-busy={loading}>
      {loading ? <div className="library-loading" role="status"><span className="shell-loading-line" /><p>Loading your meetings…</p></div>
        : meetings.length ? meetings.map(meeting => <MeetingRow key={meeting.id} meeting={meeting} onOpen={onOpen} onDelete={onDelete} disabled={!canOpen || Boolean(opening)} />)
        : <div className="shell-empty"><AudioLines size={37} strokeWidth={1.4} /><h2>{query ? 'No matching meetings' : 'Your library starts here'}</h2>
          <p>{query ? 'Try a different phrase or clear the search.' : 'Upload a recording to create your first transcript and meeting notes.'}</p>
          <button type="button" className="shell-secondary" onClick={query ? () => onSearch('') : onNewMeeting} disabled={!canOpen}>{query ? 'Clear search' : 'Create a meeting'}</button></div>}
    </div>
    <div className="library-pagination"><span>{total ? `${offset + 1}–${Math.min(offset + 20, total)} of ${total}` : '0 meetings'}</span>
      <div><button type="button" className="shell-secondary" disabled={loading || offset === 0} onClick={() => onPage(Math.max(0, offset - 20))}>Previous page</button>
        <button type="button" className="shell-secondary" disabled={loading || offset + 20 >= total} onClick={() => onPage(offset + 20)}>Next page</button></div></div>
  </div>;
}
