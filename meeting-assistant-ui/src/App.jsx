import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { normalizeCitation, normalizeChatMessages, createRequestGate, resultFromMeeting, editSpeakerAttribution, getSuggestedPrompts, buildChatPayload, getExportTasks, shouldSubmitChat } from './session';
import Workspace, { WorkspaceDialog } from './Workspace.jsx';
import MeetingEditor from './MeetingEditor.jsx';
import { createMutationLock } from './workspace';
import { DEFAULT_UPLOAD_LIMITS, getUploadLimits, getUploadError, formatUploadLimits, startHealthPolling, buildProcessingQuery } from './upload';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002').replace(/\/$/, '');
import { 
  UploadCloud, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Cpu, 
  ListTodo, 
  FileText, 
  SplitSquareVertical, 
  ShieldCheck, 
  Check, 
  X,
  Clock,
  Layers,
  Zap,
  Database,
  Trash2,
  Search,
  Sliders,
  Volume2,
  FileCode,
  Users,
  Edit2,
  Printer,
  MessageSquare,
  Send,
  AlertTriangle,
  HelpCircle,
  Target,
  Play
} from 'lucide-react';

const SPEAKER_BADGE_STYLES = [
  'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-pink-500/20 text-pink-300 border-pink-500/40',
  'bg-teal-500/20 text-teal-300 border-teal-500/40',
  'bg-orange-500/20 text-orange-300 border-orange-500/40',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
];

const getSpeakerBadgeStyle = (speaker) => {
  if (!speaker) return 'bg-slate-800 text-slate-300 border-slate-700';
  // Deterministic hash so the same speaker always gets the same color,
  // even after LLM rename (e.g. "Speaker 1" → "Alice").
  const s = String(speaker);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return SPEAKER_BADGE_STYLES[hash % SPEAKER_BADGE_STYLES.length];
};

const formatDuration = (secs) => {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getDefaultChatGreeting = (currResult) => {
  if (!currResult) return [];
  if (currResult.chat_history && currResult.chat_history.length > 0) {
    return currResult.chat_history;
  }
  const turnsCount = currResult.segments?.length || 0;
  const itemsCount = currResult.action_items?.length || 0;
  const durText = formatDuration(currResult.duration);
  return [
    {
      role: 'assistant',
      content: `👋 **Welcome to AI Meeting Chat!**\n\nThis meeting${durText ? ` (${durText} duration)` : ''} has **${turnsCount} transcript segments** and **${itemsCount} extracted action items**.\n\nAsk a question about its content or choose a suggestion based on the transcript. Check the source excerpts when reviewing an answer.`,
      citations: [],
      mode: 'assistant',
      created_at: new Date().toISOString()
    }
  ];
};

function App() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState(null);
  const suggestedPrompts = useMemo(() => getSuggestedPrompts(result), [result]);
  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [semanticChat, setSemanticChat] = useState(false);
  const [embeddingModel, setEmbeddingModel] = useState('embeddinggemma');
  const [enableMmr, setEnableMmr] = useState(true);
  const [mmrLambda, setMmrLambda] = useState(0.65);
  const [showAdvancedMmr, setShowAdvancedMmr] = useState(false);
  const [enableDiarization, setEnableDiarization] = useState(true);
  const [numSpeakers, setNumSpeakers] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('all');
  const [mmrTelemetry, setMmrTelemetry] = useState(null);
  const [transcriptView, setTranscriptView] = useState('raw'); // 'raw' | 'segments' | 'mmr'
  const [isCopied, setIsCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'summary' | 'tasks' | 'transcript' | 'insights' | 'chat'
  const [completedTasks, setCompletedTasks] = useState({});
  const [updatingTasks, setUpdatingTasks] = useState({});
  const [healthStatus, setHealthStatus] = useState({ online: false, checking: true });
  const [uploadLimits, setUploadLimits] = useState(DEFAULT_UPLOAD_LIMITS);
  const uploadError = getUploadError(file, uploadLimits);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [spokenLanguage, setSpokenLanguage] = useState('');
  const [metaInfo, setMetaInfo] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [meetingsHistory, setMeetingsHistory] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyError, setHistoryError] = useState(null);
  const [loadingMeetingId, setLoadingMeetingId] = useState(null);
  const [isSpeakerSaving, setIsSpeakerSaving] = useState(false);
  const [speakerRename, setSpeakerRename] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Agent 6 Interactive Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const processGate = useRef(createRequestGate());
  const chatGate = useRef(createRequestGate());
  const historyGate = useRef(createRequestGate());
  const detailGate = useRef(createRequestGate());
  const speakerGate = useRef(createRequestGate());
  const speakerBusy = useRef(false);
  const contentMutations = useRef(createMutationLock());
  const historyQueryRef = useRef('');
  const historyOffsetRef = useRef(0);
  const sessionVersion = useRef(0);
  const audioRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    const process = processGate.current;
    const chat = chatGate.current;
    const history = historyGate.current;
    const detail = detailGate.current;
    const speaker = speakerGate.current;
    return () => { process.cancel(); chat.cancel(); history.cancel(); detail.cancel(); speaker.cancel(); };
  }, []);

  const invalidateSession = (preserveResultMetadata = false) => {
    sessionVersion.current += 1;
    processGate.current.cancel();
    chatGate.current.cancel();
    detailGate.current.cancel();
    speakerGate.current.cancel();
    speakerBusy.current = false;
    contentMutations.current.reset();
    setIsSpeakerSaving(false);
    setSpeakerRename(null);
    setLoadingMeetingId(null);
    setIsProcessing(false);
    setIsChatLoading(false);
    setChatInput('');
    setUpdatingTasks({});
    if (!preserveResultMetadata) { setWarnings([]); setIsDemoResult(false); }
  };

  // Synchronize audio preview URL when file changes
  useEffect(() => {
    if (file && (file instanceof Blob || file instanceof File)) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [file]);

  const fetchMeetingHistory = useCallback(async (query = historyQueryRef.current, offset = historyOffsetRef.current) => {
    const request = historyGate.current.begin();
    historyOffsetRef.current = offset;
    setHistoryOffset(offset);
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams({ q: query, limit: '20', offset: String(offset), compact: 'true' });
      const [resMeetings, resAnalytics] = await Promise.all([
        fetch(`${API_BASE}/api/meetings?${params}`, { signal: request.signal }),
        fetch(`${API_BASE}/api/analytics`, { signal: request.signal }).catch(() => null)
      ]);
      if (!resMeetings.ok) throw new Error('Unable to load meeting history. Please retry.');
      const data = await resMeetings.json();
      if (!request.isCurrent()) return;
      if (offset > 0 && offset >= data.total) return fetchMeetingHistory(query, Math.max(0, offset - 20));
      setMeetingsHistory(data.meetings || []);
      setHistoryTotal(data.total || 0);
      if (resAnalytics && resAnalytics.ok) {
        const dataAnalytics = await resAnalytics.json();
        if (request.isCurrent()) setSystemAnalytics(dataAnalytics.analytics || null);
      }
    } catch (e) {
      if (request.isCurrent()) setHistoryError(e.message || 'Unable to load history.');
    } finally {
      if (request.isCurrent()) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchMeetingHistory(historySearchQuery, 0), 250);
    return () => clearTimeout(timer);
  }, [historySearchQuery, fetchMeetingHistory]);

  const handleHistorySearch = (query) => {
    historyQueryRef.current = query;
    historyGate.current.cancel();
    setLoadingHistory(true);
    setHistorySearchQuery(query);
  };

  const handleCloseHistory = () => {
    detailGate.current.cancel();
    setLoadingMeetingId(null);
    setShowHistory(false);
  };

  const handleLoadPastMeeting = async (entry) => {
    invalidateSession(true);
    const request = detailGate.current.begin();
    setLoadingMeetingId(entry.id);
    let item;
    try {
      const response = await fetch(`${API_BASE}/api/meetings/${entry.id}`, { signal: request.signal });
      if (!response.ok) throw new Error('Unable to open this meeting. It may have been deleted.');
      const data = await response.json();
      if (!request.isCurrent()) return;
      item = data.meeting;
    } catch (error) {
      if (request.isCurrent()) { setHistoryError(error.message); setErrorMessage(error.message); }
      return false;
    } finally {
      if (request.isCurrent()) setLoadingMeetingId(null);
    }
    setFile(null);
    setAudioUrl(null);
    setWarnings([]);
    setIsDemoResult(false);
    const loadedResult = resultFromMeeting(item);
    setResult(loadedResult);
    const loadedChat = loadedResult.chat_history.length > 0 ? loadedResult.chat_history : getDefaultChatGreeting(loadedResult);
    setChatMessages(loadedChat);
    setCurrentMeetingId(item.id);
    setMmrTelemetry(null);
    setTranscriptView(loadedResult.segments.some(segment => segment.speaker) ? 'segments' : 'raw');

    // Populate completed tasks from database status
    const completed = {};
    loadedResult.action_items.forEach((act, idx) => {
      if (act.status === 'completed' || act.status === 'done') {
        completed[idx] = true;
      }
    });
    setCompletedTasks(completed);

    setErrorMessage(null);
    setMetaInfo({
      model: "SQLite Stored Record",
      hardware: `Meeting #${item.id} • ${item.created_at ? new Date(item.created_at).toLocaleString() : 'Saved Record'}`
    });
    setActiveTab('split');
    setSpeakerFilter('all');
    setShowHistory(false);
    return true;
  };

  const handleUpdatedMeeting = (meeting) => {
    invalidateSession(true);
    const updated = resultFromMeeting(meeting);
    setResult(updated);
    setCurrentMeetingId(meeting.id);
    setChatMessages(updated.chat_history.length ? updated.chat_history : getDefaultChatGreeting(updated));
    setCompletedTasks(Object.fromEntries(updated.action_items.map((item, index) => [index, item.status === 'completed' || item.status === 'done'])));
    setMmrTelemetry(null);
    setSpeakerFilter('all');
    setTranscriptView(updated.segments.length ? 'segments' : 'raw');
    setErrorMessage(null);
  };

  const handleDeletePastMeeting = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this meeting record?")) return;
    const version = sessionVersion.current;
    if (loadingMeetingId === id) { detailGate.current.cancel(); setLoadingMeetingId(null); }
    try {
      const res = await fetch(`${API_BASE}/api/meetings/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete meeting (HTTP ${res.status})`);
      }
      setMeetingsHistory(prev => prev.filter(m => m.id !== id));
      if (version === sessionVersion.current && currentMeetingId === id) handleReset();
      await fetchMeetingHistory();
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      setErrorMessage(err.message || "Failed to delete meeting.");
    }
  };

  useEffect(() => startHealthPolling({
    fetchHealth: options => fetch(`${API_BASE}/api/health`, options),
    onHealth: data => {
      setHealthStatus({ online: Boolean(data.ollama_online), checking: false, data });
      setUploadLimits(previous => getUploadLimits(data, previous));
    },
    onFailure: () => setHealthStatus(previous => ({ ...previous, online: false, checking: false })),
  }), []);

  // Timer while processing
  useEffect(() => {
    let timer;
    if (isProcessing) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isProcessing]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles?.length > 0) { handleReset(); setFile(acceptedFiles[0]); }
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
      'video/*': ['.mp4', '.webm', '.mkv']
    },
    maxSize: uploadLimits.maxFileSizeBytes,
    onDropRejected: () => setErrorMessage(`Choose one supported audio/video file up to ${uploadLimits.maxFileSizeMb} MiB.`),
    disabled: isProcessing,
    maxFiles: 1
  });

  const handleProcessAudio = async () => {
    const limitError = getUploadError(file, uploadLimits);
    if (limitError) { setErrorMessage(limitError); return; }
    if (selectedModel === 'instant_demo') {
      return handleInstantDemo();
    }

    if (!file) return;
    invalidateSession();
    const request = processGate.current.begin();
    setIsProcessing(true);
    setResult(null);
    setCurrentMeetingId(null);
    setMmrTelemetry(null);
    setTranscriptView('raw');
    setCompletedTasks({});
    setUpdatingTasks({});
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const query = buildProcessingQuery({ model: selectedModel, language: spokenLanguage,
        enableMmr, mmrLambda, diarize: enableDiarization, numSpeakers });
      const url = `${API_BASE}/api/process-audio?${query}`;
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        signal: request.signal,
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${response.status})`);
      }
      
      const data = await response.json();
      if (!request.isCurrent()) return;
      setIsDemoResult(data.mode === "instant_demo");
      setWarnings(data.warnings || []);
      setResult(data.data);
      const initialChat = (data.data?.chat_history && data.data.chat_history.length > 0)
        ? normalizeChatMessages(data.data.chat_history)
        : getDefaultChatGreeting(data.data);
      setChatMessages(initialChat);
      setCurrentMeetingId(data.meeting_id || null);
      setMmrTelemetry(data.mmr_telemetry || null);
      setMetaInfo({
        model: data.model_used || selectedModel,
        hardware: data.hardware || (healthStatus.data?.gpu || "CPU Mode")
      });
      fetchMeetingHistory();
    } catch (error) {
      if (!request.isCurrent()) return;
      setErrorMessage(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      if (request.isCurrent()) setIsProcessing(false);
    }
  };

  // Fail-safe instant demo handler (Bypasses heavy inference in 50ms)
  const handleInstantDemo = async () => {
    const limitError = getUploadError(file, uploadLimits);
    if (limitError) { setErrorMessage(limitError); return; }
    invalidateSession();
    const request = processGate.current.begin();
    setIsProcessing(true);
    setResult(null);
    setCurrentMeetingId(null);
    setMmrTelemetry(null);
    setTranscriptView('raw');
    setCompletedTasks({});
    setUpdatingTasks({});
    setErrorMessage(null);

    const dummyFile = file || new File(["dummy meeting audio content"], "q3_budget_meeting.mp3", {
      type: "audio/mp3",
    });
    const formData = new FormData();
    formData.append("file", dummyFile);

    try {
      const response = await fetch(`${API_BASE}/api/process-audio?demo_mode=true&mmr_lambda=${mmrLambda}`, {
        method: "POST",
        body: formData,
        signal: request.signal,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Demo mode server error (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (!request.isCurrent()) return;
      setIsDemoResult(data.mode === "instant_demo");
      setWarnings(data.warnings || []);
      setResult(data.data);
      const initialChat = (data.data?.chat_history && data.data.chat_history.length > 0)
        ? normalizeChatMessages(data.data.chat_history)
        : getDefaultChatGreeting(data.data);
      setChatMessages(initialChat);
      setAudioUrl('/q3_product_budget_review.wav');
      setMmrTelemetry(data.mmr_telemetry || {
        applied: true,
        original_sentences: 5,
        selected_sentences: 3,
        original_words: 67,
        filtered_words: 44,
        reduction_percent: 34.3,
        lambda_param: mmrLambda
      });
      setMetaInfo({
        model: "Instant Showcase (Zero Compute)",
        hardware: "Fail-Safe Demo Mode"
      });
    } catch (e) {
      if (!request.isCurrent()) return;
      setErrorMessage(e.message || "Backend not reachable. Please start the FastAPI server on port 8002.");
    } finally {
      if (request.isCurrent()) setIsProcessing(false);
    }
  };

  const handleDemoSample = async () => {
    handleReset();
    const version = sessionVersion.current;
    setSelectedModel('instant_demo');
    try {
      const res = await fetch('/q3_product_budget_review.mp3');
      if (res.ok) {
        const blob = await res.blob();
        const sampleFile = new File([blob], "q3_product_budget_review.mp3", {
          type: "audio/mp3",
        });
        if (version !== sessionVersion.current) return;
        setFile(sampleFile);
        return;
      }
    } catch {
      // Fallback to wav
    }
    try {
      const resWav = await fetch('/sample_meeting_en.wav');
      if (resWav.ok) {
        const blob = await resWav.blob();
        const sampleFile = new File([blob], "q3_product_budget_review.wav", {
          type: "audio/wav",
        });
        if (version !== sessionVersion.current) return;
        setFile(sampleFile);
        return;
      }
    } catch {
      // Fallback
    }
    const mockFile = new File(["sample meeting dummy binary content"], "q3_product_budget_review.mp3", {
      type: "audio/mp3",
    });
    if (version !== sessionVersion.current) return;
    setFile(mockFile);
  };

  const handleReset = () => {
    invalidateSession();
    setFile(null);
    setSpokenLanguage('');
    setAudioUrl(null);
    setResult(null);
    setCurrentMeetingId(null);
    setIsCopied(false);
    setSummaryCopied(false);
    setCompletedTasks({});
    setUpdatingTasks({});
    setMetaInfo(null);
    setMmrTelemetry(null);
    setShowAdvancedMmr(false);
    setActiveTab('split');
    setTranscriptView('raw');
    setSpeakerFilter('all');
    setErrorMessage(null);
    setChatMessages([]);
    setChatInput('');
    setIsChatLoading(false);
  };

  const handleSeekAudio = (seconds) => {
    if (audioRef.current && Number.isFinite(seconds)) {
      audioRef.current.currentTime = Math.max(0, seconds);
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSendChatMessage = async (presetText) => {
    const textToSend = typeof presetText === 'string' ? presetText : chatInput;
    if (!textToSend || !textToSend.trim() || isChatLoading || isSpeakerSaving) return;
    const cleanQ = textToSend.trim();
    const request = chatGate.current.begin();
    setChatInput('');

    const newUserMsg = { role: 'user', content: cleanQ, created_at: new Date().toISOString() };
    setChatMessages(prev => [...prev, newUserMsg]);
    setIsChatLoading(true);

    try {
      let endpoint = `${API_BASE}/api/chat`;
      const payload = buildChatPayload({ question: cleanQ, meetingId: currentMeetingId,
        isDemo: isDemoResult, result, model: selectedModel === 'instant_demo' ? 'auto' : selectedModel,
        semantic: semanticChat, embeddingModel });

      if (currentMeetingId) {
        endpoint = `${API_BASE}/api/meetings/${currentMeetingId}/chat`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: request.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Chat request failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (!request.isCurrent()) return;
      const assistantMsg = {
        role: 'assistant',
        content: String(data.answer ?? ''),
        citations: normalizeChatMessages([{ citations: data.citations }])[0].citations,
        mode: data.mode,
        retrieval_warning: data.retrieval_warning,
        created_at: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Chat error:", err);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, unable to connect to the AI service: ${err.message}. Please verify the FastAPI backend server is running.`,
          citations: [],
          mode: 'error'
        }
      ]);
    } finally {
      if (request.isCurrent()) {
        setIsChatLoading(false);
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleClearChat = async () => {
    if (isSpeakerSaving) return;
    const version = sessionVersion.current;
    const request = chatGate.current.begin();
    setIsChatLoading(true);
    try {
      if (currentMeetingId) {
        const response = await fetch(`${API_BASE}/api/meetings/${currentMeetingId}/chat`, { method: 'DELETE', signal: request.signal });
        if (!response.ok) throw new Error('Could not clear saved chat. Please retry.');
      }
      if (version !== sessionVersion.current || !request.isCurrent()) return;
      setResult(previous => previous ? { ...previous, chat_history: [] } : previous);
      setChatMessages(getDefaultChatGreeting({ ...result, chat_history: [] }));
    } catch (error) {
      if (version === sessionVersion.current && request.isCurrent()) setErrorMessage(error.message);
    } finally {
      if (request.isCurrent()) setIsChatLoading(false);
    }
  };

  const renderFormattedChatText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\[\d{1,3}:\d{2}(?::\d{2})?\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d{1,3}:\d{2}(?::\d{2})?)\]$/);
      if (match) {
        const ts = match[1];
        const sec = normalizeCitation(ts).seconds;
        return (
          <button
            key={i}
            type="button"
            disabled={!audioUrl || sec === null}
            onClick={() => handleSeekAudio(sec)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-mono transition-all font-semibold active:scale-95 cursor-pointer disabled:cursor-default disabled:opacity-60"
            title={!audioUrl ? 'Audio is not available for this meeting' : sec === null ? 'No audio timestamp available' : `Click to jump audio to ${ts}`}
          >
            <Play className="w-2 h-2 text-indigo-400 fill-indigo-400" />
            <span>{ts}</span>
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const toggleTask = async (idx) => {
    if (speakerBusy.current || isSpeakerSaving || Object.values(updatingTasks).some(Boolean)) return;
    const release = contentMutations.current.tryAcquire();
    if (!release) return;
    const isNowDone = !completedTasks[idx];
    const version = sessionVersion.current;
    setUpdatingTasks(prev => ({ ...prev, [idx]: true }));

    try {
      if (currentMeetingId) {
        const response = await fetch(`${API_BASE}/api/meetings/${currentMeetingId}/tasks/${idx}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: isNowDone ? 'completed' : 'pending' })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Failed to save task status (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (version !== sessionVersion.current) return;
        if (data.meeting) { handleUpdatedMeeting(data.meeting); return; }
      }

      if (version !== sessionVersion.current) return;
      setCompletedTasks(prev => ({
        ...prev,
        [idx]: isNowDone
      }));
    } catch (err) {
      if (version !== sessionVersion.current) return;
      console.error("Failed to sync task status to SQLite:", err);
      setErrorMessage(err.message || "Failed to save task status.");
    } finally {
      release();
      if (version === sessionVersion.current) setUpdatingTasks(prev => ({ ...prev, [idx]: false }));
    }
  };

  const getFullMarkdown = () => {
    if (!result) return "";
    const items = result.action_items || [];
    let transcriptBlock = result.transcript || "";
    if (result.segments && result.segments.some(s => s.speaker)) {
      transcriptBlock = result.segments.map(s => `**${s.speaker}** (${s.timestamp || ''}): ${s.text}`).join('\n\n');
    }

    let insightsBlock = "";
    if (result.insights) {
      const decs = (result.insights.decisions || []).map(d => `- **[Decision: ${d.status || 'proposed'}]** ${d.text}${d.timestamp ? ` (${d.timestamp})` : ''}`).join('\n');
      const risks = (result.insights.risks || []).map(r => `- **[Risk]** ${r.text}${r.timestamp ? ` (${r.timestamp})` : ''}`).join('\n');
      const ques = (result.insights.open_questions || []).map(q => `- **[Open Question]** ${q.text}${q.timestamp ? ` (${q.timestamp})` : ''}`).join('\n');
      insightsBlock = `\n\n## KEY DECISIONS & GOVERNANCE INSIGHTS\n### Decisions\n${decs || 'None'}\n\n### Blockers & Delivery Risks\n${risks || 'None'}\n\n### Open Questions\n${ques || 'None'}`;
    }

    return `# MEETING EXECUTIVE SUMMARY\n\n${result.summary || ""}\n\n## ACTION ITEMS\n${items.map((item, idx) => `- [${completedTasks[idx] ? 'x' : ' '}] ${item.task || ""} (Assignee: ${item.assignee || "Unassigned"}${item.deadline ? `, Deadline: ${item.deadline}` : ''})`).join('\n')}${insightsBlock}\n\n## CONVERSATIONAL TRANSCRIPT\n${transcriptBlock}`;
  };

  const handleCopyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(getFullMarkdown()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }).catch((err) => {
      console.error("Clipboard copy failed:", err);
    });
  };

  const handleCopySummary = (e) => {
    e?.stopPropagation();
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000);
    }).catch((err) => {
      console.error("Clipboard copy summary failed:", err);
    });
  };

  const applySpeakerEdit = async (oldName, newName, segmentIndex = null) => {
    if (!result || speakerBusy.current || isSpeakerSaving || Object.values(updatingTasks).some(Boolean)) return;
    if (!newName.trim() || newName.length > 128 || [...newName].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      setErrorMessage('Use a speaker name with 1–128 characters and no line breaks.');
      return;
    }
    const release = contentMutations.current.tryAcquire();
    if (!release) return;
    const request = speakerGate.current.begin();
    speakerBusy.current = true;
    setIsSpeakerSaving(true);
    chatGate.current.cancel();
    setIsChatLoading(false);
    try {
      let updated;
      if (currentMeetingId) {
        const response = await fetch(`${API_BASE}/api/meetings/${currentMeetingId}/speakers`, {
          method: 'PATCH', signal: request.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_name: oldName, new_name: newName.trim(), segment_index: segmentIndex }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Speaker edit could not be saved.');
        if (!request.isCurrent()) return;
        updated = { ...result, ...resultFromMeeting(data.meeting) };
      } else {
        updated = editSpeakerAttribution({ ...result, chat_history: chatMessages }, oldName, newName.trim(), segmentIndex);
      }
      if (!request.isCurrent()) return;
      setResult(updated);
      setTranscriptView('segments');
      setChatMessages(updated.chat_history.length ? updated.chat_history : getDefaultChatGreeting(updated));
      if (speakerFilter === oldName) setSpeakerFilter(newName.trim());
      return true;
    } catch (error) {
      if (request.isCurrent()) setErrorMessage(error.message || 'Speaker edit could not be saved.');
    } finally {
      release();
      if (request.isCurrent()) { speakerBusy.current = false; setIsSpeakerSaving(false); }
    }
  };

  const handleRenameSpeaker = (oldName) => {
    if (!oldName || !result || contentMutations.current.isLocked() || isSpeakerSaving || Object.values(updatingTasks).some(Boolean)) return;
    setErrorMessage(null);
    setSpeakerRename({ oldName, name: oldName });
  };

  const handleCycleSpeaker = (segmentIdx) => {
    if (!result || !result.segments || !result.segments[segmentIdx] || contentMutations.current.isLocked() || isSpeakerSaving || Object.values(updatingTasks).some(Boolean)) return;
    const currentSpk = result.segments[segmentIdx].speaker;
    const speakersList = (result.speakers && result.speakers.length > 0)
      ? result.speakers
      : ['Speaker 1', 'Speaker 2'];
    
    const currIdx = speakersList.indexOf(currentSpk);
    const nextSpk = speakersList[(currIdx + 1) % speakersList.length];
    if (nextSpk === currentSpk) return;

    applySpeakerEdit(currentSpk, nextSpk, segmentIdx);
  };

  const handleDownloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([getFullMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-summary-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const exportData = {
      meeting_id: currentMeetingId,
      date: new Date().toISOString(),
      metadata: metaInfo,
      mmr_telemetry: mmrTelemetry,
      summary: result.summary,
      action_items: getExportTasks(result.action_items || [], completedTasks),
      transcript: result.transcript,
      condensed_transcript: result.condensed_transcript,
      duration: result.duration,
      language: result.language,
      segments: result.segments,
      insights: result.insights,
      chat_history: chatMessages,
      warnings,
      demo_mode: isDemoResult
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    if (!result) return;
    const items = result.action_items || [];
    const textContent = `=====================================================
MEETING EXECUTIVE SUMMARY
=====================================================
${result.summary || ""}

=====================================================
ACTION DELIVERABLES
=====================================================
${items.map((it, idx) => `[${completedTasks[idx] ? 'DONE' : 'PENDING'}] ${it.task} | Owner: ${it.assignee || 'Unassigned'}${it.deadline ? ` | Due: ${it.deadline}` : ''}`).join('\n')}

=====================================================
CONVERSATIONAL TRANSCRIPT
=====================================================
${result.transcript || ""}
`;
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const wordCount = result?.transcript ? result.transcript.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadTime = Math.ceil(wordCount / 200);
  const totalTasks = result?.action_items?.length || 0;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const completionPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const filteredMeetings = meetingsHistory;
  const isContentSaving = isSpeakerSaving || Object.values(updatingTasks).some(Boolean);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans bg-grid-pattern">
      {speakerRename && (
        <WorkspaceDialog title={`Rename ${speakerRename.oldName}`} maxWidth="max-w-sm" onClose={() => { if (!isSpeakerSaving) setSpeakerRename(null); }}>
          <form className="space-y-4 pt-4" onSubmit={async event => {
            event.preventDefault();
            if (contentMutations.current.isLocked() || isContentSaving) return;
            if (await applySpeakerEdit(speakerRename.oldName, speakerRename.name)) setSpeakerRename(null);
          }}>
            <label htmlFor="speaker-rename-input" className="block text-sm text-slate-300">New speaker name</label>
            <input id="speaker-rename-input" autoFocus maxLength={128} value={speakerRename.name} onChange={event => setSpeakerRename(previous => ({ ...previous, name: event.target.value }))} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white" disabled={isContentSaving} />
            {errorMessage && <p role="alert" className="text-sm text-rose-300">{errorMessage}</p>}
            <div className="flex justify-end gap-3 text-sm">
              <button type="button" disabled={isSpeakerSaving} onClick={() => setSpeakerRename(null)}>Cancel</button>
              <button type="submit" disabled={isContentSaving || !speakerRename.name.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 disabled:opacity-40">{isSpeakerSaving ? 'Saving…' : 'Save speaker name'}</button>
            </div>
          </form>
        </WorkspaceDialog>
      )}
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-blue-600/20 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[400px] bg-purple-700/10 blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Navbar / Top Bar */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-800/80 shadow-2xl shadow-indigo-950/20">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">AI Meeting Assistant</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Orchestrator v2.1
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local multi-agent intelligence powered by Whisper & Llama 3 Map-Reduce
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            
            {/* Model Profile Switcher */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs shadow-sm">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                aria-label="Processing model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-medium"
              >
                <option value="auto" className="bg-slate-900 text-slate-200">🤖 Auto (Adaptive)</option>
                <option value="llama3" className="bg-slate-900 text-slate-200">🚀 Llama 3 (8B - GPU)</option>
                <option value="llama3.2:3b" className="bg-slate-900 text-slate-200">⚡ Llama 3.2 (3B - Fast CPU)</option>
                <option value="llama3.2:1b" className="bg-slate-900 text-slate-200">🪶 Llama 3.2 (1B - Ultra Light)</option>
                <option value="instant_demo" className="bg-slate-900 text-slate-200">🎯 Instant Demo (No Model Inference)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              Spoken language
              <select value={spokenLanguage} onChange={event => setSpokenLanguage(event.target.value)}
                disabled={isProcessing || selectedModel === 'instant_demo'}
                className="bg-slate-900 text-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50">
                <option value="">Auto</option>
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>

            {/* MMR Redundancy Filter Toggle & Tuning Trigger */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setEnableMmr(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl border text-xs font-medium transition-all shadow-sm ${
                  enableMmr 
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/30' 
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
                title="Maximal Marginal Relevance (MMR) Redundancy Filter Algorithm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${enableMmr ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">MMR</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                  enableMmr ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {enableMmr ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedMmr(prev => !prev)}
                className={`px-2 py-1.5 rounded-r-xl border border-l-0 text-xs font-medium transition-all ${
                  showAdvancedMmr 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-300'
                }`}
                title="Configure MMR λ hyperparameter"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speaker Diarization Toggle */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setEnableDiarization(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${enableDiarization ? 'rounded-l-xl' : 'rounded-xl'} border text-xs font-semibold transition-all ${
                  enableDiarization 
                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-200 hover:bg-purple-600/30' 
                    : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
                title="Speaker Diarization (Agent 1: Identify distinct speakers)"
              >
                <Users className={`w-3.5 h-3.5 ${enableDiarization ? 'text-purple-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">Diarize</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                  enableDiarization ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {enableDiarization ? 'ON' : 'OFF'}
                </span>
              </button>
              {enableDiarization && (
                <select
                  value={numSpeakers}
                  onChange={(e) => setNumSpeakers(e.target.value)}
                  className="bg-slate-800/90 text-slate-300 border border-l-0 border-purple-500/50 rounded-r-xl px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-purple-400"
                  title="Expected speakers (Auto / 2 / 3 / 4)"
                >
                  <option value="">Auto</option>
                  <option value="2">2 Spk</option>
                  <option value="3">3 Spk</option>
                  <option value="4">4 Spk</option>
                </select>
              )}
            </div>

            {/* Health Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
              <span className={`w-2 h-2 rounded-full ${healthStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300 font-medium">
                {healthStatus.checking 
                  ? 'Checking...' 
                  : healthStatus.online 
                    ? `Llama 3 (${healthStatus.data?.gpu || 'GPU Ready'})` 
                    : 'Ollama Offline'}
              </span>
            </div>

            {/* Database History Button */}
            <button type="button" onClick={() => setShowWorkspace(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-300 hover:text-white">
              <ListTodo className="w-3.5 h-3.5 text-indigo-400" /> Workspace
            </button>
            <button
              onClick={() => { setShowHistory(true); fetchMeetingHistory(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all shadow-sm"
              title="View SQLite saved meetings"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>History</span>
              {historyTotal > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold">
                  {historyTotal}
                </span>
              )}
            </button>

            {/* Reset / New Meeting */}
            {result && !isProcessing && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Meeting
              </button>
            )}

            <button 
              onClick={handleProcessAudio}
              disabled={Boolean(uploadError) || (!file && selectedModel !== 'instant_demo') || isProcessing}
              className={`px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-2
                ${uploadError || (!file && selectedModel !== 'instant_demo') || isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40' 
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:opacity-95 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98]'}`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Start Processing
                </>
              )}
            </button>
          </div>
        </header>

        {/* Advanced MMR Hyperparameter Slider Panel */}
        {showAdvancedMmr && (
          <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md animate-in fade-in duration-150 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  MMR Hyperparameter Tuning: Relevance vs Diversity
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                λ = {mmrLambda.toFixed(2)}
              </span>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Maximum Diversity (λ = 0.1)</span>
                <span>Balanced Default (λ = 0.65)</span>
                <span>Maximum Centroid Relevance (λ = 0.9)</span>
              </div>
              <input 
                type="range"
                aria-label="MMR relevance and diversity balance"
                min="0.10"
                max="0.90"
                step="0.05"
                value={mmrLambda}
                onChange={(e) => setMmrLambda(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                Formula: <code className="text-indigo-300 font-mono">MMR(s) = λ·Sim₁(s, Q) - (1-λ)·max Sim₂(s, s_j)</code>. 
                Higher λ preserves sentences closest to the central meeting theme; lower λ penalizes repetition and extracts broader conversational variety.
              </p>
            </div>
          </div>
        )}

        {/* Ollama Offline Warning Banner */}
        {!healthStatus.checking && !healthStatus.online && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            <span className="text-amber-400 text-base leading-none mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-amber-300">Ollama AI Engine Offline</p>
              <p className="text-amber-400/80 mt-0.5">
                Llama 3 is not running. Open a terminal and run:{" "}
                <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono">ollama run llama3.2:1b</code>
                {" "}— or use <strong>Instant Demo</strong> mode to bypass AI inference entirely.
              </p>
            </div>
          </div>
        )}

        {/* Inline Error Banner */}
        {(uploadError || errorMessage) && (
          <div role="alert" className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="text-rose-400 text-base leading-none mt-0.5">✕</span>
              <div>
                <p className="font-semibold text-rose-300">Processing Error</p>
                <p className="text-rose-400/80 mt-0.5">{uploadError || errorMessage}</p>
              </div>
            </div>
            <button
              aria-label="Dismiss error"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-300 transition-colors shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Hero Section (When no active result and not processing) */}
        {!isProcessing && !result && (
          <div className="space-y-6">
            <div 
              {...getRootProps({ role: 'button', 'aria-label': 'Choose meeting audio or video file' })}
              className={`relative group rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden
                ${isDragActive 
                  ? 'border-indigo-400 bg-indigo-950/30' 
                  : file 
                    ? 'border-emerald-500/50 bg-slate-900/60 hover:border-emerald-400' 
                    : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-slate-900/70'}`}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center gap-5 relative z-10">
                {file ? (
                  <div className="flex flex-col items-center gap-3 w-full max-w-md">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-inner shadow-emerald-500/10">
                      <FileAudio className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white truncate max-w-sm">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatFileSize(file.size)} • {uploadError ? 'Exceeds upload limit' : 'Ready to analyze'}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatUploadLimits(uploadLimits)}</p>
                    </div>

                    {/* Inline HTML5 Audio Player for preview */}
                    {audioUrl && (
                      <div className="w-full pt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Preview Audio File:</span>
                        </div>
                        <audio 
                          controls 
                          src={audioUrl} 
                          className="w-full h-9 rounded-xl bg-slate-950/80 border border-slate-700/60"
                        />
                      </div>
                    )}

                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                      className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 transition-colors"
                    >
                      <X className="w-3 h-3" /> Change File
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-5 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl shadow-inner shadow-indigo-500/5 group-hover:scale-105 transition-transform duration-300">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-100">
                        Drag and drop your meeting audio or video here
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        or click anywhere to browse from your device ({formatUploadLimits(uploadLimits)})
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-center items-center gap-2 mt-1">
                      {['.MP3', '.WAV', '.M4A', '.OGG', '.FLAC', '.MP4', '.WEBM', '.MKV'].map((ext) => (
                        <span key={ext} className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Feature Highlights & Demo Option */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-sm">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Local Inference</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Runs on local Llama 3 via Ollama. No proprietary meeting data leaves your machine.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-sm">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Map-Reduce Chunking</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Overlapping chunks handle long transcripts. Processing time depends on your hardware.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-sm">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-200">Sample Meeting</h3>
                    <button
                      type="button"
                      onClick={handleDemoSample}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
                    >
                      Load Sample File
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click to auto-load a mock Q3 budget meeting audio sample.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing State (Interactive Stepper with Fail-Safe Skip Button) */}
        {isProcessing && (
          <div className="py-14 flex flex-col items-center justify-center space-y-6 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full bg-indigo-500/15 blur-xl animate-pulse -z-10" />
            </div>

            <div className="text-center space-y-2 max-w-md px-4">
              <h3 className="text-lg font-bold text-white">Transcribing & Analyzing Meeting</h3>
              <p className="text-xs text-slate-400">
                Executing multi-agent pipeline with {selectedModel === 'auto' ? 'adaptive Llama model' : selectedModel}...
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono mt-1">
                <Clock className="w-3 h-3" /> Elapsed: {elapsedTime}s
              </div>
            </div>

            {/* Multi-step progress pills */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pt-1">
              <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Ingested</span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1 text-indigo-300 animate-pulse"><Cpu className="w-3.5 h-3.5" /> STT & MMR</span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1 text-purple-300 animate-pulse"><Layers className="w-3.5 h-3.5" /> Map-Reduce</span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1 text-slate-500"><ListTodo className="w-3.5 h-3.5" /> Action Items</span>
            </div>

            <button type="button" onClick={() => { invalidateSession(); setErrorMessage('Stopped waiting. Processing may continue on the server; check History later.'); }} className="text-sm text-slate-300 underline">
              Stop waiting
            </button>
            {/* Explicit demo switch invalidates the previous response. */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleInstantDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all shadow-lg shadow-amber-500/5 active:scale-95 animate-pulse"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Show labeled demo instead ⏩
              </button>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !isProcessing && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <button type="button" onClick={() => { if (!contentMutations.current.isLocked()) setShowEditor(true); }} disabled={!currentMeetingId || isDemoResult || isContentSaving}
                className="rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3 py-2 text-xs text-indigo-200 disabled:opacity-40">
                Edit & review
              </button>
              {currentMeetingId && !isDemoResult ? <span className="text-xs text-slate-400">{result.review_status === 'reviewed' ? 'Reviewed' : 'Draft'} · Project {result.project_id == null ? 'unassigned' : `#${result.project_id}`} · Assign a project in Edit & review</span>
                : <span className="text-xs text-slate-400">Editing is available for saved meetings.</span>}
            </div>
            
            {(isDemoResult || warnings.length > 0) && (
              <div role="status" className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
                {isDemoResult && <p>Demo data — these results are from the sample meeting, not your uploaded recording.</p>}
                {warnings.map((warning, index) => <p key={index}>{warning}</p>)}
              </div>
            )}
            {/* Quick Metrics Bar (5 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 flex items-center gap-3 shadow-sm">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Transcript Size</p>
                  <p className="text-base font-bold text-white mt-0.5">~{wordCount} words</p>
                  <p className="text-[10px] text-slate-400">~{estimatedReadTime} min read</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                    <ListTodo className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Action Items</p>
                    <p className="text-base font-bold text-white mt-0.5">{totalTasks} tasks</p>
                    <p className="text-[10px] text-emerald-400">
                      {completedCount} completed {totalTasks > 0 ? `(${completionPercent}%)` : ''}
                    </p>
                  </div>
                </div>
                {totalTasks > 0 && (
                  <div className="w-full bg-slate-800/90 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 flex items-center gap-3 shadow-sm">
                <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Model & Engine</p>
                  <p className="text-xs font-bold text-white mt-0.5 truncate max-w-[130px]">
                    {metaInfo?.model || 'Llama 3 Map-Reduce'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{metaInfo?.hardware || 'Local Mode'}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 flex items-center gap-3 shadow-sm">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">MMR Compression</p>
                  {mmrTelemetry?.applied ? (
                    <>
                      <p className="text-base font-bold text-emerald-400 mt-0.5">
                        -{mmrTelemetry.reduction_percent}% noise
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {mmrTelemetry.filtered_words} / {mmrTelemetry.original_words} w (λ={mmrTelemetry.lambda_param})
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-300 mt-0.5">100% Raw</p>
                      <p className="text-[10px] text-slate-400">Filter bypassed</p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 flex items-center gap-3 shadow-sm">
                <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Audio Telemetry</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {result.duration ? formatDuration(result.duration) : '--:--'}
                  </p>
                  <p className="text-[10px] text-teal-300 uppercase">
                    {result.language ? `Lang: ${result.language}` : 'Auto-detected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Audio Recording Player & Seek Bar */}
            {audioUrl && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl p-3 px-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-white">Audio Sync Player</p>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        Interactive
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Click any [MM:SS] citation timestamp in Chat or Insights to seek audio
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex-1 max-w-sm">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    className="w-full h-8 rounded-lg outline-none"
                  />
                </div>
              </div>
            )}

            {/* View Switcher & Export Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-2 rounded-2xl border border-slate-800/80">
              {/* Tab Navigation */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('split')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'split' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" /> Split View
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Summary
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" /> Tasks ({result.action_items?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'insights' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" /> Insights {result.insights ? `(${((result.insights.decisions?.length || 0) + (result.insights.risks?.length || 0))})` : ''}
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> AI Chat ({chatMessages.length})
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'transcript' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Transcript
                </button>
              </div>

              {/* Export Toolbar */}
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <button
                  onClick={handleCopyResult}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                    isCopied 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copied!' : 'Copy All'}
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors shadow-sm"
                  title="Export Markdown file"
                >
                  <Download className="w-3.5 h-3.5" />
                  .MD
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors shadow-sm"
                  title="Export JSON format"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  .JSON
                </button>

                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors shadow-sm"
                  title="Export plain text report"
                >
                  <FileText className="w-3.5 h-3.5" />
                  .TXT
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors shadow-sm active:scale-95"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF / Print
                </button>
              </div>
            </div>

            {/* Dashboard Content Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Raw/Segmented/MMR Transcript */}
              {(activeTab === 'split' || activeTab === 'transcript') && (
                <div className={`${activeTab === 'split' ? 'lg:col-span-5' : 'lg:col-span-12'} bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-xl space-y-4`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <h2>
                        {transcriptView === 'mmr' ? 'MMR Filtered Sentences' : transcriptView === 'segments' ? 'Timestamped Segments' : 'Raw Transcript (Agent 1)'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setTranscriptView('raw')}
                        className={`px-2 py-0.5 rounded font-medium transition-all ${
                          transcriptView === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Text
                      </button>
                      {result.segments && result.segments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTranscriptView('segments')}
                          className={`px-2 py-0.5 rounded font-medium transition-all ${
                            transcriptView === 'segments' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Segments
                        </button>
                      )}
                      {result.condensed_transcript && (
                        <button
                          type="button"
                          onClick={() => setTranscriptView('mmr')}
                          className={`px-2 py-0.5 rounded font-medium transition-all ${
                            transcriptView === 'mmr' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          MMR
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Transcript Content based on view mode */}
                  <div className="max-h-[550px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                    {transcriptView === 'segments' && result.segments && result.segments.length > 0 ? (
                      <div className="space-y-3">
                        {/* Speaker filter pills if multiple speakers detected */}
                        {result.speakers && result.speakers.length > 0 && (
                          <div className="flex items-center gap-1.5 pb-2 overflow-x-auto scrollbar-none border-b border-slate-800 text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider">
                              <Users className="w-3 h-3 text-purple-400" /> Filter:
                            </span>
                            <button
                              type="button"
                              onClick={() => setSpeakerFilter('all')}
                              className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                                speakerFilter === 'all'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              All ({result.segments.length})
                            </button>
                            {result.speakers.map((spk) => {
                              const count = result.segments.filter(s => s.speaker === spk).length;
                              const badgeStyle = getSpeakerBadgeStyle(spk);
                              return (
                                <div key={spk} className="inline-flex items-center rounded-lg border overflow-hidden text-[11px] shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => setSpeakerFilter(speakerFilter === spk ? 'all' : spk)}
                                    className={`px-2 py-0.5 font-medium transition-all ${
                                      speakerFilter === spk 
                                        ? 'bg-purple-600 text-white' 
                                        : `${badgeStyle} hover:opacity-80`
                                    }`}
                                    title={`Filter by ${spk}`}
                                  >
                                    {spk} ({count})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRenameSpeaker(spk)}
                                    disabled={isContentSaving}
                                    className="px-1.5 py-0.5 bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border-l border-slate-700/60"
                                    title={`Rename speaker "${spk}"`}
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-2.5">
                          {result.segments
                            .map((seg, originalIdx) => ({ seg, originalIdx }))
                            .filter(({ seg }) => speakerFilter === 'all' || !seg.speaker || seg.speaker === speakerFilter)
                            .map(({ seg, originalIdx }, displayIdx) => (
                              <div key={originalIdx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-xs transition-colors space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-teal-400 font-mono">{seg.timestamp || `Turn #${displayIdx + 1}`}</span>
                                  {seg.speaker && (
                                    <button
                                      type="button"
                                      onClick={() => handleCycleSpeaker(originalIdx)}
                                      disabled={isContentSaving}
                                      title="Click to cycle speaker if misclassified"
                                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer ${getSpeakerBadgeStyle(seg.speaker)}`}
                                    >
                                      <span>{seg.speaker}</span>
                                      <span className="text-[9px] opacity-60">⇄</span>
                                    </button>
                                  )}
                                </div>
                                <p className="text-slate-300 leading-relaxed">{seg.text}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : transcriptView === 'mmr' && result.condensed_transcript ? (
                      <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                        {result.condensed_transcript}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                        {result.transcript}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: AI Outputs */}
              {(activeTab === 'split' || activeTab === 'summary' || activeTab === 'tasks') && (
                <div className={`${activeTab === 'split' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
                  
                  {/* Executive Summary Card */}
                  {(activeTab === 'split' || activeTab === 'summary') && (
                    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-purple-950/20 backdrop-blur-xl p-6 rounded-3xl border border-purple-500/30 shadow-xl shadow-purple-950/10 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <h2 className="text-sm font-bold text-white">Executive Summary (Agent 2)</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopySummary}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border shadow-sm active:scale-95 ${
                              summaryCopied
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 border-purple-500/30'
                            }`}
                            title="Copy summary text"
                          >
                            {summaryCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-purple-300" />}
                            <span>{summaryCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {metaInfo?.model || 'Llama 3 Map-Reduce'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {result.summary}
                      </div>
                    </div>
                  )}

                  {/* Action Items Interactive Checklist Card */}
                  {(activeTab === 'split' || activeTab === 'tasks') && (
                    <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                            <ListTodo className="w-4 h-4" />
                          </div>
                          <h2 className="text-sm font-bold text-white">Extracted Action Plan (Agent 3)</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono">
                            {completedCount}/{totalTasks} completed
                          </span>
                          {currentMeetingId && (
                            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              SQLite synced
                            </span>
                          )}
                        </div>
                      </div>

                      {/* All deliverables completed celebration state */}
                      {totalTasks > 0 && completedCount === totalTasks && (
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in duration-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>All {totalTasks} action deliverables are completed! Great work. 🎉</span>
                        </div>
                      )}

                      <ul className="space-y-2.5">
                        {result.action_items?.map((item, idx) => {
                          const isDone = completedTasks[idx];
                          return (
                            <li key={idx}>
                            <button type="button"
                              onClick={() => toggleTask(idx)}
                              disabled={isContentSaving}
                              aria-pressed={Boolean(isDone)}
                              aria-busy={Boolean(updatingTasks[idx])}
                              className={`group w-full text-left flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                                isContentSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                              } ${
                                isDone 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400' 
                                  : 'bg-slate-950/50 hover:bg-slate-800/50 border-slate-800/80 hover:border-slate-700 text-slate-200'
                              }`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 active:scale-90 ${
                                isDone 
                                  ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20' 
                                  : 'border-slate-600 group-hover:border-indigo-400'
                              }`}>
                                {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium leading-snug ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                                  {item.task}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                    <Users className="w-2.5 h-2.5 text-indigo-400" />
                                    Assignee: {item.assignee || 'Unassigned'}
                                  </span>
                                  {item.deadline && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      <Clock className="w-2.5 h-2.5" /> Due: {item.deadline}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                </div>
              )}

              {/* Agent 5: Key Decisions & Risk/Blocker Matrix Panel */}
              {activeTab === 'insights' && (
                <div className="lg:col-span-12 space-y-6">
                  {/* Panel Header */}
                  <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-white">
                            Key Decisions & Risk/Blocker Matrix
                          </h2>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                            Agent 5 Intelligence
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Automated 3-pillar governance extraction: Key Decisions, Risks & Blockers, and Open Questions with audio evidence
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{(result.insights?.decisions || []).length} decisions</span>
                      <span>•</span>
                      <span>{(result.insights?.risks || []).length} risks</span>
                      <span>•</span>
                      <span>{(result.insights?.open_questions || []).length} open questions</span>
                    </div>
                  </div>

                  {/* 3 Pillars Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Pillar 1: Decisions */}
                    <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-white">Key Decisions</h3>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {(result.insights?.decisions || []).length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {(!result.insights?.decisions || result.insights.decisions.length === 0) ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">No key decisions recorded in this meeting.</p>
                        ) : (
                          result.insights.decisions.map((dec, idx) => (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all space-y-2 group">
                              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                {dec.text}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-md border border-slate-700 text-slate-300">{dec.status || 'proposed'}</span>
                                {dec.speaker && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getSpeakerBadgeStyle(dec.speaker)}`}>
                                    {dec.speaker}
                                  </span>
                                )}
                                {dec.timestamp && (
                                  <button
                                    type="button"
                                    disabled={!audioUrl || normalizeCitation(dec).seconds === null}
                                    onClick={() => handleSeekAudio(normalizeCitation(dec).seconds)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono transition-all group-hover:border-emerald-400 cursor-pointer active:scale-95"
                                    title={`Click to jump audio to ${dec.timestamp}`}
                                  >
                                    <Play className="w-2.5 h-2.5 fill-emerald-300" />
                                    <span>{dec.timestamp}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pillar 2: Risks & Blockers */}
                    <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-amber-500/30 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-white">Risks & Blockers</h3>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {(result.insights?.risks || []).length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {(!result.insights?.risks || result.insights.risks.length === 0) ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">No critical risks or delivery blockers detected.</p>
                        ) : (
                          result.insights.risks.map((risk, idx) => (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 transition-all space-y-2 group">
                              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                {risk.text}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {risk.speaker && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getSpeakerBadgeStyle(risk.speaker)}`}>
                                    {risk.speaker}
                                  </span>
                                )}
                                {risk.timestamp && (
                                  <button
                                    type="button"
                                    disabled={!audioUrl || normalizeCitation(risk).seconds === null}
                                    onClick={() => handleSeekAudio(normalizeCitation(risk).seconds)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-mono transition-all group-hover:border-amber-400 cursor-pointer active:scale-95"
                                    title={`Click to jump audio to ${risk.timestamp}`}
                                  >
                                    <Play className="w-2.5 h-2.5 fill-amber-300" />
                                    <span>{risk.timestamp}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pillar 3: Open Questions */}
                    <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-blue-500/30 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
                            <HelpCircle className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-white">Open Questions</h3>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {(result.insights?.open_questions || []).length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {(!result.insights?.open_questions || result.insights.open_questions.length === 0) ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">No open questions extracted.</p>
                        ) : (
                          result.insights.open_questions.map((q, idx) => (
                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/40 transition-all space-y-2 group">
                              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                {q.text}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {q.speaker && (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getSpeakerBadgeStyle(q.speaker)}`}>
                                    {q.speaker}
                                  </span>
                                )}
                                {q.timestamp && (
                                  <button
                                    type="button"
                                    disabled={!audioUrl || normalizeCitation(q).seconds === null}
                                    onClick={() => handleSeekAudio(normalizeCitation(q).seconds)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-mono transition-all group-hover:border-blue-400 cursor-pointer active:scale-95"
                                    title={`Click to jump audio to ${q.timestamp}`}
                                  >
                                    <Play className="w-2.5 h-2.5 fill-blue-300" />
                                    <span>{q.timestamp}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent 6: Interactive Meeting Chatbot Panel */}
              {activeTab === 'chat' && (
                <div className="lg:col-span-12 space-y-4">
                  {/* Chat Header Card */}
                  <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-white">
                            Interactive Meeting Assistant Chatbot
                          </h2>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                            Agent 6 Lite-RAG
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Context-grounded Lite-RAG assistant with timestamped turn citations and audio seek synchronization
                        </p>
                      </div>
                    </div>
                    {chatMessages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Chat</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Suggestion Prompts */}
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                    <label className="flex items-center gap-2 text-slate-300">
                      <input type="checkbox" checked={semanticChat} disabled={isChatLoading} onChange={event => setSemanticChat(event.target.checked)} /> Local semantic retrieval
                    </label>
                    {semanticChat && <label className="flex items-center gap-2 text-slate-400">Embedding model
                      <input type="text" value={embeddingModel} maxLength={128} disabled={isChatLoading} onChange={event => setEmbeddingModel(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-200" />
                    </label>}
                  </div>
                  {suggestedPrompts.length > 0 && <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                    <span className="text-slate-500 text-[11px] whitespace-nowrap flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Suggested Prompts:
                    </span>
                    {suggestedPrompts.map((promptText, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleSendChatMessage(promptText)}
                        disabled={isChatLoading || isSpeakerSaving}
                        className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white text-xs text-left min-w-48 max-w-80 shrink-0 whitespace-normal transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {promptText}
                      </button>
                    ))}
                  </div>}

                  {/* Messages Container */}
                  <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col h-[520px]">
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                      {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <MessageSquare className="w-8 h-8" />
                          </div>
                          <div className="max-w-md space-y-2">
                            <h3 className="text-sm font-semibold text-white">AI Meeting Assistant Ready</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Ask a question about this meeting's transcript. Suggestions appear when source text is available.
                            </p>
                            <div className="pt-2 flex flex-wrap justify-center gap-2">
                              {suggestedPrompts.slice(0, 2).map(promptText => <button
                                key={promptText}
                                type="button"
                                onClick={() => handleSendChatMessage(promptText)}
                                disabled={isChatLoading || isSpeakerSaving}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all cursor-pointer"
                              >
                                {promptText}
                              </button>)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div
                              key={idx}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                            >
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-1 font-mono">
                                <span>{isUser ? 'You' : 'Meeting Assistant AI'}</span>
                                {msg.mode && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    {msg.mode === 'instant_demo_faq' ? 'Instant Matcher' : msg.mode}
                                  </span>
                                )}
                              </div>
                              <div
                                className={`p-4 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-sm ${
                                  isUser
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-slate-950/80 text-slate-200 border border-slate-800/80 rounded-tl-none'
                                }`}
                              >
                                <div className="whitespace-pre-wrap">
                                  {isUser ? msg.content : renderFormattedChatText(msg.content)}
                                </div>
                                {!isUser && msg.retrieval_warning && <p role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">{msg.retrieval_warning}</p>}

                                {/* Citations Quick Buttons if present on assistant msg */}
                                {!isUser && msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                      <Play className="w-2.5 h-2.5 text-indigo-400" /> Source Excerpts:
                                    </span>
                                    {msg.citations.map((cit, citIdx) => {
                                      const citation = normalizeCitation(cit);
                                      return (
                                      <button
                                        key={citIdx}
                                        type="button"
                                        disabled={!audioUrl || citation.seconds === null}
                                        onClick={() => handleSeekAudio(citation.seconds)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono transition-all cursor-pointer active:scale-95"
                                        title={citation.seconds === null ? "No audio timestamp available" : `Jump audio player to ${citation.label}`}
                                      >
                                        <Play className="w-2 h-2 fill-indigo-300" />
                                        <span>{citation.label}</span>
                                      </button>
                                    ); })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      {isChatLoading && (
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs w-fit">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          <span>AI is analyzing transcript context and retrieving citations...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500/80 transition-colors">
                        <input
                          type="text"
                          aria-label="Question about this meeting"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (shouldSubmitChat(e)) {
                              e.preventDefault();
                              handleSendChatMessage();
                            }
                          }}
                          placeholder="Ask a question about this meeting's content..."
                          maxLength={4000}
                          className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                          disabled={isChatLoading}
                        />
                        <button
                          type="button"
                          onClick={() => handleSendChatMessage()}
                          disabled={!chatInput.trim() || isChatLoading}
                          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all active:scale-95 shrink-0 cursor-pointer"
                          title="Send question"
                        >
                          {isChatLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* SQLite Meeting History Modal */}
        {showWorkspace && <Workspace apiBase={API_BASE} onClose={() => { detailGate.current.cancel(); setLoadingMeetingId(null); setShowWorkspace(false); }} onOpenMeeting={async id => {
          const opened = await handleLoadPastMeeting({ id });
          if (opened) setShowWorkspace(false);
          return opened;
        }} />}
        {showEditor && currentMeetingId && !isDemoResult && <MeetingEditor key={currentMeetingId} apiBase={API_BASE} meetingId={currentMeetingId} model={selectedModel} onClose={() => setShowEditor(false)} onUpdated={handleUpdatedMeeting} />}
        {showHistory && (
          <WorkspaceDialog title="Saved Meeting History & Analytics" maxWidth="max-w-3xl" onClose={handleCloseHistory}>
            <div className="relative w-full pt-4 overflow-hidden flex flex-col max-h-[75vh]">
              <p className="text-xs text-slate-400">{historyTotal} matching meeting records stored locally</p>

              {/* Analytics Quick Badges Bar (if available) */}
              {systemAnalytics && (
                <div className="grid grid-cols-4 gap-2 pt-3">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Total Meetings</p>
                    <p className="text-sm font-bold text-white">{systemAnalytics.total_meetings}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Total Action Items</p>
                    <p className="text-sm font-bold text-indigo-400">{systemAnalytics.total_action_items}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Completed Rate</p>
                    <p className="text-sm font-bold text-emerald-400">{systemAnalytics.completion_rate_percent}%</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400">Total Audio Time</p>
                    <p className="text-sm font-bold text-teal-400">{formatDuration(systemAnalytics.total_duration_seconds) || '00:00'}</p>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="pt-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    aria-label="Search meeting history"
                    value={historySearchQuery}
                    onChange={(e) => handleHistorySearch(e.target.value)}
                    placeholder="Search by filename, summary, transcript, or action items..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {historySearchQuery && (
                    <button 
                      aria-label="Clear history search"
                      onClick={() => handleHistorySearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Meetings List */}
              {historyError && <p role="alert" className="text-sm text-rose-300">{historyError}</p>}
              {loadingMeetingId && <p role="status" className="text-sm text-indigo-300">Opening meeting #{loadingMeetingId}…</p>}
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                {loadingHistory ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    <p className="text-xs">Loading database records...</p>
                  </div>
                ) : filteredMeetings.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Database className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-300">No matching meeting records</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {historySearchQuery ? 'Try another search term.' : 'Processed meetings will automatically be saved here.'}
                    </p>
                  </div>
                ) : (
                  filteredMeetings.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-all"
                    >
                      <button type="button" onClick={() => handleLoadPastMeeting(item)} className="flex-1 min-w-0 text-left" aria-label={`Open meeting ${item.filename}`}>
                        <div className="flex items-center gap-2">
                          <FileAudio className="w-4 h-4 text-indigo-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                            {item.filename}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">#{item.id}</span>
                          {item.language && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 uppercase">
                              {item.language}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                          {item.executive_summary || "No summary recorded"}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/50">
                            {item.action_item_count || 0} action items
                          </span>
                          {item.duration && (
                            <span className="text-teal-400">
                              ⏱ {formatDuration(item.duration)}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 pt-1">
                        <button
                          onClick={(e) => handleDeletePastMeeting(item.id, e)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete from SQLite database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <button type="button" disabled={loadingHistory || historyOffset === 0} onClick={() => fetchMeetingHistory(historyQueryRef.current, Math.max(0, historyOffset - 20))} className="disabled:opacity-40">Previous page</button>
                  <span>{historyTotal ? `${historyOffset + 1}–${Math.min(historyOffset + 20, historyTotal)} / ${historyTotal}` : '0 records'}</span>
                  <button type="button" disabled={loadingHistory || historyOffset + 20 >= historyTotal} onClick={() => fetchMeetingHistory(historyQueryRef.current, historyOffset + 20)} className="disabled:opacity-40">Next page</button>
                </div>
                <button
                  onClick={handleCloseHistory}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </WorkspaceDialog>
        )}

        {/* Minimalist Dashboard Footer */}
        <footer className="pt-6 pb-2 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="font-medium text-slate-400">AI Meeting Assistant</span>
            <span className="text-slate-600">•</span>
            <span>Local Multi-Agent Orchestration</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-slate-500 font-mono text-[10px]">
            <span>Whisper STT</span>
            <span>•</span>
            <span>MMR Redundancy Filter</span>
            <span>•</span>
            <span>Llama 3 Map-Reduce</span>
            <span>•</span>
            <span>SQLite WAL</span>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default App;
