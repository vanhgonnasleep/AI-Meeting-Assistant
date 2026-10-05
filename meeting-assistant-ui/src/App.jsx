import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  normalizeCitation, 
  normalizeChatMessages, 
  createRequestGate, 
  resultFromMeeting, 
  editSpeakerAttribution, 
  getSuggestedPrompts, 
  buildChatPayload, 
  getExportTasks, 
  shouldSubmitChat 
} from './session.js';
import Workspace, { WorkspaceDialog } from './Workspace.jsx';
import MeetingEditor from './MeetingEditor.jsx';
import { createMutationLock } from './workspace.js';
import { 
  DEFAULT_UPLOAD_LIMITS, 
  getUploadLimits, 
  getUploadError, 
  formatUploadLimits, 
  startHealthPolling, 
  buildProcessingQuery 
} from './upload.js';
import Overview from './Overview.jsx';
import MeetingLibrary from './MeetingLibrary.jsx';
import { 
  canOpenAnotherMeeting, 
  formatMeetingDuration, 
  getNavigationPage, 
  navigateTo, 
  subscribeToNavigation, 
  appPageHref 
} from './navigation.js';
import { buildMeetingSavePayload } from './storage.js';
import Sidebar from './Sidebar.jsx';
import CommandCenter from './CommandCenter.jsx';
import DocumentWorkspace from './DocumentWorkspace.jsx';

import { 
  AlertTriangle, 
  Check, 
  X, 
  PanelLeftOpen, 
  PanelLeftClose, 
  Zap, 
  Loader2, 
  Sparkles, 
  FileAudio,
  Play
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002').replace(/\/$/, '');

const getDefaultChatGreeting = (currResult) => {
  if (!currResult) return [];
  if (currResult.chat_history && currResult.chat_history.length > 0) {
    return currResult.chat_history;
  }
  const turnsCount = currResult.segments?.length || 0;
  const itemsCount = currResult.action_items?.length || 0;
  const durText = formatMeetingDuration(currResult.duration);
  return [
    {
      role: 'assistant',
      content: `👋 **Welcome to AI Meeting Intelligence!**\n\nThis meeting${durText ? ` (${durText} duration)` : ''} has **${turnsCount} transcript segments** and **${itemsCount} extracted action items**.\n\nAsk a question about deliverables, decisions, or timeline commitments, or click a suggested prompt below.`,
      citations: [],
      mode: 'assistant',
      created_at: new Date().toISOString()
    }
  ];
};

/**
 * Main Application Component
 * 
 * UX Architecture & Design System Decisions:
 * 1. Apple & Linear Aesthetic: Deep Slate/Zinc neutrals (#090d12 base, #101722 panels) with
 *    crisp typography (Inter) and single accent color (Indigo/Emerald).
 * 2. 8pt Grid: Spacing strictly enforces 8px multiples (p-4=16px, p-6=24px, gap-3=12px/gap-4=16px).
 * 3. 3-Component Core Layout:
 *    - Collapsible Sidebar: Date-grouped past meetings (Today, Yesterday, Previous 7 Days, Older).
 *    - Main Workspace: Refined document editor view with card treatments, audio seeking, and skeleton shimmer.
 *    - Command Center: Floating frosted-glass dock at bottom with live audio recording and RAG chat.
 * 4. WCAG AA Accessibility: Explicit focus-visible ring offsets, ARIA roles, and high contrast ratios.
 */
function App() {
  const page = useSyncExternalStore(subscribeToNavigation, getNavigationPage, () => 'studio');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeId = useRef(0);
  const notify = (message, kind = 'success') => setNotice({ id: ++noticeId.current, message, kind });

  // Core Session States
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState(null);
  const suggestedPrompts = useMemo(() => getSuggestedPrompts(result), [result]);
  const [currentMeetingId, setCurrentMeetingId] = useState(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  
  // Pipeline Settings
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
  const [completedTasks, setCompletedTasks] = useState({});
  const [updatingTasks, setUpdatingTasks] = useState({});
  const [healthStatus, setHealthStatus] = useState({ online: false, checking: true });
  const [uploadLimits, setUploadLimits] = useState(DEFAULT_UPLOAD_LIMITS);
  const uploadError = getUploadError(file, uploadLimits);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [spokenLanguage, setSpokenLanguage] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);
  const saveKey = useRef(null);
  const saveGate = useRef(createRequestGate());
  const [metaInfo, setMetaInfo] = useState(null);

  // History & SQLite
  const [meetingsHistory, setMeetingsHistory] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyError, setHistoryError] = useState(null);
  const [loadingMeetingId, setLoadingMeetingId] = useState(null);
  const [isSpeakerSaving, setIsSpeakerSaving] = useState(false);
  const [speakerRename, setSpeakerRename] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDemoResult, setIsDemoResult] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Gates & Locks
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

  // Keyboard shortcut listener (Ctrl+B / Cmd+B for sidebar, Ctrl+N for new meeting)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => subscribeToNavigation(() => {
    detailGate.current.cancel();
    setLoadingMeetingId(null);
  }), []);

  useEffect(() => {
    const process = processGate.current;
    const chat = chatGate.current;
    const history = historyGate.current;
    const detail = detailGate.current;
    const speaker = speakerGate.current;
    const save = saveGate.current;
    return () => { process.cancel(); chat.cancel(); history.cancel(); detail.cancel(); speaker.cancel(); save.cancel(); };
  }, []);

  const invalidateSession = (preserveResultMetadata = false) => {
    sessionVersion.current += 1;
    processGate.current.cancel();
    chatGate.current.cancel();
    detailGate.current.cancel();
    speakerGate.current.cancel();
    saveGate.current.cancel();
    setIsSavingMeeting(false);
    speakerBusy.current = false;
    contentMutations.current.reset();
    setIsSpeakerSaving(false);
    setSpeakerRename(null);
    setLoadingMeetingId(null);
    setIsProcessing(false);
    setIsChatLoading(false);
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
      const resMeetings = await fetch(`${API_BASE}/api/meetings?${params}`, { signal: request.signal });
      if (!resMeetings.ok) throw new Error('Unable to load meeting history.');
      const data = await resMeetings.json();
      if (!request.isCurrent()) return;
      if (offset > 0 && offset >= data.total) return fetchMeetingHistory(query, Math.max(0, offset - 20));
      setMeetingsHistory(data.meetings || []);
      setHistoryTotal(data.total || 0);
    } catch (e) {
      if (request.isCurrent()) setHistoryError(e.message || 'Unable to load history.');
    } finally {
      if (request.isCurrent()) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetingHistory();
  }, [fetchMeetingHistory]);

  useEffect(() => {
    if (!notice) return;
    if (notice?.kind === 'error') return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleHistorySearch = (query) => {
    historyQueryRef.current = query;
    historyGate.current.cancel();
    setLoadingHistory(true);
    setHistorySearchQuery(query);
    historyOffsetRef.current = 0;
    setHistoryOffset(0);
  };

  const handleLoadPastMeeting = async (entry) => {
    if (!canOpenAnotherMeeting({ processing: isProcessing, saving: contentMutations.current.isLocked(), editing: showEditor || Boolean(speakerRename) })) return false;
    invalidateSession(true);
    const request = detailGate.current.begin();
    setLoadingMeetingId(entry.id);
    let item;
    try {
      const response = await fetch(`${API_BASE}/api/meetings/${entry.id}`, { signal: request.signal });
      if (!response.ok) throw new Error('Unable to open this meeting record.');
      const data = await response.json();
      if (!request.isCurrent()) return;
      item = data.meeting;
    } catch (error) {
      if (request.isCurrent()) { setHistoryError(error.message); setErrorMessage(error.message); notify(error.message, 'error'); }
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
    setMeetingTitle(String(item.filename || 'Saved meeting'));
    setMmrTelemetry(null);
    setTranscriptView(loadedResult.segments.some(segment => segment.speaker) ? 'segments' : 'raw');

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
    setSpeakerFilter('all');
    navigateTo('studio');
    return true;
  };

  const handleUpdatedMeeting = (meeting) => {
    invalidateSession(true);
    const updated = resultFromMeeting(meeting);
    setResult(updated);
    setCurrentMeetingId(meeting.id);
    setMeetingTitle(String(meeting.filename || meetingTitle));
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
      notify('Meeting record deleted');
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      setErrorMessage(err.message || "Failed to delete meeting.");
      notify(err.message || 'Failed to delete meeting.', 'error');
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
    if (contentMutations.current.isLocked()) return;
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
    disabled: isProcessing || isSavingMeeting,
    maxFiles: 1
  });

  const handleProcessAudio = async () => {
    if (contentMutations.current.isLocked() || isSavingMeeting || isProcessing) return;
    const limitError = getUploadError(file, uploadLimits);
    if (limitError) { setErrorMessage(limitError); return; }
    if (selectedModel === 'instant_demo') {
      return handleInstantDemo();
    }

    if (!file) return;
    invalidateSession();
    saveKey.current = null;
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
      const query = buildProcessingQuery({ 
        model: selectedModel, 
        language: spokenLanguage,
        enableMmr, 
        mmrLambda, 
        diarize: enableDiarization, 
        numSpeakers, 
        saveToLibrary 
      });
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
      notify('Meeting analysis complete');
      setMmrTelemetry(data.mmr_telemetry || null);
      setMetaInfo({
        model: data.model_used || selectedModel,
        hardware: data.hardware || (healthStatus.data?.gpu || "CPU Mode")
      });
      fetchMeetingHistory();
    } catch (error) {
      if (!request.isCurrent()) return;
      setErrorMessage(error.message || "An unexpected error occurred.");
      notify(error.message || 'Processing failed.', 'error');
    } finally {
      if (request.isCurrent()) setIsProcessing(false);
    }
  };

  const handleInstantDemo = async () => {
    if (contentMutations.current.isLocked() || isProcessing) return;
    const limitError = getUploadError(file, uploadLimits);
    if (limitError) { setErrorMessage(limitError); return; }
    invalidateSession();
    const request = processGate.current.begin();
    setIsProcessing(true);
    setResult(null);
    setCurrentMeetingId(null);
    setMeetingTitle('');
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
        throw new Error(errData.detail || `Demo mode error (HTTP ${response.status})`);
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
      notify('Demo meeting loaded');
    } catch (e) {
      if (!request.isCurrent()) return;
      setErrorMessage(e.message || "Backend server not reachable on port 8002.");
    } finally {
      if (request.isCurrent()) setIsProcessing(false);
    }
  };

  const handleDemoSample = async () => {
    if (contentMutations.current.isLocked() || isProcessing) return;
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
        notify('Sample audio loaded');
        return;
      }
    } catch {
      // Fallback
    }
    try {
      const resWav = await fetch('/q3_product_budget_review.wav');
      if (resWav.ok) {
        const blob = await resWav.blob();
        const sampleFile = new File([blob], "q3_product_budget_review.wav", {
          type: "audio/wav",
        });
        if (version !== sessionVersion.current) return;
        setFile(sampleFile);
        notify('Sample audio loaded');
        return;
      }
    } catch {
      // Fallback
    }
    const mockFile = new File(["sample meeting binary content"], "q3_product_budget_review.mp3", {
      type: "audio/mp3",
    });
    if (version !== sessionVersion.current) return;
    setFile(mockFile);
    notify('Sample audio loaded');
  };

  const handleReset = ({ resetStorage = false } = {}) => {
    invalidateSession();
    saveKey.current = null;
    if (resetStorage) setSaveToLibrary(true);
    setFile(null);
    setSpokenLanguage('');
    setAudioUrl(null);
    setResult(null);
    setCurrentMeetingId(null);
    setMeetingTitle('');
    setIsCopied(false);
    setSummaryCopied(false);
    setCompletedTasks({});
    setUpdatingTasks({});
    setMetaInfo(null);
    setMmrTelemetry(null);
    setShowAdvancedMmr(false);
    setTranscriptView('raw');
    setSpeakerFilter('all');
    setErrorMessage(null);
    setChatMessages([]);
    setIsChatLoading(false);
  };

  const handleSaveMeeting = async () => {
    if (!result || currentMeetingId || isDemoResult || isProcessing || isChatLoading || showEditor || speakerRename) return;
    const release = contentMutations.current.tryAcquire();
    if (!release) return;
    const request = saveGate.current.begin();
    setIsSavingMeeting(true);
    setErrorMessage(null);
    try {
      saveKey.current ||= crypto.randomUUID();
      const payload = buildMeetingSavePayload({ 
        saveKey: saveKey.current, 
        filename: file?.name || meetingTitle,
        result, 
        completedTasks, 
        chatMessages, 
        isDemo: isDemoResult 
      });
      const response = await fetch(`${API_BASE}/api/meetings`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload), 
        signal: request.signal 
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to save meeting.');
      if (!request.isCurrent()) return;
      if (!data.meeting?.id) throw new Error('Save was not confirmed. Please retry.');
      const saved = resultFromMeeting(data.meeting);
      setResult(previous => ({ ...previous, ...saved, meeting_id: data.meeting.id }));
      setChatMessages(saved.chat_history);
      setCurrentMeetingId(data.meeting.id);
      setMeetingTitle(data.meeting.filename);
      setWarnings(previous => previous.filter(warning => warning !== 'Meeting could not be saved. Export your results before leaving this page.'));
      notify('Meeting saved to library');
      fetchMeetingHistory();
    } catch (error) {
      if (request.isCurrent()) { setErrorMessage(error.message); notify(error.message, 'error'); }
    } finally {
      release();
      if (request.isCurrent()) setIsSavingMeeting(false);
    }
  };

  const handleSeekAudio = (seconds) => {
    if (audioRef.current && Number.isFinite(seconds)) {
      audioRef.current.currentTime = Math.max(0, seconds);
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSendChatMessage = async (presetText) => {
    const textToSend = presetText;
    if (!textToSend || !textToSend.trim() || isChatLoading || isSpeakerSaving || isSavingMeeting || contentMutations.current.isLocked()) return;
    const cleanQ = textToSend.trim();
    const request = chatGate.current.begin();

    const newUserMsg = { role: 'user', content: cleanQ, created_at: new Date().toISOString() };
    setChatMessages(prev => [...prev, newUserMsg]);
    setIsChatLoading(true);

    try {
      let endpoint = `${API_BASE}/api/chat`;
      const payload = buildChatPayload({ 
        question: cleanQ, 
        meetingId: currentMeetingId,
        isDemo: isDemoResult, 
        result, 
        model: selectedModel === 'instant_demo' ? 'auto' : selectedModel,
        semantic: semanticChat, 
        embeddingModel 
      });

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

      const aiMsg = {
        role: 'assistant',
        content: data.answer || "I couldn't find relevant context in the meeting transcript to answer that.",
        citations: data.citations || [],
        mode: data.mode || (data.cached ? 'cached' : 'live'),
        retrieval_warning: data.retrieval_warning || null,
        created_at: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, aiMsg]);
      setResult(previous => previous ? { ...previous, chat_history: [...chatMessages, newUserMsg, aiMsg] } : previous);
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Chat error:", err);
      const errorMsg = {
        role: 'assistant',
        content: `⚠️ ${err.message || 'Failed to generate answer. Please retry.'}`,
        citations: [],
        created_at: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      if (request.isCurrent()) setIsChatLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (isChatLoading || !result) return;
    const version = sessionVersion.current;
    const request = chatGate.current.begin();
    setIsChatLoading(true);
    try {
      if (currentMeetingId) {
        const response = await fetch(`${API_BASE}/api/meetings/${currentMeetingId}/chat`, { method: 'DELETE', signal: request.signal });
        if (!response.ok) throw new Error('Could not clear saved chat.');
      }
      if (version !== sessionVersion.current || !request.isCurrent()) return;
      setResult(previous => previous ? { ...previous, chat_history: [] } : previous);
      setChatMessages(getDefaultChatGreeting({ ...result, chat_history: [] }));
      notify('Chat conversation cleared');
    } catch (error) {
      if (version === sessionVersion.current && request.isCurrent()) { setErrorMessage(error.message); notify(error.message, 'error'); }
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
            title={!audioUrl ? 'Audio not available' : `Jump audio to ${ts}`}
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
          throw new Error(errData.detail || `Failed to update task (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (version !== sessionVersion.current) return;
        if (data.meeting) { handleUpdatedMeeting(data.meeting); notify('Task updated'); return; }
      }

      if (version !== sessionVersion.current) return;
      setCompletedTasks(prev => ({
        ...prev,
        [idx]: isNowDone
      }));
      notify('Task updated');
    } catch (err) {
      if (version !== sessionVersion.current) return;
      console.error("Failed to update task:", err);
      setErrorMessage(err.message || "Failed to save task status.");
      notify(err.message || 'Failed to save task status.', 'error');
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

    return `# MEETING EXECUTIVE SUMMARY\n\n${result.summary || ""}\n\n## ACTION DELIVERABLES\n${items.map((item, idx) => `- [${completedTasks[idx] ? 'x' : ' '}] ${item.task || ""} (Assignee: ${item.assignee || "Unassigned"}${item.deadline ? `, Deadline: ${item.deadline}` : ''})`).join('\n')}${insightsBlock}\n\n## CONVERSATIONAL TRANSCRIPT\n${transcriptBlock}`;
  };

  const handleCopyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(getFullMarkdown()).then(() => {
      setIsCopied(true);
      notify('Meeting notes copied to clipboard');
      setTimeout(() => setIsCopied(false), 2500);
    }).catch(console.error);
  };

  const handleCopySummary = (e) => {
    e?.stopPropagation();
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary).then(() => {
      setSummaryCopied(true);
      notify('Summary copied to clipboard');
      setTimeout(() => setSummaryCopied(false), 2000);
    }).catch(console.error);
  };

  const applySpeakerEdit = async (oldName, newName, segmentIndex = null) => {
    if (!result || speakerBusy.current || isSpeakerSaving || Object.values(updatingTasks).some(Boolean)) return;
    if (!newName.trim() || newName.length > 128 || [...newName].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      setErrorMessage('Use a speaker name with 1–128 characters.');
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
          method: 'PATCH', 
          signal: request.signal, 
          headers: { 'Content-Type': 'application/json' },
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
      notify('Speaker name updated');
      return true;
    } catch (error) {
      if (request.isCurrent()) { setErrorMessage(error.message || 'Speaker edit failed.'); notify(error.message || 'Speaker edit failed.', 'error'); }
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
    const exportTasks = getExportTasks(result, completedTasks);
    const exportData = {
      meeting_id: currentMeetingId,
      filename: file?.name || meetingTitle,
      created_at: new Date().toISOString(),
      summary: result.summary,
      action_items: exportTasks,
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

  const isContentSaving = isSavingMeeting || isSpeakerSaving || Object.values(updatingTasks).some(Boolean);
  const canOpenMeeting = canOpenAnotherMeeting({ processing: isProcessing, saving: isContentSaving, editing: showEditor || Boolean(speakerRename) });

  const handleNewMeeting = () => {
    if (!canOpenMeeting || contentMutations.current.isLocked()) return;
    handleReset({ resetStorage: true });
    navigateTo('studio');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-indigo-500/30 selection:text-white">
      
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        meetings={meetingsHistory}
        currentMeetingId={currentMeetingId}
        onSelectMeeting={handleLoadPastMeeting}
        onDeleteMeeting={handleDeletePastMeeting}
        onNewMeeting={handleNewMeeting}
        canStartNew={canOpenMeeting}
        searchQuery={historySearchQuery}
        onSearchChange={handleHistorySearch}
        loadingHistory={loadingHistory}
        loadingMeetingId={loadingMeetingId}
        healthStatus={healthStatus}
        activePage={page}
        onNavigate={navigateTo}
      />

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-250 ease-out ${
          isSidebarCollapsed ? 'md:ml-16 ml-0' : 'md:ml-72 ml-0'
        }`}
      >
        {/* Top Navbar */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition-all active:scale-95 cursor-pointer"
              title="Toggle sidebar (Ctrl+B)"
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 capitalize">{page}</span>
              <span className="text-slate-600">/</span>
              <span className="font-semibold text-slate-200 truncate max-w-xs" title={file?.name || meetingTitle}>
                {file?.name || meetingTitle || (isDemoResult ? 'Q3 Demo Meeting' : 'Studio Workspace')}
              </span>
            </div>
          </div>

          {/* Quick Actions in Navbar */}
          <div className="flex items-center gap-2">
            {file && !result && !isProcessing && (
              <button
                type="button"
                onClick={handleProcessAudio}
                disabled={Boolean(uploadError) || isProcessing || isContentSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Start Processing</span>
              </button>
            )}

            {result && !isProcessing && (
              <button
                type="button"
                onClick={handleNewMeeting}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
              >
                New Meeting
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner */}
        {(uploadError || errorMessage) && (
          <div role="alert" className="mx-4 md:mx-8 mt-4 flex items-start justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-300">Notice</p>
                <p className="text-rose-400/90 mt-0.5">{uploadError || errorMessage}</p>
              </div>
            </div>
            <button
              aria-label="Dismiss error"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-8 pb-32 overflow-y-auto">
          {page === 'overview' ? (
            <Overview
              apiBase={API_BASE}
              refreshKey={currentMeetingId}
              onOpen={handleLoadPastMeeting}
              canOpen={canOpenMeeting}
              onNewMeeting={handleNewMeeting}
              processing={isProcessing}
            />
          ) : page === 'meetings' ? (
            <MeetingLibrary
              meetings={meetingsHistory}
              total={historyTotal}
              loading={loadingHistory}
              error={historyError}
              opening={loadingMeetingId}
              query={historySearchQuery}
              offset={historyOffset}
              onSearch={handleHistorySearch}
              onPage={offset => fetchMeetingHistory(historyQueryRef.current, offset)}
              onOpen={handleLoadPastMeeting}
              onDelete={handleDeletePastMeeting}
              canOpen={canOpenMeeting}
              onNewMeeting={handleNewMeeting}
            />
          ) : page === 'tasks' || page === 'projects' ? (
            <Workspace
              key={page}
              presentation="page"
              initialSection={page === 'projects' ? 'projects' : 'tasks'}
              apiBase={API_BASE}
              canOpenMeeting={canOpenMeeting}
              onSectionChange={navigateTo}
              onOpenMeeting={id => handleLoadPastMeeting({ id })}
            />
          ) : (
            /* Default: Document Workspace */
            <DocumentWorkspace
              result={result}
              isProcessing={isProcessing}
              elapsedTime={elapsedTime}
              file={file}
              audioUrl={audioUrl}
              audioRef={audioRef}
              currentMeetingId={currentMeetingId}
              meetingTitle={meetingTitle}
              isDemoResult={isDemoResult}
              warnings={warnings}
              completedTasks={completedTasks}
              updatingTasks={updatingTasks}
              onToggleTask={toggleTask}
              onSeekAudio={handleSeekAudio}
              onCopyAll={handleCopyResult}
              isCopied={isCopied}
              onCopySummary={handleCopySummary}
              summaryCopied={summaryCopied}
              onDownloadMarkdown={handleDownloadMarkdown}
              onDownloadJson={handleDownloadJson}
              onDownloadTxt={handleDownloadTxt}
              onSaveMeeting={handleSaveMeeting}
              isSavingMeeting={isSavingMeeting}
              onShowEditor={() => { if (!contentMutations.current.isLocked()) setShowEditor(true); }}
              onRenameSpeaker={handleRenameSpeaker}
              onCycleSpeaker={handleCycleSpeaker}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              spokenLanguage={spokenLanguage}
              setSpokenLanguage={setSpokenLanguage}
              enableMmr={enableMmr}
              setEnableMmr={setEnableMmr}
              mmrLambda={mmrLambda}
              setMmrLambda={setMmrLambda}
              showAdvancedMmr={showAdvancedMmr}
              setShowAdvancedMmr={setShowAdvancedMmr}
              enableDiarization={enableDiarization}
              setEnableDiarization={setEnableDiarization}
              numSpeakers={numSpeakers}
              setNumSpeakers={setNumSpeakers}
              speakerFilter={speakerFilter}
              setSpeakerFilter={setSpeakerFilter}
              transcriptView={transcriptView}
              setTranscriptView={setTranscriptView}
              mmrTelemetry={mmrTelemetry}
              metaInfo={metaInfo}
              saveToLibrary={saveToLibrary}
              setSaveToLibrary={setSaveToLibrary}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              uploadError={uploadError}
              uploadLimits={uploadLimits}
              handleReset={handleReset}
              handleDemoSample={handleDemoSample}
              handleInstantDemo={handleInstantDemo}
              onStopWaiting={() => { invalidateSession(); setErrorMessage('Stopped waiting. Processing may continue on the server; check History later.'); }}
              healthStatus={healthStatus}
            />
          )}
        </main>

        {/* 3. FLOATING FROSTED-GLASS COMMAND CENTER DOCK */}
        <CommandCenter
          onSendChatMessage={handleSendChatMessage}
          chatMessages={chatMessages}
          isChatLoading={isChatLoading}
          onClearChat={handleClearChat}
          onRecordedAudio={(recordedFile) => {
            handleReset();
            setFile(recordedFile);
            setSelectedModel('auto');
            navigateTo('studio');
            notify('Audio recorded successfully. Click Start Processing to analyze!');
          }}
          suggestedPrompts={suggestedPrompts}
          audioUrl={audioUrl}
          onSeekAudio={handleSeekAudio}
          isMeetingLoaded={Boolean(result)}
          semanticChat={semanticChat}
          onToggleSemantic={() => setSemanticChat(!semanticChat)}
          renderFormattedChatText={renderFormattedChatText}
        />

        {/* Toast Notifications */}
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`fixed bottom-24 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-2 ${
              notice.kind === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {notice.kind === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
            <span>{notice.message}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="ml-2 text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modals & Dialogs */}
        {speakerRename && (
          <WorkspaceDialog 
            title={`Rename ${speakerRename.oldName}`} 
            maxWidth="max-w-sm" 
            onClose={() => { if (!isSpeakerSaving) setSpeakerRename(null); }}
          >
            <form 
              className="space-y-4 pt-4" 
              onSubmit={async (e) => {
                e.preventDefault();
                if (contentMutations.current.isLocked() || isContentSaving) return;
                if (await applySpeakerEdit(speakerRename.oldName, speakerRename.name)) {
                  setSpeakerRename(null);
                }
              }}
            >
              <label htmlFor="speaker-rename-input" className="block text-xs font-semibold text-slate-300">
                New speaker name
              </label>
              <input 
                id="speaker-rename-input" 
                autoFocus 
                maxLength={128} 
                value={speakerRename.name} 
                onChange={(e) => setSpeakerRename(prev => ({ ...prev, name: e.target.value }))} 
                className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-xs text-white outline-none focus:border-indigo-500" 
                disabled={isContentSaving} 
              />
              {errorMessage && <p role="alert" className="text-xs text-rose-300">{errorMessage}</p>}
              <div className="flex justify-end gap-2 text-xs">
                <button 
                  type="button" 
                  disabled={isSpeakerSaving} 
                  onClick={() => setSpeakerRename(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isContentSaving || !speakerRename.name.trim()} 
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-white font-semibold disabled:opacity-40"
                >
                  {isSpeakerSaving ? 'Saving…' : 'Save Speaker'}
                </button>
              </div>
            </form>
          </WorkspaceDialog>
        )}

        {showEditor && currentMeetingId && !isDemoResult && (
          <MeetingEditor 
            key={currentMeetingId} 
            apiBase={API_BASE} 
            meetingId={currentMeetingId} 
            model={selectedModel} 
            onClose={() => setShowEditor(false)} 
            onUpdated={handleUpdatedMeeting} 
          />
        )}

      </div>
    </div>
  );
}

export default App;
