import { useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Layers, ListTodo, MessageSquare, SplitSquareVertical, Target } from 'lucide-react';

const tabs = [
  { id: 'split', label: 'Split view', icon: SplitSquareVertical },
  { id: 'summary', label: 'Summary', icon: Layers },
  { id: 'tasks', label: 'Action items', icon: ListTodo },
  { id: 'insights', label: 'Insights', icon: Target },
  { id: 'chat', label: 'AI chat', icon: MessageSquare },
  { id: 'transcript', label: 'Transcript', icon: FileText },
];

export default function MeetingTabs({ active, onSelect, counts }) {
  const buttons = useRef({});
  const onKeyDown = (event, index) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
    if (next !== null) { event.preventDefault(); onSelect(tabs[next].id); buttons.current[tabs[next].id]?.focus(); }
  };
  return <div className="meeting-tabs" role="tablist" aria-label="Meeting views">
    {tabs.map(({ id, label, icon: Icon }, index) => <button key={id} ref={node => { buttons.current[id] = node; }} type="button"
      role="tab" id={`meeting-tab-${id}`} aria-controls="meeting-results-content" aria-selected={active === id} tabIndex={active === id ? 0 : -1}
      onClick={() => onSelect(id)} onKeyDown={event => onKeyDown(event, index)}>
      {active === id && <motion.span className="meeting-tab-marker" layoutId="meeting-view-marker" aria-hidden="true" transition={{ type: 'spring', stiffness: 440, damping: 38 }} />}
      <Icon size={16} /><span>{label}</span>{counts[id] !== undefined && <small>{counts[id]}</small>}
    </button>)}
  </div>;
}
