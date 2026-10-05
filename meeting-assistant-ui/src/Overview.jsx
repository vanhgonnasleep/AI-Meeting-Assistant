import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, FolderOpen, ListTodo, Plus } from 'lucide-react';
import { appPageHref } from './navigation.js';
import { MeetingRow } from './MeetingLibrary.jsx';
import { createRequestGate } from './session.js';

export default function Overview({ apiBase, refreshKey, onOpen, canOpen, onNewMeeting, processing }) {
  const [data, setData] = useState({ meetings: [], analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const gate = useRef(createRequestGate());
  useEffect(() => {
    const currentGate = gate.current;
    const request = currentGate.begin();
    const load = async () => {
      try {
        const [records, stats] = await Promise.all([
          fetch(`${apiBase}/api/meetings?limit=4&offset=0&compact=true`, { signal: request.signal }),
          fetch(`${apiBase}/api/analytics`, { signal: request.signal }).catch(() => null),
        ]);
        if (!records.ok) throw new Error('Unable to load recent meetings. Please retry.');
        const recordsData = await records.json();
        const statsData = stats?.ok ? await stats.json() : null;
        if (request.isCurrent()) { setData({ meetings: recordsData.meetings || [], analytics: statsData?.analytics || null }); setError(null); }
      } catch (failure) { if (request.isCurrent()) setError(failure.message); }
      finally { if (request.isCurrent()) setLoading(false); }
    };
    load();
    return () => currentGate.cancel();
  }, [apiBase, refreshKey, retry]);
  const { meetings, analytics } = data;
  const onRetry = () => { setLoading(true); setRetry(value => value + 1); };
  const metric = value => Number.isFinite(value) ? value.toLocaleString() : '—';
  return <div className="overview-page">
    <div className="shell-page-heading"><div><h1>Your meetings.<br />A clear next step.</h1><p>A place for your recordings, the decisions you made, and what happens next.</p></div></div>
    <div className="overview-start"><div className="overview-start-copy"><span className="overview-audio-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
      <h2>{processing ? 'Your recording is being processed' : 'Turn a conversation into working notes'}</h2>
      <p>{processing ? 'You can browse this workspace while the current recording is processed.' : 'Upload audio or video, choose the spoken language, and get a transcript you can review.'}</p></div>
      {processing ? <a href={appPageHref('studio')} className="shell-primary">View processing<ArrowUpRight size={17} /></a>
        : <button type="button" className="shell-primary" onClick={onNewMeeting} disabled={!canOpen}><Plus size={18} />Start a meeting</button>}</div>
    <dl className="overview-metrics"><div><dt>Saved meetings</dt><dd>{metric(analytics?.total_meetings)}</dd></div>
      <div><dt>Pending action items</dt><dd>{metric(analytics?.pending_action_items)}</dd></div>
      <div><dt>Completed action items</dt><dd>{metric(analytics?.completed_action_items)}</dd></div></dl>
    <div className="overview-columns"><section className="overview-recent"><div className="shell-section-heading"><h2>Recent meetings</h2><a href={appPageHref('meetings')}>View library<ArrowUpRight size={15} /></a></div>
      {error && <p role="alert" className="shell-error">{error}<button type="button" onClick={onRetry}>Retry</button></p>}
      {loading ? <div className="library-loading" role="status"><span className="shell-loading-line" /><p>Loading recent meetings…</p></div>
        : meetings.length ? meetings.slice(0, 4).map(meeting => <MeetingRow key={meeting.id} meeting={meeting} onOpen={onOpen} disabled={!canOpen} compact />)
          : <div className="shell-empty"><AudioLines size={30} /><p>Processed recordings will appear here.</p></div>}
    </section><section className="overview-next"><h2>Keep the work moving</h2>
      <a href={appPageHref('tasks')} className="overview-work-link"><ListTodo size={22} /><span><strong>Action items</strong><small>Find owners, deadlines and unfinished work.</small></span><ArrowUpRight size={17} /></a>
      <a href={appPageHref('projects')} className="overview-work-link"><FolderOpen size={22} /><span><strong>Projects & decisions</strong><small>Follow decisions across related meetings.</small></span><ArrowUpRight size={17} /></a>
      <p className="overview-footnote">Review the transcript before relying on generated notes or answers.</p>
    </section></div>
  </div>;
}
