import { useState, useRef } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileAudio,
  FileText,
  LayoutGrid,
  List,
  ListTodo,
  Play,
  Pause,
  Plus,
  Quote,
  Radio,
  Search,
  Share2,
  Sparkles,
  Users,
  Volume2,
  X,
} from 'lucide-react';

const SPEAKER_AVATARS = {
  'Speaker A': { bg: 'bg-blue-600 text-white shadow-blue-500/25', label: 'Speaker A' },
  'Speaker B': { bg: 'bg-emerald-600 text-white shadow-emerald-500/25', label: 'Speaker B' },
  'Lan': { bg: 'bg-teal-600 text-white shadow-teal-500/25', label: 'Lan' },
  'Minh': { bg: 'bg-purple-600 text-white shadow-purple-500/25', label: 'Minh' },
  'An': { bg: 'bg-amber-600 text-white shadow-amber-500/25', label: 'An' },
  'Linh': { bg: 'bg-pink-600 text-white shadow-pink-500/25', label: 'Linh' },
};

/**
 * 1:1 Redline Meeting Card (matching Screenshot 2 & Overview.jsx)
 */
export function RedlinePreviewCard({ meeting, onOpen }) {
  const initials = (meeting.title || 'ME')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'ME';

  const taskCount = Array.isArray(meeting.action_items) ? meeting.action_items.length : 1;
  const summaryText = Array.isArray(meeting.summary) ? meeting.summary[0] : (meeting.summary || '');

  return (
    <div className="h-full">
      <button
        type="button"
        onClick={() => onOpen(meeting.id)}
        aria-label={`Open meeting ${meeting.title}`}
        title={meeting.title}
        className="w-full h-full p-5 rounded-2xl bg-white hover:bg-slate-50/80 active:scale-[0.985] border border-slate-200/90 border-t-4 border-t-[#3c4999] shadow-xs hover:shadow-md transition-all duration-200 ease-out flex flex-col justify-between text-left cursor-pointer group relative"
      >
        <div className="space-y-3 w-full">
          {/* Header Row: Initials Avatar + Title & Time */}
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#e8ecfe] text-[#3c4999] font-bold text-xs flex items-center justify-center shrink-0 border border-[#d5dcf8]">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <h3
                className="text-sm font-semibold text-slate-900 group-hover:text-[#3c4999] transition-colors truncate tracking-tight"
                title={meeting.title}
              >
                {meeting.title}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                {meeting.date || 'Saved meeting'}
              </p>
            </div>
            {meeting.language && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                {meeting.language}
              </span>
            )}
          </div>

          {/* Executive Summary Snippet */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {summaryText}
          </p>
        </div>

        {/* Footer: Duration, Task Count & Open Action */}
        <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 w-full">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {meeting.duration}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono tabular-nums text-[11px] font-medium">
              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3c4999] group-hover:translate-x-0.5 transition-all">
            <span>Open</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    </div>
  );
}

/**
 * 1:1 Overview Page Layout (matching Screenshot 2 & Overview.jsx)
 */
export function PreviewOverview({ meetings, tasks, onBrowse, onOpenWorkspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const done = tasks.filter((t) => t.done).length;
  const pending = tasks.length - done;
  const completionRate = Math.round((done / (tasks.length || 1)) * 100);

  const filteredMeetings = meetings.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (m.title && m.title.toLowerCase().includes(q));
    const summaryMatch = (Array.isArray(m.summary) ? m.summary.join(' ') : (m.summary || '')).toLowerCase().includes(q);
    return titleMatch || summaryMatch;
  });

  return (
    <div className="clarion-overview relative space-y-7 max-w-[1400px] mx-auto pb-16">
      <span className="sr-only">Workspace overview - Sample data</span>

      {/* 1. Header Greeting (EXACT 1:1 MATCH to Screenshot 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Good morning, <span className="text-[#3c4999]">Demo User</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            <span className="sr-only">Workspace overview - </span>
            You have <strong className="text-slate-800">{meetings.length}</strong> saved meetings and{' '}
            <strong className="text-slate-800">{pending}</strong> pending action items in your workspace.
            <span className="ml-2 text-slate-400 text-xs font-medium">· Sample data</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-[#3c4999] hover:bg-indigo-100 transition-colors shrink-0"
        >
          <span className="w-2 h-2 rounded-full bg-[#3c4999] animate-pulse" />
          <span>Preview Mode (Click to Sign in)</span>
        </button>
      </div>

      {/* 2. Three Horizontal KPI Cards (EXACT 1:1 MATCH to Screenshot 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Saved Meetings */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all duration-200 ease-out">
          <div className="w-12 h-12 rounded-xl bg-[#e8ecfe] border border-[#d5dcf8] flex items-center justify-center shrink-0 text-[#3c4999]">
            <AudioLines className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums font-mono">
              {meetings.length}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Saved Meetings</p>
          </div>
        </div>

        {/* Card 2: Pending Tasks */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all duration-200 ease-out">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-amber-700 tracking-tight tabular-nums font-mono">
              {pending}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Pending Tasks</p>
          </div>
        </div>

        {/* Card 3: Completed Tasks */}
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all duration-200 ease-out">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold text-emerald-700 tracking-tight tabular-nums font-mono">
                {done}
              </p>
              <span className="text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                ({completionRate}%)
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Completed Tasks</p>
          </div>
        </div>
      </div>

      {/* 3. Section Toolbar (EXACT 1:1 MATCH to Screenshot 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Meeting List</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-mono tabular-nums">
            {filteredMeetings.length} {filteredMeetings.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Inline Meeting Search */}
          <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus-within:ring-2 focus-within:ring-[#3c4999]/20 focus-within:border-[#3c4999] transition-all duration-200 ease-out w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings..."
              className="w-full bg-transparent outline-hidden text-xs text-slate-800 placeholder-slate-400"
              aria-label="Search meetings in list"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 ml-1 transition-colors"
                aria-label="Clear meeting search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-slate-600 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg active:scale-[0.96] transition-all duration-150 ease-out cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#3c4999] text-white shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg active:scale-[0.96] transition-all duration-150 ease-out cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#3c4999] text-white shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
              title="List view"
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary CTA Button: + New Meeting */}
          <button
            type="button"
            onClick={onOpenWorkspace}
            aria-label="Start new meeting"
            title="Start new meeting"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white text-xs font-semibold shadow-xs transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Meeting</span>
          </button>
        </div>
      </div>

      {/* 4. Main Meeting Cards / Empty State matching Screenshot 2 */}
      {filteredMeetings.length === 0 ? (
        <div className="py-14 text-center space-y-3 bg-white/60 border border-dashed border-slate-200 rounded-3xl p-8">
          <FileAudio className="w-10 h-10 mx-auto text-slate-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              {searchQuery
                ? 'No meetings match your search query.'
                : 'No recorded meetings yet.'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : 'Click + New Meeting to record or upload an audio file and generate structured notes.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3c4999] text-white text-xs font-semibold shadow-xs hover:bg-[#303c7e] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Record or Upload Audio</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting) => (
            <RedlinePreviewCard
              key={meeting.id}
              meeting={meeting}
              onOpen={onBrowse}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeetings.map((meeting) => (
            <RedlinePreviewCard
              key={meeting.id}
              meeting={meeting}
              onOpen={onBrowse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 1:1 Meeting Studio Component (matching DocumentWorkspace.jsx)
 */
export function MeetingStudioPreview({
  meeting,
  tasks,
  onToggleTask,
  onOpenWorkspace,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const audioRef = useRef(null);
  const transcriptRef = useRef(null);

  const duration = meeting.raw_duration || 29.05;

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleSummaryHover = (sourceIndex) => {
    setHoveredSegment(sourceIndex);
  };

  const handleSummaryClick = (sourceIndex) => {
    const turns = meeting.turns || [];
    const turn = turns[sourceIndex] || turns[0];
    if (turn) {
      handleSeek(turn.start);
      if (transcriptRef.current) {
        const el = transcriptRef.current.querySelector(`[data-segment="${sourceIndex}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const formatClock = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleCopySummary = () => {
    const text = Array.isArray(meeting.summary) ? meeting.summary.join('\n') : meeting.summary;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTurns = (meeting.turns || []).filter((turn) => {
    const matchesSpeaker = selectedSpeaker === 'all' || turn.speaker.toLowerCase().includes(selectedSpeaker.toLowerCase());
    const matchesQuery = !searchQuery || turn.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpeaker && matchesQuery;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16" aria-label="Sample meeting detail">
      {meeting.audio && (
        <audio
          ref={audioRef}
          src={meeting.audio}
          preload="none"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Processed
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {meeting.id}</span>
            <span className="text-xs text-slate-500 font-medium">· {meeting.project}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {meeting.title}
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            {meeting.date || 'Today, 10:30 AM'} · Duration: {meeting.duration} · Language: {meeting.language?.toUpperCase() || 'EN'}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            {copied ? 'Copied' : 'Copy Summary'}
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            Share LAN
          </button>

          <button
            type="button"
            onClick={onOpenWorkspace}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white shadow-xs transition-colors"
          >
            <span>Open in App</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Audio Waveform Scrubbing Bar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 text-white shadow-md">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause sample audio' : 'Play sample audio'}
            className="w-10 h-10 rounded-xl bg-[#3c4999] hover:bg-[#4a5ab8] text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md shadow-[#3c4999]/20 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{formatClock(currentTime)}</span>
              <span>{formatClock(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={currentTime}
              aria-label="Sample audio seeker"
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#6370ce]"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* 3. Main 2-Column Document Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Executive Synthesis, Decisions, Action Items, Speakers */}
        <div className="lg:col-span-7 space-y-6">
          {/* Executive Summary with Bi-Directional Linking */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-[#e8ecfe] text-[#3c4999]">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Executive Summary</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">Hover bullet to link transcript</span>
            </div>

            <ul className="space-y-2.5">
              {(Array.isArray(meeting.summary) ? meeting.summary : [meeting.summary]).map((bullet, idx) => (
                <li
                  key={idx}
                  onMouseEnter={() => handleSummaryHover(idx)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => handleSummaryClick(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs md:text-sm leading-relaxed ${
                    hoveredSegment === idx
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-xs'
                      : 'bg-slate-50/50 border-slate-200/70 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3c4999] mt-2 shrink-0" />
                    <span>{bullet}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Decisions Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Quote className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Key Decisions</h3>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/80 text-emerald-950 text-xs md:text-sm">
              <p className="font-semibold text-emerald-900 mb-1">
                {meeting.decisions?.[0]?.text || meeting.decision}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-mono mt-2">
                <span>Confidence: 96%</span>
                <span>·</span>
                <span>Source: Speaker B [00:12]</span>
              </div>
            </div>
          </div>

          {/* Action Deliverables Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <ListTodo className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Action Deliverables</h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {tasks.filter((t) => t.done).length} / {tasks.length} Completed
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                    task.done ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => onToggleTask(task.id)}
                      className="w-4 h-4 rounded-md border-slate-300 text-[#3c4999] focus:ring-[#3c4999] cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.task}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span className="text-slate-600 font-sans font-semibold">{task.owner}</span>
                        <span>·</span>
                        <span>Due {task.due}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      task.done
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {task.done ? 'Done' : 'To do'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Speaker Profiles & Voiceprint Confidence */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Users className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Speaker Identification & Voiceprints
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(meeting.speaker_profiles || [
                { name: 'Speaker A (Marketing)', voiceprint_id: 'vp_a108', confidence: 0.96 },
                { name: 'Speaker B (John - Finance)', voiceprint_id: 'vp_b204', confidence: 0.92 },
              ]).map((profile, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-slate-900 block font-semibold">{profile.name}</strong>
                    <span className="text-[11px] text-slate-400 font-mono">{profile.voiceprint_id}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[10px] font-bold">
                    {Math.round(profile.confidence * 100)}% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Searchable Transcript with Time-seeking */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Interactive Transcript</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{filteredTurns.length} turns</span>
            </div>

            {/* Transcript Search & Filter Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter spoken words…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-hidden focus:border-[#3c4999] bg-slate-50/60"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                {['all', 'Speaker A', 'Speaker B'].map((spk) => (
                  <button
                    key={spk}
                    type="button"
                    onClick={() => setSelectedSpeaker(spk)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      selectedSpeaker === spk
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {spk === 'all' ? 'All Speakers' : spk}
                  </button>
                ))}
              </div>
            </div>

            {/* Turn-by-Turn Utterance List */}
            <div ref={transcriptRef} className="space-y-3 flex-1 overflow-y-auto max-h-[620px] pr-1">
              {filteredTurns.map((turn, idx) => {
                const isActive = currentTime >= turn.start && currentTime <= turn.end;
                const isHovered = hoveredSegment !== null && (hoveredSegment === idx || (idx === 1 && hoveredSegment === 1));
                const avatar = SPEAKER_AVATARS[turn.speaker] || { bg: 'bg-slate-600 text-white', label: turn.speaker };

                return (
                  <div
                    key={idx}
                    data-segment={idx}
                    onClick={() => handleSeek(turn.start)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                      isActive
                        ? 'bg-indigo-50/90 border-[#3c4999] shadow-xs ring-1 ring-[#3c4999]'
                        : isHovered
                        ? 'bg-amber-50/80 border-amber-300 shadow-xs ring-1 ring-amber-300'
                        : 'bg-slate-50/40 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${avatar.bg}`}>
                          {turn.initial || turn.speaker.slice(0, 1)}
                        </span>
                        <strong className="text-slate-900 font-semibold">{turn.speaker}</strong>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                        {formatClock(turn.start)} - {formatClock(turn.end)}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed pl-7">
                      {turn.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* LAN Share Modal Simulation */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Share2 className="w-5 h-5" />
                </span>
                <h3 className="text-base font-bold text-slate-900">Share to Local Network</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Anyone connected to your local Wi-Fi / LAN can view this read-only meeting minute securely without cloud upload:
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-indigo-700 break-all select-all">
              http://192.168.1.50:8000/share/sample_token_8a92f1b4c92e7d
            </div>

            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-32 h-32 mx-auto bg-white border border-slate-300 rounded-lg flex items-center justify-center shadow-xs">
                <Radio className="w-16 h-16 text-indigo-600 animate-pulse" />
              </div>
              <span className="text-[11px] text-slate-500 font-medium block mt-2">
                Scan with phone camera on same Wi-Fi
              </span>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('http://192.168.1.50:8000/share/sample_token_8a92f1b4c92e7d');
                  setShowShareModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#303c63] text-white font-semibold hover:bg-[#40507b]"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewLibrary({
  meetings,
  tasks,
  selected,
  onSelect,
  query,
  onQuery,
  onOpenWorkspace,
}) {
  const filtered = meetings.filter((m) =>
    `${m.title} ${m.project}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Search Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Meeting library</h2>
          <p className="text-xs text-slate-500">Q3 budget review and sample enterprise meetings.</p>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search meetings or projects…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-hidden focus:border-[#3c4999] bg-slate-50/50"
          />
        </div>
      </div>

      {/* Grid of Meeting Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-2 ${
              selected.id === m.id
                ? 'bg-indigo-50/80 border-[#3c4999] ring-2 ring-[#3c4999] shadow-xs'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>{m.duration}</span>
              <span className="font-semibold text-[#3c4999]">{m.project}</span>
            </div>
            <strong className="text-sm font-bold text-slate-900 block truncate">
              {m.title}
            </strong>
            <p className="text-xs text-slate-600 line-clamp-2">
              {Array.isArray(m.summary) ? m.summary[0] : m.summary}
            </p>
          </button>
        ))}
      </div>

      {/* Selected Meeting Document Studio View */}
      <div className="pt-4 border-t border-slate-200">
        <MeetingStudioPreview
          meeting={selected}
          tasks={tasks}
          onToggleTask={() => {}}
          onOpenWorkspace={onOpenWorkspace}
        />
      </div>
    </div>
  );
}

export function PreviewTasks({ tasks, onToggle }) {
  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'done') return t.done;
    if (filter === 'todo') return !t.done;
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Action items</h2>
          <p className="text-xs text-slate-500">
            A little momentum goes a long way. Checkboxes update the preview in real-time.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {['all', 'todo', 'done'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'todo' ? 'To do' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredTasks.map((task) => (
          <label
            key={task.id}
            className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${
              task.done ? 'bg-slate-50/50' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggle(task.id)}
                className="w-4 h-4 rounded-md border-slate-300 text-[#3c4999] focus:ring-[#3c4999] cursor-pointer"
              />
              <div className="min-w-0">
                <span className={`text-sm font-semibold block truncate ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                  {task.task}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Owner: {task.owner} · Due: {task.due}
                </span>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                task.done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {task.done ? 'Completed' : 'To do'}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PreviewProjects({ meetings, tasks, onBrowse }) {
  const projects = [...new Set(meetings.map((m) => m.project))];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Projects</h2>
        <p className="text-xs text-slate-500 mt-1">
          Keep the bigger picture in view. All meetings grouped by project initiative.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((name) => {
          const projectMeetings = meetings.filter((m) => m.project === name);
          const meetingIds = new Set(projectMeetings.map((m) => m.id));
          const projectTasks = tasks.filter((t) => meetingIds.has(t.meeting));
          const completedTasks = projectTasks.filter((t) => t.done).length;
          const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

          return (
            <div
              key={name}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4 border-t-4 border-t-[#3c4999] flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#e8ecfe] text-[#3c4999] border border-[#d5dcf8] uppercase">
                    Sample Project
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {projectMeetings.length} meetings
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Turn team conversations into structured executive decisions and actionable deliverables.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>Task Momentum</span>
                  <span>{completedTasks}/{projectTasks.length} complete ({progress}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3c4999] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => onBrowse(projectMeetings[0]?.id)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Explore project notes</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
