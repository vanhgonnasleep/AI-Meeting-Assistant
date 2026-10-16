import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Send, 
  Sparkles, 
  X, 
  Loader2, 
  Play, 
  Trash2,
  ChevronUp,
  ChevronDown
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
 * Staff-level Command Center Dock Component
 * 
 * UX Decisions:
 * 1. Apple-style Frosted Glass Dock: Pinned at bottom center with backdrop-blur-sm, keeping workspace clean.
 * 2. Meaningful Motion:
 *    - Idle: Minimalist mic button with snappy spring hover.
 *    - Listening/Recording: Concentric ping waves, active recording counter, and animated soundwave equalizer.
 * 3. Unified Multimodal Entry: Both voice capture and text-based RAG query in a single compact interface.
 * 4. Progressive Disclosure: Chat conversation slides upward seamlessly without occluding primary content.
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
  const isRecording = recordingStatus === 'recording' || recordingStatus === 'stopping';
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const recordingRef = useRef(null);
  const onRecordedAudioRef = useRef(onRecordedAudio);
  const chatScrollRef = useRef(null);

  // Auto-scroll chat drawer to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

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
        if (status === 'recording') {
          setRecordingDuration(0);
          timer = setInterval(() => setRecordingDuration(previous => previous + 1), 1000);
        }
      },
      onRecordedAudio: file => onRecordedAudioRef.current?.(file),
      onError: error => {
        console.error('Audio recording failed:', error);
        alert(error.name === 'NotAllowedError'
          ? 'Unable to access microphone. Please ensure microphone permissions are granted.'
          : error.message || 'Unable to record audio. Please try again.');
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
    setIsDrawerOpen(true);
    if (onSendChatMessage) {
      onSendChatMessage(query);
    }
  };

  return (
    <div 
      inert={isNavigationOpen}
      role="region" 
      aria-label="Floating AI command center dock" 
      className="clarion-dock no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl select-none"
    >
      {/* Sliding AI Chat Drawer (Slides Up Above Dock) */}
      {isDrawerOpen && (
        <div 
          className="chat-drawer mb-3 w-full bg-white/95 backdrop-blur-xl border border-slate-300/80 rounded-3xl shadow-glass shadow-slate-950/80 p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col max-h-[460px]"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">AI Meeting Intelligence (Agent 6)</h3>
                <p className="text-[10px] text-slate-600">Context-grounded RAG with source turn citations</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearChat}
                  disabled={isChatLoading || isBusy}
                  aria-label="Clear chat messages"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-500/10 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close conversation drawer"
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Close drawer (Esc)"
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
            className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin max-h-[320px] pr-1"
          >
            {chatMessages.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-xs space-y-2">
                <p className="font-medium text-slate-700">Ready to answer questions about this meeting.</p>
                <p className="text-[11px] text-slate-500">
                  Ask about deliverables, budget allocations, blockers, or timeline commitments.
                </p>
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
                        <span className="px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 border border-slate-300">
                          {msg.mode}
                        </span>
                      )}
                    </div>
                    <div
                      className={`p-3.5 rounded-2xl max-w-[88%] text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
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
                          <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 border border-indigo-500/40 text-[10px] font-mono transition-all active:scale-95 cursor-pointer disabled:opacity-40"
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
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50/60 border border-slate-200 text-slate-600 text-xs w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                <span>AI is analyzing transcript context and citations...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Prompts Pills Carousel (Above Dock) */}
      {isMeetingLoaded && suggestedPrompts.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider shrink-0 flex items-center gap-1 px-1">
            <Sparkles className="w-3 h-3 text-indigo-700" /> Suggestions:
          </span>
          {suggestedPrompts.slice(0, 3).map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={isChatLoading || isBusy}
              className="px-2.5 py-1 rounded-xl bg-white/90 hover:bg-indigo-600/25 border border-slate-300/60 hover:border-indigo-500/50 text-slate-700 hover:text-slate-900 text-xs whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs shrink-0"
              title={prompt}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Floating Frosted Dock Container */}
      {isMeetingLoaded && <label className="flex items-center gap-2 px-2 pb-1 text-xs text-slate-600">
        <input type="checkbox" checked={semanticChat} onChange={onToggleSemantic}
          disabled={isChatLoading || isBusy} className="accent-indigo-500" />
        Hybrid retrieval (requires a local embedding model)
      </label>}
      <div className="command-controls relative flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-300/60 shadow-glass shadow-slate-950/80">
        
        {/* Multimodal Recording Button with Fluid Motion States */}
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={isBusy || isChatLoading || recordingStatus === 'starting'}
            aria-label={recordingStatus === 'starting' ? 'Requesting microphone access' : 'Start recording live audio'}
            className="p-2.5 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/60 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs group"
            title="Record live audio from microphone"
          >
            {recordingStatus === 'starting' ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Mic className="w-4 h-4 group-hover:text-indigo-700 transition-colors" />}
          </button>
        ) : (
          /* Fluid Pulse / Wave Animation for "AI is Listening/Recording" state */
          <div className="relative flex items-center shrink-0">
            {/* Outward Radiating Soundwaves */}
            <span className="absolute -inset-1.5 rounded-xl bg-rose-500/30 animate-pulse-wave" />
            <span className="absolute -inset-1 rounded-xl bg-rose-500/20 animate-ping opacity-60" />
            
            <button
              type="button"
              onClick={stopRecording}
              disabled={recordingStatus === 'stopping'}
              aria-label="Stop recording audio"
              className="relative flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer z-10"
              title="Click to stop recording and process"
            >
              <Square className="w-3 h-3 fill-white" />
              {/* Animated Soundwave Equalizer Bars */}
              <div className="flex items-center gap-0.5 h-3 px-0.5" aria-hidden="true">
                <span className="w-0.5 bg-white rounded-full eq-bar-1" />
                <span className="w-0.5 bg-white rounded-full eq-bar-2" />
                <span className="w-0.5 bg-white rounded-full eq-bar-3" />
                <span className="w-0.5 bg-white rounded-full eq-bar-4" />
                <span className="w-0.5 bg-white rounded-full eq-bar-5" />
              </div>
              <span className="font-mono text-[11px]">
                {formatRecordingTime(recordingDuration)}
              </span>
            </button>
          </div>
        )}

        {/* Text Input Field */}
        <div className="command-input flex-1 min-w-0 flex items-center">
          <input
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
                ? 'Recording in progress... Click stop when finished.' 
                : isMeetingLoaded 
                  ? 'Ask AI a question about this meeting... (Press Enter)' 
                  : 'Ask AI or upload a recording to start analyzing...'
            }
            maxLength={4000}
            aria-label="Ask AI a question about this meeting"
            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-500 outline-hidden"
            disabled={isRecording || isChatLoading || isBusy || !isMeetingLoaded}
          />
        </div>

        {/* Toggle Drawer Button */}
        {chatMessages.length > 0 && (
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            aria-label={isDrawerOpen ? 'Collapse chat drawer' : 'Expand chat drawer'}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            title={isDrawerOpen ? 'Collapse drawer' : 'Expand conversation'}
          >
            {isDrawerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Submit Question Button */}
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!chatInput.trim() || isChatLoading || isRecording || isBusy || !isMeetingLoaded}
          aria-label="Send question to AI"
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shrink-0 cursor-pointer shadow-xs shadow-indigo-600/30"
          title="Send query"
        >
          {isChatLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>

      </div>
    </div>
  );
}
