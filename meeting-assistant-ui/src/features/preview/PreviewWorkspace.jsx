import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  FileAudio,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  Mic,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { ClarionMark } from '../../shared/ui/BrandMarks.jsx';
import { navigateEntry } from '../../app/entry-navigation.js';
import { SAMPLE_MEETINGS, SAMPLE_TASKS } from './data/sample-workspace.js';
import {
  MeetingStudioPreview,
  PreviewLibrary,
  PreviewOverview,
  PreviewProjects,
  PreviewTasks,
} from './components/PreviewPanels.jsx';

const PAGES = [
  ['overview', 'Overview', LayoutDashboard],
  ['studio', 'Meeting studio', FileAudio],
  ['meetings', 'Meeting library', Clock],
  ['tasks', 'Action items', CheckCircle2],
  ['projects', 'Projects', FolderOpen],
];

const TITLES = {
  overview: ['Workspace overview', 'A little perspective on what comes next.'],
  studio: ['Meeting studio', 'Interactive on-device meeting analysis workspace.'],
  meetings: ['Meeting library', 'Every conversation has a place.'],
  tasks: ['Action items', 'Good ideas deserve a next step.'],
  projects: ['Projects', 'Keep the bigger picture in view.'],
};

const SAMPLE_CHAT_ANSWERS = {
  budget: 'A budget of **$50,000** was approved for targeted social media ad campaigns in Q3, proposed by Speaker A and approved by Speaker B [00:00 - 00:23].',
  john: '**John** is assigned to prepare the complete financial breakdown and report by **Friday afternoon** [00:12 - 00:29].',
  deadline: 'The primary commitment is John’s financial report due by **Friday afternoon** before the social media ad rollout begins.',
  default: 'In this Q3 budget review, the team locked in a **$50,000** social ad budget and tasked John with finalizing the financial model by Friday afternoon.',
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

  // Floating Command Center State (Interactive RAG Chat)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content:
        '👋 **Welcome to Clarion AI Meeting Intelligence!**\n\nThis sample meeting has **3 transcript segments** and **2 extracted action items**.\n\nAsk a question about deliverables, decisions, or timeline commitments, or click a suggested prompt below.',
      time: 'Just now',
    },
  ]);
  const [isRecordingTooltip, setIsRecordingTooltip] = useState(false);

  const current =
    SAMPLE_MEETINGS.find((m) => m.id === selected) || SAMPLE_MEETINGS[0];

  const browse = (id) => {
    if (typeof id === 'string') setSelected(id);
    navigateEntry('preview', 'studio');
  };

  const handleSendChat = (text) => {
    const userText = (text || chatInput).trim();
    if (!userText) return;
    setChatInput('');

    const newMessages = [
      ...chatMessages,
      { role: 'user', content: userText, time: 'Just now' },
    ];
    setChatMessages(newMessages);

    // Simulated instant local RAG answer
    setTimeout(() => {
      let reply = SAMPLE_CHAT_ANSWERS.default;
      const lower = userText.toLowerCase();
      if (lower.includes('budget') || lower.includes('cost') || lower.includes('$') || lower.includes('money')) {
        reply = SAMPLE_CHAT_ANSWERS.budget;
      } else if (lower.includes('john') || lower.includes('who') || lower.includes('assign')) {
        reply = SAMPLE_CHAT_ANSWERS.john;
      } else if (lower.includes('deadline') || lower.includes('when') || lower.includes('friday') || lower.includes('time')) {
        reply = SAMPLE_CHAT_ANSWERS.deadline;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, time: 'Just now' },
      ]);
    }, 350);
  };

  return (
    <div
      className="preview-workspace min-h-screen bg-slate-50/50 text-slate-900 font-sans flex flex-col md:flex-row"
      data-preview-workspace
    >
      <a
        className="preview-skip sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:p-3 focus:bg-indigo-600 focus:text-white focus:rounded-xl focus:shadow-lg"
        href="#preview-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to preview content
      </a>

      {/* ─── 1. Unified Sidebar (Slate/Zinc Dark Aesthetic matching Sidebar.jsx) ─── */}
      <aside className="preview-sidebar w-full md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col shrink-0 p-4 md:p-5 md:min-h-screen">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
          <a
            className="preview-brand flex items-center gap-2.5 text-xl font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
            href="#/landing"
          >
            <ClarionMark size={24} />
            <span>clarion<span className="text-indigo-400">.</span></span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v2.0
            </span>
          </a>
        </div>

        {/* Preview Mode Badge */}
        <div className="my-4 px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">PREVIEW MODE</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">100% Local</span>
        </div>

        {/* Primary Navigation Items */}
        <nav className="space-y-1.5 flex-1" aria-label="Preview navigation">
          {PAGES.map(([key, label, Icon]) => {
            const isActive = page === key;
            return (
              <a
                key={key}
                href={`#/preview/${key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </div>
                {key === 'meetings' && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {SAMPLE_MEETINGS.length}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Sidebar Footer Callout */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <LockKeyhole className="w-3.5 h-3.5 text-indigo-400" />
              <span>Private & Air-Gapped</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your real account library stays offline. Sample data only.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenWorkspace}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>Open your workspace</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* ─── 2. Main Content View ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="preview-topbar bg-white border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="preview-sample-chip px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
              PREVIEW
            </span>
            <span className="text-xs text-slate-500 font-medium truncate">
              Sample data · No live AI
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#/landing"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to landing</span>
            </a>
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Your workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main
          id="preview-content"
          ref={main}
          tabIndex={-1}
          className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto outline-hidden"
        >
          {/* Eyebrow & Heading Header */}
          <div className="preview-page-title mb-6 space-y-1">
            <span className="preview-eyebrow text-[11px] font-bold uppercase tracking-wider text-indigo-600 font-mono">
              A WORKSPACE WITH ROOM TO THINK
            </span>
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {TITLES[page] ? TITLES[page][0] : 'Workspace overview'}
              </h1>
              <span className="preview-page-note text-xs text-slate-400 font-medium hidden sm:inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Explore freely
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {TITLES[page] ? TITLES[page][1] : 'Sample data'}
            </p>
          </div>

          {/* Section Router */}
          {page === 'overview' && (
            <PreviewOverview
              meetings={SAMPLE_MEETINGS}
              tasks={tasks}
              onBrowse={browse}
              onOpenWorkspace={onOpenWorkspace}
            />
          )}

          {page === 'studio' && (
            <MeetingStudioPreview
              meeting={current}
              tasks={tasks}
              onToggleTask={(id) =>
                setTasks((items) =>
                  items.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
                )
              }
              onOpenWorkspace={onOpenWorkspace}
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
              onOpenWorkspace={onOpenWorkspace}
            />
          )}

          {page === 'tasks' && (
            <PreviewTasks
              tasks={tasks}
              onToggle={(id) =>
                setTasks((items) =>
                  items.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
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

          <footer className="preview-footnote mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            Prepared sample content. Changes reset when you leave the preview.
            Your account data is never loaded here.
          </footer>
        </main>
      </div>

      {/* ─── 3. Floating Frosted-Glass Command Center Dock (Matches CommandCenter.jsx) ─── */}
      <aside aria-label="Preview assistant dock" className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
        {/* Expandable Clarion RAG Chat Drawer */}
        {isChatOpen && (
          <div className="w-[340px] sm:w-[400px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Chat Drawer Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold leading-tight">Clarion Assistant</h3>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    On-Device RAG
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      C
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'bg-slate-100 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span
                      className={`text-[9px] block text-right mt-1 font-mono ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Suggestion Prompt Chips */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleSendChat('What budget was approved for Q3?')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium truncate"
              >
                What budget was approved?
              </button>
              <button
                type="button"
                onClick={() => handleSendChat('Who is assigned to the financial report?')}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium truncate"
              >
                Who is assigned to report?
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Clarion Assistant…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 outline-hidden focus:border-indigo-500 bg-slate-50"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Floating Toggle Buttons (Mic + Chat) */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-2xl">
          {/* Simulated Record Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsRecordingTooltip(true);
                setTimeout(() => setIsRecordingTooltip(false), 3500);
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Record audio (preview)"
            >
              <Mic className="w-4 h-4 text-rose-400" />
            </button>
            {isRecordingTooltip && (
              <div className="absolute bottom-12 right-0 w-60 p-2.5 rounded-xl bg-slate-950 text-white text-[11px] shadow-xl border border-slate-800 animate-in fade-in">
                <span>Microphone requires a signed-in workspace.</span>
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="mt-1.5 block text-indigo-400 font-semibold hover:underline"
                >
                  Sign in to record real audio →
                </button>
              </div>
            )}
          </div>

          {/* Chat Toggle Button */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Clarion Chat</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </button>
        </div>
      </aside>
    </div>
  );
}
