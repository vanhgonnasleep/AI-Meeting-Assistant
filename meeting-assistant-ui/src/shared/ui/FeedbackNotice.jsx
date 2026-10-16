import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { noticeStack } from '../lib/notice-stack.js';

const emptyStack = [];

/** Read failures may offer retry. Writes require checking their outcome first. */
export default function FeedbackNotice({ title, children, onRetry, retryLabel = 'Try again', onDismiss, tone = 'error' }) {
  const [dismissed, setDismissed] = useState(false);
  const id = useId();
  const element = useRef(null);
  useSyncExternalStore(noticeStack.subscribe, noticeStack.getSnapshot, () => emptyStack);
  useLayoutEffect(() => {
    if (dismissed) return;
    const node = element.current;
    const measure = () => noticeStack.update(id, node.getBoundingClientRect().height,
      node.closest('dialog') || node.ownerDocument.body);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => { observer?.disconnect(); noticeStack.remove(id); };
  }, [id, dismissed]);
  if (dismissed) return null;
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  const { offset, count } = noticeStack.layout(id);
  return <div ref={element} role={tone === 'error' ? 'alert' : 'status'} className={`feedback-notice feedback-toast feedback-${tone}`}
    style={{ '--feedback-offset': `${offset}px`, '--feedback-count': count }}>
    <Icon size={21} aria-hidden="true" className="feedback-notice-icon" />
    <div className="feedback-notice-body">
      <p className="feedback-notice-title">{title}</p>
      <div className="feedback-notice-message">{children}</div>
      {onRetry && <button type="button" className="feedback-notice-retry" onClick={onRetry}>{retryLabel}</button>}
    </div>
    <button type="button" className="feedback-notice-dismiss" aria-label="Dismiss notification" onClick={onDismiss || (() => setDismissed(true))}><X size={19} /></button>
  </div>;
}
