import FeedbackNotice from '../../shared/ui/FeedbackNotice.jsx';
import { microphoneMessage } from '../../shared/lib/user-errors.js';
import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, 
  Square, 
  Send, 
  Sparkles, 
  X, 
  Loader2, 
  Play, 
  Trash2,
  ChevronDown,
  MessageSquare,
  Bot
} from 'lucide-react';
import { shouldSubmitChat, normalizeCitation } from '../meetings/session.js';
import { createAudioRecording } from '../recording/recording.js';

/**
 * Format seconds into MM:SS display
 */
const formatRecordingTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Android Messenger-style Floating AI Chat Bubble & Pop-up Window
 * 
 * UX Decisions:
 * 1. Floating Chat Head Bubble: Anchored at bottom-right corner, freeing up the bottom workspace.
 * 2. Pop-up Window: Smoothly pops up above the bubble with frosted glass aesthetics.
 * 3. Multimodal Voice & Text: Integrated voice recorder with live soundwave equalizer and quick prompts.
 * 4. Keyboard Shortcuts: Esc to close popup, Enter to submit query.
 */
export default function CommandCenter({
  onSendChatMessage,
  chatMessages = [],
  isChatLoading = false,
  isBusy = false,
  isNavigationOpen = false,
  onClearChat,
  onRecordedAudio,
  suggestedPrompts = [],
  audioUrl = null,
  onSeekAudio,
  isMeetingLoaded = false,
  semanticChat = false,
  onToggleSemantic,
  renderFormattedChatText,
}) {
  const [chatInput, setChatInput] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('idle');
  const [recordingError, setRecordingError] = useState('');
  const isRecording = recordingStatus === 'recording' || recordingStatus === 'stopping';
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  
  const recordingRef = useRef(null);
  const onRecordedAudioRef = useRef(onRecordedAudio);
  const chatScrollRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const closeChat = useCallback(() => { setIsOpen(false); launcherRef.current?.focus(); }, []);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeChat]);

  useEffect(() => { onRecordedAudioRef.current = onRecordedAudio; }, [onRecordedAudio]);

  // Each mount owns its capture, including unresolved microphone permission.
  useEffect(() => {
    let timer;
    const recording = createAudioRecording({
      getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices),
      Recorder: globalThis.MediaRecorder,
      onStatusChange: status => {
        clearInterval(timer);
        setRecordingStatus(status);
        if (status === 'starting') setRecordingError('');
        if (status === 'recording') {
          setRecordingDuration(0);
          timer = setInterval(() => setRecordingDuration(previous => previous + 1), 1000);
        }
      },
      onRecordedAudio: file => onRecordedAudioRef.current?.(file),
      onError: error => {
        setRecordingError(microphoneMessage(error));
      },
    });
    recordingRef.current = recording;
    return () => {
      clearInterval(timer);
      recording.dispose();
      recordingRef.current = null;
    };
  }, []);

  const startRecording = () => recordingRef.current?.start();
  const stopRecording = () => recordingRef.current?.stop();

  const handleSend = (text) => {
    const query = typeof text === 'string' ? text : chatInput;
    if (!query || !query.trim() || isChatLoading || isBusy || !isMeetingLoaded) return;
    setChatInput('');
    setIsOpen(true);
    if (onSendChatMessage) {
      onSendChatMessage(query);
    }
  };

  return (
    <>
      <div 
        inert={isNavigationOpen}
        role="region" 
        aria-label="Floating AI Assistant"
        className="no-print fixed bottom-6 right-6 z-40 select-none flex flex-col items-end"
      >
        {/* Floating Chat Pop-up Window (Anchored above bubble on the right) */}
        {isOpen && (
          <div 
            id="clarion-assistant-panel"
            className="clarion-chat-popup mb-3 w-[calc(100vw-32px)] sm:w-[410px] md:w-[430px] h-[550px] max-h-[calc(100dvh-125px)] bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl shadow-2xl shadow-indigo-950/20 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 origin-bottom-right"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4654c6] to-[#7a88ef] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 tracking-tight truncate">AI Meeting Assistant</h3>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {isMeetingLoaded ? 'Grounded in meeting transcript' : 'Ready to record & analyze'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {chatMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearChat}
                    disabled={isChatLoading || isBusy}
                    aria-label="Clear chat messages"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeChat}
                  aria-label="Minimize chat bubble"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Minimize (Esc)"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={closeChat}
                  aria-label="Close chat window"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div 
              ref={chatScrollRef}
              role="log"
              aria-label="Meeting chat messages"
              aria-busy={isChatLoading}
              className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 text-sm">Ask about this meeting</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Answers include clickable citations to jump straight to exact audio timestamps.
                    </p>
                  </div>

                  {/* Quick Suggested Prompts when empty */}
                  {isMeetingLoaded && (
                    <div className="w-full pt-2 space-y-1.5 text-left">
                      <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider px-1">Suggested questions:</p>
                      <div className="space-y-1.5">
                        {(suggestedPrompts.length > 0 ? suggestedPrompts.slice(0, 3) : [
                          'What were the key decisions made?',
                          'List all extracted action items and owners',
                          'Were there any delivery risks or blockers?'
                        ]).map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleSend(prompt)}
                            disabled={isChatLoading || isBusy}
                            className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-200 text-slate-700 hover:text-indigo-900 text-xs transition-all active:scale-98 cursor-pointer shadow-2xs flex items-center justify-between group"
                          >
                            <span className="truncate pr-2">{prompt}</span>
                            <Sparkles className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 px-1 font-mono">
                        <span>{isUser ? 'You' : 'Meeting Assistant AI'}</span>
                        {msg.mode && (
                          <span className="px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 border border-slate-300">
                            {msg.mode}
                          </span>
                        )}
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                            : 'bg-slate-50/90 text-slate-800 border border-slate-200/80 rounded-tl-none'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {isUser ? msg.content : (renderFormattedChatText ? renderFormattedChatText(msg.content) : msg.content)}
                          {msg.streaming && <span aria-label="Generating answer" className="inline-block ml-0.5 w-0.5 h-3 align-middle bg-indigo-600 animate-pulse" />}
                        </div>

                        {/* Source Citations with Click-to-Seek */}
                        {!isUser && msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                              <Play className="w-2.5 h-2.5 text-indigo-700" /> Sources:
                            </span>
                            {msg.citations.map((cit, cIdx) => {
                              const citation = normalizeCitation(cit);
                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  disabled={!audioUrl || citation.seconds === null}
                                  onClick={() => onSeekAudio && onSeekAudio(citation.seconds)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 border border-indigo-500/40 text-xs font-mono transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                                  title={citation.seconds === null ? 'No audio timestamp' : `Jump audio to ${citation.label}`}
                                >
                                  <Play className="w-2 h-2 fill-indigo-300" />
                                  <span>{citation.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isChatLoading && !chatMessages.some(msg => msg.streaming && msg.content) && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-600 text-xs w-fit">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                  <span>AI is searching transcript & reasoning...</span>
                </div>
              )}
            </div>

            {/* Suggested Prompts Pills Carousel (Above Input) */}
            {chatMessages.length > 0 && isMeetingLoaded && suggestedPrompts.length > 0 && (
              <div className="px-3 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-slate-50/60 border-t border-slate-100 shrink-0">
                <span className="text-[11px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> Suggestions:
                </span>
                {suggestedPrompts.slice(0, 3).map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    disabled={isChatLoading || isBusy}
                    className="px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 text-[11px] whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                    title={prompt}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Pre-input options */}
            {isMeetingLoaded && (
              <div className="px-3.5 py-1 bg-slate-50/70 border-t border-slate-100 text-[11px] text-slate-600 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={semanticChat} 
                    onChange={onToggleSemantic}
                    disabled={isChatLoading || isBusy} 
                    className="accent-indigo-600 rounded cursor-pointer" 
                  />
                  <span>Hybrid retrieval (local embedding model)</span>
                </label>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-white/95 border-t border-slate-200/80 flex items-center gap-2 shrink-0">
              {/* Multimodal Recording Button */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isBusy || isChatLoading || recordingStatus === 'starting'}
                  aria-label={recordingStatus === 'starting' ? 'Requesting microphone access' : 'Start recording live audio'}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 transition-all active:scale-95 shrink-0 cursor-pointer shadow-2xs group"
                  title="Record audio from microphone"
                >
                  {recordingStatus === 'starting' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <Mic className="w-4 h-4 group-hover:scale-105 transition-transform" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={recordingStatus === 'stopping'}
                  aria-label="Stop recording audio"
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-rose-600/30 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="Click to stop recording"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <div className="flex items-center gap-0.5 h-3 px-0.5" aria-hidden="true">
                    <span className="w-0.5 bg-white rounded-full eq-bar-1" />
                    <span className="w-0.5 bg-white rounded-full eq-bar-2" />
                    <span className="w-0.5 bg-white rounded-full eq-bar-3" />
                  </div>
                  <span className="font-mono text-xs">{formatRecordingTime(recordingDuration)}</span>
                </button>
              )}

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (shouldSubmitChat(e)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isRecording 
                    ? 'Recording in progress... Click stop when done.' 
                    : isMeetingLoaded 
                      ? 'Ask AI about this meeting... (Enter)' 
                      : 'Ask AI or upload a recording...'
                }
                maxLength={4000}
                aria-label="Ask AI a question about this meeting"
                className="flex-1 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                disabled={isRecording || isChatLoading || isBusy || !isMeetingLoaded}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!chatInput.trim() || isChatLoading || isRecording || isBusy || !isMeetingLoaded}
                aria-label="Send question to AI"
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shrink-0 cursor-pointer shadow-xs"
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
        )}

        {/* Floating Chat Bubble Button (Android Messenger Chat Head Style) */}
        <div className="relative flex items-center justify-end group">
          {/* Subtle Hover Tooltip / Hint when closed */}
          {!isOpen && !isRecording && (
            <div className="pointer-events-none absolute right-full mr-3 whitespace-nowrap px-3 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5">
              <span>Ask about this meeting</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            </div>
          )}

          <button
            ref={launcherRef}
            type="button"
            onClick={() => isOpen ? closeChat() : setIsOpen(true)}
            aria-expanded={isOpen}
            aria-controls="clarion-assistant-panel"
            aria-label={isOpen ? "Close AI assistant" : "Open AI assistant chat bubble"}
            className={`clarion-chat-head w-14 h-14 sm:w-15 sm:h-15 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white/50 relative ${
              isRecording 
                ? 'bg-gradient-to-tr from-rose-600 to-rose-500 shadow-rose-600/40 ring-4 ring-rose-500/20' 
                : 'bg-gradient-to-tr from-[#4654c6] via-[#5c6be2] to-[#7a88ef] shadow-indigo-600/35 ring-4 ring-indigo-500/10'
            }`}
            title={isOpen ? "Close chat (Esc)" : "Ask AI Assistant"}
          >
            {/* Ping wave animation when recording */}
            {isRecording && (
              <>
                <span className="absolute -inset-1.5 rounded-full bg-rose-500/30 animate-pulse-wave" />
                <span className="absolute -inset-1 rounded-full bg-rose-500/20 animate-ping opacity-60" />
              </>
            )}

            {/* Icon Inside Bubble */}
            {isOpen ? (
              <X className="w-6 h-6 text-white transition-transform duration-200 hover:rotate-90" />
            ) : isRecording ? (
              <div className="flex flex-col items-center">
                <Square className="w-4 h-4 fill-white animate-pulse" />
                <span className="text-[9px] font-mono font-bold mt-0.5">{formatRecordingTime(recordingDuration)}</span>
              </div>
            ) : (
              <div className="relative">
                <MessageSquare className="w-6 h-6 fill-white/20 stroke-[2.2]" />
                <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
            )}

            {/* Online Status Green Indicator Dot */}
            {!isOpen && !isRecording && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-300 border-2 border-white rounded-full shadow-xs" aria-hidden="true" />
            )}

            {/* Unread message count badge */}
            {!isOpen && chatMessages.length > 0 && !isRecording && (
              <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 bg-rose-500 text-white text-[11px] font-bold rounded-full border-2 border-white flex items-center justify-center shadow-xs">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {recordingError && (
        <FeedbackNotice key={recordingError} title="Check your microphone" onDismiss={() => setRecordingError('')}>
          {recordingError}
        </FeedbackNotice>
      )}
    </>
  );
}
