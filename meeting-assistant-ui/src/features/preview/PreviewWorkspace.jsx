import { useRef, useState } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileAudio,
  FolderOpen,
  LayoutDashboard,
  Search,
  Send,
  X,
} from 'lucide-react';
import { ClarionWordmark } from '../../shared/ui/BrandMarks.jsx';
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
      className="preview-workspace min-h-screen bg-slate-50/50 text-slate-900 font-sans flex flex-col w-full"
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

      {/* ─── 1. Exact TopNav Header (Matching Sidebar.jsx & Screenshot 2) ─── */}
      <header
        id="preview-topnav"
        className="clarion-topnav sticky top-0 z-30 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_16px_-10px_rgba(36,49,76,0.12)]"
      >
        <div className="max-w-[1440px] mx-auto h-16 px-4 md:px-6 flex items-center justify-between gap-3">
          {/* Left: Brand + Horizontal Navigation Tabs */}
          <div className="flex items-center gap-5 min-w-0">
            <a
              href="#/landing"
              className="flex items-center gap-2 shrink-0 text-left hover:opacity-85 transition-opacity cursor-pointer"
              title="Go to Product Tour & Landing Page"
            >
              <ClarionWordmark
                markSize={19}
                textSize="text-[18px]"
                showTagline={false}
              />
            </a>

            <span
              className="hidden md:block h-5 w-px bg-slate-200/90 shrink-0"
              aria-hidden="true"
            />

            <nav
              className="clarion-horizontal-nav hidden lg:flex items-center gap-1"
              aria-label="Preview workspace navigation"
            >
              {PAGES.map(([key, label, Icon]) => {
                const isCurrent = page === key;
                return (
                  <a
                    key={key}
                    href={`#/preview/${key}`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ease-out active:scale-[0.98] ${
                      isCurrent
                        ? 'bg-[#e8ecfe] text-[#3c4999] font-semibold shadow-[inset_0_0_0_1px_#d5dcf8]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                    {key === 'meetings' && (
                      <span className="px-1.5 py-0.2 rounded-md bg-slate-200/75 text-slate-700 font-mono tabular-nums text-[10px]">
                        {SAMPLE_MEETINGS.length}
                      </span>
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Search, User Profile Pill, Your Workspace CTA */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Search meetings input */}
            <div className="relative hidden xl:flex items-center bg-slate-50/90 hover:bg-slate-100 border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-600 transition-colors">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search meetings"
                aria-label="Search meetings in preview"
                className="w-24 lg:w-32 bg-transparent outline-hidden text-xs text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* Anonymous Demo User Profile Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={onOpenWorkspace}
                aria-label="Account profile menu"
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/75 border border-slate-200/90 text-slate-800 text-xs font-medium transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
                title="Demo User account (Click to sign in to real workspace)"
              >
                <span className="w-7 h-7 rounded-full bg-[#303c63] text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  D
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate font-semibold text-slate-800">
                  Demo User
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {/* Back to landing */}
            <a
              href="#/landing"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              Back to landing
            </a>

            {/* Primary Workspace CTA */}
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <span>Your workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1 px-4 py-2 border-t border-slate-100 overflow-x-auto scrollbar-none bg-slate-50/50">
          {PAGES.map(([key, label, Icon]) => {
            const isCurrent = page === key;
            return (
              <a
                key={key}
                href={`#/preview/${key}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                  isCurrent
                    ? 'bg-[#e8ecfe] text-[#3c4999] font-semibold'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      </header>

      {/* ─── 2. Main Page Content View ─── */}
      <main
        id="preview-content"
        ref={main}
        tabIndex={-1}
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 py-6 md:py-8 outline-hidden"
      >
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

      {/* ─── 3. Floating Bottom-Right Circular Button (Exact match to Screenshot 2) ─── */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          aria-label="Clarion AI Assistant"
          title="Clarion AI Assistant"
          className="w-12 h-12 rounded-full bg-[#1b254b] hover:bg-[#283769] text-white flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95 cursor-pointer group"
        >
          <AudioLines className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Expandable Clarion RAG Chat Drawer */}
      {isChatOpen && (
        <aside
          aria-label="Clarion AI Assistant drawer"
          className="fixed bottom-20 right-6 z-50 w-[340px] sm:w-[400px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
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
        </aside>
      )}
    </div>
  );
}
