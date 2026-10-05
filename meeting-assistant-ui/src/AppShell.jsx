import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { AudioLines, ArrowUpRight, Check, AlertTriangle, FolderOpen, Headphones, LayoutDashboard, ListTodo, Menu, Plus, X } from 'lucide-react';
import { WorkspaceDialog } from './Workspace.jsx';
import { appPageHref, formatMeetingDuration } from './navigation.js';
import './shell.css';

const pages = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'studio', label: 'Meeting studio', icon: Headphones },
  { id: 'meetings', label: 'Meeting library', icon: AudioLines },
  { id: 'tasks', label: 'Action items', icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
];

function NavigationLinks({ page, onSelect, mobile = false }) {
  return <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'} className="shell-links">
    {pages.map(({ id, label, icon: Icon }) => <a key={id} href={appPageHref(id)}
      aria-current={page === id ? 'page' : undefined} onClick={onSelect} className="shell-link">
      {page === id && <motion.span aria-hidden="true" className="shell-link-marker"
        layoutId={mobile ? 'mobile-nav-marker' : 'desktop-nav-marker'} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
      <Icon size={19} strokeWidth={1.7} /><span>{label}</span>
      {page === id && <span className="shell-link-dot" aria-hidden="true" />}
    </a>)}
  </nav>;
}

export default function AppShell({ page, children, overview, library, workspace, dialogs,
  processing, elapsedTime, meetingName, canStartNew, onNewMeeting, health, notice, onDismissNotice }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const main = useRef(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    // Changing pages must not steal focus from an editor or a native modal.
    if (!document.querySelector('dialog[open]')) main.current?.focus({ preventScroll: true });
  }, [page]);
  const contents = page === 'overview' ? overview : page === 'meetings' ? library : workspace;
  const label = pages.find(item => item.id === page)?.label;
  return <MotionConfig reducedMotion="user">
    <div className="app-shell">
      <a className="shell-skip" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Skip to content</a>
      <aside className="shell-sidebar">
        <a className="shell-brand" href={appPageHref('overview')}><span className="shell-brand-mark"><AudioLines size={23} /></span>
          <span>Meeting assistant<small>Your local workspace</small></span></a>
        <button type="button" className="shell-new-meeting" disabled={!canStartNew} onClick={onNewMeeting}><Plus size={18} />New meeting</button>
        <NavigationLinks page={page} />
        {(meetingName || processing) && <a href={appPageHref('studio')} className="shell-session">
          <div className="shell-session-top"><span>{processing ? 'Processing on this computer' : 'Current meeting'}</span><ArrowUpRight size={16} /></div>
          <strong title={meetingName}>{meetingName || 'Meeting audio'}</strong>
          {processing ? <div className="shell-session-status"><span className="processing-cadence" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <span>{formatMeetingDuration(elapsedTime) || '00:00'} elapsed</span></div> : <small>Return to your transcript and notes</small>}
        </a>}
        <div className="shell-sidebar-bottom"><span className={`shell-health-dot ${health.online ? 'online' : ''}`} />
          <span>{health.checking ? 'Connecting to local AI' : health.online ? 'Local AI service online' : 'Local AI service offline'}</span>
          <small>Recordings and notes stay on this computer.</small></div>
      </aside>
      <div className="shell-mobile-bar"><a className="shell-brand" href={appPageHref('overview')}><AudioLines size={22} /><span>Meeting assistant</span></a>
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={23} /></button></div>
      <main id="main-content" ref={main} tabIndex={-1} className="shell-main" aria-label={label}>
        {/* Keep the studio mounted: file URLs, audio position and session state survive navigation. */}
        <motion.section hidden={page !== 'studio'} initial={false} className="shell-studio" aria-label="Meeting studio content"
          animate={{ opacity: page === 'studio' ? 1 : 0, x: page === 'studio' ? 0 : 12 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
          {children}
        </motion.section>
        {page !== 'studio' && <motion.section key={page} className="shell-page" initial={{ opacity: 0, x: reduceMotion ? 0 : 14 }}
          animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>{contents}</motion.section>}
      </main>
      {dialogs}
      {mobileOpen && <WorkspaceDialog title="Navigation" maxWidth="max-w-sm" onClose={() => setMobileOpen(false)}>
        <NavigationLinks page={page} mobile onSelect={() => setMobileOpen(false)} />
        <button type="button" className="shell-new-meeting" disabled={!canStartNew} onClick={() => { setMobileOpen(false); onNewMeeting(); }}><Plus size={18} />New meeting</button>
      </WorkspaceDialog>}
      <AnimatePresence>{notice && <motion.div key={notice.id} role={notice.kind === 'error' ? 'alert' : 'status'} className={`shell-toast ${notice.kind === 'error' ? 'shell-toast-error' : ''}`}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}>
        {notice.kind === 'error' ? <AlertTriangle size={17} /> : <Check size={17} />}<span>{notice.message}</span><button type="button" onClick={onDismissNotice} aria-label="Dismiss notification"><X size={16} /></button>
      </motion.div>}</AnimatePresence>
    </div>
  </MotionConfig>;
}
