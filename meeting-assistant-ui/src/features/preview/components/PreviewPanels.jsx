import {
  ArrowUpRight,
  AudioLines,
  Check,
  FileText,
  Folder,
  Play,
  Quote,
} from 'lucide-react';

export function MeetingPreview({ meeting, tasks }) {
  return (
    <section className="preview-document" aria-label="Sample meeting detail">
      <div className="preview-document-meta">
        <span>
          <FileText size={15} /> MEETING NOTES
        </span>
        <span>{meeting.kind}</span>
      </div>
      <h2>{meeting.title}</h2>
      <p className="preview-muted">
        {meeting.project} · {meeting.duration}
      </p>
      {meeting.audio && (
        <audio
          controls
          preload="none"
          src={meeting.audio}
          aria-label="Recorded sample audio"
        />
      )}
      <h3>The conversation, distilled.</h3>
      <p>{meeting.summary}</p>
      <div className="preview-decision">
        <Quote size={18} />
        <div>
          <small>KEY DECISION · PREPARED OUTPUT</small>
          <p>{meeting.decision}</p>
        </div>
      </div>
      <h3>Next steps</h3>
      {tasks
        .filter((t) => t.meeting === meeting.id)
        .map((task) => (
          <div className="preview-next-step" key={task.id}>
            <span
              className={`preview-task-status ${task.done ? 'is-done' : ''}`}
            >
              <Check size={13} />
            </span>
            <div>
              <strong>{task.task}</strong>
              <p>
                {task.owner} · {task.due}
              </p>
            </div>
          </div>
        ))}
      <details className="preview-transcript">
        <summary>Read the source transcript</summary>
        <p>{meeting.transcript}</p>
      </details>
    </section>
  );
}

export function PreviewOverview({ meetings, tasks, onBrowse, onTasks }) {
  const done = tasks.filter((t) => t.done).length;
  return (
    <>
      <section className="preview-hero">
        <div>
          <span className="preview-eyebrow">MAKE ROOM FOR THE NEXT IDEA</span>
          <h2>
            Less catching up.
            <br />
            <em>More moving forward.</em>
          </h2>
          <p>
            A place for the conversation, the decisions,
            <br />
            and the work that comes next.
          </p>
          <button type="button" onClick={onBrowse}>
            Explore the sample library <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="preview-orbit" aria-hidden="true">
          <div className="preview-orbit-ring" />
          <span className="preview-orbit-file">
            <AudioLines size={35} />
          </span>
          <span className="preview-orbit-note">
            <FileText size={25} />
            <i />
            <i />
            <i />
          </span>
          <span className="preview-orbit-check">
            <Check size={25} />
          </span>
          <span className="preview-orbit-caption">
            From conversation to clarity
          </span>
        </div>
      </section>
      <div className="preview-stat-grid">
        <div>
          <span>In the sample library</span>
          <strong>
            {meetings.length}
            <small> meetings</small>
          </strong>
          <FileText size={20} />
        </div>
        <div>
          <span>Next steps to explore</span>
          <strong>
            {tasks.length - done}
            <small> open tasks</small>
          </strong>
          <Check size={20} />
        </div>
        <div>
          <span>Organized together</span>
          <strong>
            {new Set(meetings.map((m) => m.project)).size}
            <small> projects</small>
          </strong>
          <Folder size={20} />
        </div>
      </div>
      <div className="preview-section-title">
        <h2>Pick up the conversation</h2>
        <button type="button" onClick={onBrowse}>
          View library <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="preview-meeting-grid">
        {meetings.map((m) => (
          <button
            type="button"
            className={`preview-meeting-card ${m.color}`}
            key={m.id}
            onClick={() => onBrowse(m.id)}
          >
            <span className="preview-card-icon">
              <AudioLines size={20} />
            </span>
            <small>{m.kind}</small>
            <h3>{m.title}</h3>
            <p>{m.summary}</p>
            <footer>
              <span>{m.project}</span>
              <ArrowUpRight size={17} />
            </footer>
          </button>
        ))}
      </div>
      <section className="preview-bottom-note">
        <div>
          <strong>Try a little follow-through.</strong>
          <p>
            Check off a sample task and see the overview update. Changes stay in
            this preview.
          </p>
        </div>
        <button type="button" onClick={onTasks}>
          Explore tasks <ArrowUpRight size={16} />
        </button>
      </section>
    </>
  );
}

export function PreviewLibrary({
  meetings,
  tasks,
  selected,
  onSelect,
  query,
  onQuery,
}) {
  const filtered = meetings.filter((m) =>
    `${m.title} ${m.project}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="preview-library">
      <section className="preview-library-list">
        <label className="preview-search">
          <span>Find a sample meeting</span>
          <input
            type="search"
            placeholder="Search meetings or projects…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        {filtered.length === 0 && (
          <p className="preview-empty">No sample meetings match your search.</p>
        )}
        {filtered.map((m) => (
          <button
            type="button"
            className={`preview-library-item ${selected.id === m.id ? 'selected' : ''}`}
            key={m.id}
            onClick={() => onSelect(m.id)}
            aria-pressed={selected.id === m.id}
          >
            <span className={`preview-card-icon ${m.color}`}>
              <Play size={16} />
            </span>
            <div>
              <strong>{m.title}</strong>
              <small>{m.project}</small>
              <span>
                {m.duration} · {m.kind}
              </span>
            </div>
            <ArrowUpRight size={15} />
          </button>
        ))}
        <p className="preview-library-footnote">
          Prepared examples, not your private library.
        </p>
      </section>
      <MeetingPreview meeting={selected} tasks={tasks} />
    </div>
  );
}

export function PreviewTasks({ tasks, onToggle }) {
  return (
    <section className="preview-task-board">
      <div className="preview-section-title">
        <h2>A little momentum goes a long way.</h2>
        <span>
          {tasks.filter((t) => t.done).length} / {tasks.length} complete
        </span>
      </div>
      <p className="preview-muted">
        Try the checkboxes. This only changes the sample on this page.
      </p>
      {tasks.map((task) => (
        <label
          className={`preview-task-row ${task.done ? 'completed' : ''}`}
          key={task.id}
        >
          <input
            type="checkbox"
            checked={task.done}
            onChange={() => onToggle(task.id)}
          />
          <span>
            <strong>{task.task}</strong>
            <small>
              {task.owner} · {task.due}
            </small>
          </span>
          <span className="preview-task-label">
            {task.done ? 'Completed' : 'To do'}
          </span>
        </label>
      ))}
    </section>
  );
}

export function PreviewProjects({ meetings, tasks, onBrowse }) {
  return (
    <div className="preview-project-grid">
      {[...new Set(meetings.map((m) => m.project))].map((name, index) => {
        const items = meetings.filter((m) => m.project === name),
          ids = new Set(items.map((m) => m.id)),
          itemsTasks = tasks.filter((t) => ids.has(t.meeting)),
          done = itemsTasks.filter((t) => t.done).length;
        return (
          <section key={name} className="preview-project-card">
            <span
              className={`preview-card-icon ${index ? 'peach' : 'lavender'}`}
            >
              <Folder size={23} />
            </span>
            <span className="preview-sample-chip">Sample project</span>
            <h2>{name}</h2>
            <p>
              {index
                ? 'Keep evidence, decisions and follow-ups connected.'
                : 'Turn team conversations into a shared sense of direction.'}
            </p>
            <div className="preview-project-progress">
              <span>{items.length} meetings</span>
              <span>
                {done}/{itemsTasks.length} tasks complete
              </span>
            </div>
            <progress
              value={done}
              max={itemsTasks.length}
              aria-label={`${name} sample task progress`}
            />
            <button type="button" onClick={() => onBrowse(items[0].id)}>
              Explore project notes <ArrowUpRight size={15} />
            </button>
          </section>
        );
      })}
    </div>
  );
}
