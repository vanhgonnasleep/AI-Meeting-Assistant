import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  FileText,
  Folder,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
} from 'lucide-react';
import { ClarionMark } from '../../shared/ui/BrandMarks.jsx';
import { navigateEntry } from '../../app/entry-navigation.js';
import { SAMPLE_MEETINGS, SAMPLE_TASKS } from './data/sample-workspace.js';
import {
  PreviewLibrary,
  PreviewOverview,
  PreviewProjects,
  PreviewTasks,
} from './components/PreviewPanels.jsx';

const PAGES = [
  ['overview', 'Overview', LayoutDashboard],
  ['meetings', 'Meeting library', FileText],
  ['tasks', 'Action items', ListTodo],
  ['projects', 'Projects', Folder],
];
const TITLES = {
  overview: ['Workspace overview', 'A little perspective on what comes next.'],
  meetings: ['Meeting library', 'Every conversation has a place.'],
  tasks: ['Action items', 'Good ideas deserve a next step.'],
  projects: ['Projects', 'Keep the bigger picture in view.'],
};

export default function PreviewWorkspace({
  page = 'overview',
  onOpenWorkspace,
}) {
  const main = useRef(null);
  const [tasks, setTasks] = useState(() =>
    SAMPLE_TASKS.map((task) => ({ ...task })),
  );
  const [selected, setSelected] = useState(SAMPLE_MEETINGS[0].id);
  const [query, setQuery] = useState('');
  const current =
    SAMPLE_MEETINGS.find((m) => m.id === selected) || SAMPLE_MEETINGS[0];
  const browse = (id) => {
    if (typeof id === 'string') setSelected(id);
    navigateEntry('preview', 'meetings');
  };
  return (
    <div className="preview-workspace" data-preview-workspace>
      <a
        className="preview-skip"
        href="#preview-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to preview content
      </a>
      <aside className="preview-sidebar">
        <a className="preview-brand" href="#/landing">
          <ClarionMark size={29} />
          clarion<span>.</span>
        </a>
        <span className="preview-space-label">YOUR NEXT CHAPTER</span>
        <nav aria-label="Preview navigation">
          {PAGES.map(([key, label, Icon]) => (
            <a
              key={key}
              href={`#/preview/${key}`}
              aria-current={page === key ? 'page' : undefined}
            >
              <Icon size={18} />
              {label}
              {key === 'meetings' && <small>{SAMPLE_MEETINGS.length}</small>}
            </a>
          ))}
        </nav>
        <div className="preview-sidebar-note">
          <span>
            <AudioLines size={20} />
          </span>
          <strong>Curious? You're in the right place.</strong>
          <p>Explore a prepared workspace. No sign-in needed.</p>
          <a href="#/landing">
            <ArrowLeft size={13} />
            Back to the story
          </a>
        </div>
        <div className="preview-sidebar-footer">
          <LockKeyhole size={14} />
          <span>Your real library stays private.</span>
        </div>
      </aside>
      <div className="preview-main">
        <header className="preview-topbar">
          <a className="preview-mobile-brand" href="#/landing">
            <ClarionMark size={24} />
            clarion.
          </a>
          <div>
            <span className="preview-sample-chip">PREVIEW</span>
            <span>Sample data · No live AI</span>
          </div>
          <button type="button" onClick={onOpenWorkspace}>
            Your workspace <ArrowUpRight size={15} />
          </button>
        </header>
        <nav className="preview-mobile-nav" aria-label="Preview sections">
          {PAGES.map(([key, label, Icon]) => (
            <a
              key={key}
              href={`#/preview/${key}`}
              aria-current={page === key ? 'page' : undefined}
            >
              <Icon size={15} />
              {label}
            </a>
          ))}
        </nav>
        <main id="preview-content" ref={main} tabIndex={-1}>
          <div className="preview-page-title">
            <div>
              <span className="preview-eyebrow">
                A WORKSPACE WITH ROOM TO THINK
              </span>
              <h1>{TITLES[page][0]}</h1>
              <p>{TITLES[page][1]}</p>
            </div>
            <span className="preview-page-note">
              <i /> Explore freely
            </span>
          </div>
          {page === 'overview' && (
            <PreviewOverview
              meetings={SAMPLE_MEETINGS}
              tasks={tasks}
              onBrowse={browse}
              onTasks={() => navigateEntry('preview', 'tasks')}
            />
          )}
          {page === 'meetings' && (
            <PreviewLibrary
              meetings={SAMPLE_MEETINGS}
              tasks={tasks}
              selected={current}
              onSelect={setSelected}
              query={query}
              onQuery={setQuery}
            />
          )}
          {page === 'tasks' && (
            <PreviewTasks
              tasks={tasks}
              onToggle={(id) =>
                setTasks((items) =>
                  items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
                )
              }
            />
          )}
          {page === 'projects' && (
            <PreviewProjects
              meetings={SAMPLE_MEETINGS}
              tasks={tasks}
              onBrowse={browse}
            />
          )}
          <footer className="preview-footnote">
            Prepared sample content. Changes reset when you leave the preview.
            Your account data is never loaded here.
          </footer>
        </main>
      </div>
    </div>
  );
}
