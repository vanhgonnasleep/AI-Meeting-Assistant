import { useState } from 'react';
import LazyPanel from '../../shared/ui/LazyPanel.jsx';
import ConnectorsModal from '../connectors/ConnectorsModal.jsx';
import { formatMeetingDuration } from '../../app/navigation.js';
import VideoSubtitlesPlayer from './VideoSubtitlesPlayer.jsx';
import TranscriptReview from './TranscriptReview.jsx';
import ShareModal from './ShareModal.jsx';

import WorkspaceLoading from './components/WorkspaceLoading.jsx';
import WorkspaceDropzone from './components/WorkspaceDropzone.jsx';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
import SummarySection from './components/SummarySection.jsx';
import TasksSection from './components/TasksSection.jsx';
import InsightsSection from './components/InsightsSection.jsx';
import TranscriptSection from './components/TranscriptSection.jsx';
import AudioSyncBar from './components/AudioSyncBar.jsx';

const loadPresentationDeck = () => import('./PresentationDeck.jsx');

/**
 * Staff-level Document Workspace Component
 * 
 * Modular orchestrator connecting:
 * - WorkspaceLoading: Skeletal shimmer processing state
 * - WorkspaceDropzone: File intake and local model tuning
 * - WorkspaceHeader: Metadata bar, navigation modes, consolidated export
 * - Media Players: VideoSubtitlesPlayer (video) & AudioSyncBar (audio)
 * - Domain Sections: Summary, Action Deliverables, 3-Pillar Insights, Attributed Transcript
 */
export default function DocumentWorkspace({
  result,
  isProcessing,
  elapsedTime,
  file,
  audioUrl,
  audioRef,
  currentMeetingId,
  meetingTitle,
  isDemoResult,
  warnings = [],
  completedTasks = {},
  updatingTasks = {},
  onToggleTask,
  onSeekAudio,
  onReviewPassage,
  reviewSession,
  onAttachReviewAudio,
  onCopyAll,
  isCopied,
  onCopySummary,
  summaryCopied,
  onDownloadMarkdown,
  onDownloadJson,
  onDownloadTxt,
  onSaveMeeting,
  isSavingMeeting,
  isContentSaving = false,
  canSaveMeeting = true,
  onShowEditor,
  onRenameSpeaker,
  onCycleSpeaker,
  selectedModel,
  setSelectedModel,
  spokenLanguage,
  setSpokenLanguage,
  enableMmr,
  setEnableMmr,
  mmrLambda,
  setMmrLambda,
  showAdvancedMmr,
  setShowAdvancedMmr,
  enableDiarization,
  setEnableDiarization,
  numSpeakers,
  setNumSpeakers,
  speakerFilter,
  setSpeakerFilter,
  transcriptView,
  setTranscriptView,
  mmrTelemetry,
  metaInfo,
  saveToLibrary,
  setSaveToLibrary,
  getRootProps,
  getInputProps,
  isDragActive,
  uploadError,
  uploadLimits,
  handleReset,
  handleDemoSample,
  onStopWaiting,
}) {
  const [activeDocTab, setActiveDocTab] = useState('doc');
  const [viewMode, setViewMode] = useState('studio');
  const [showConnectorsModal, setShowConnectorsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeHighlightStart, setActiveHighlightStart] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const isVideoMedia = Boolean(
    file?.type?.startsWith('video/') ||
    /\.(mp4|webm|mkv|mov)$/i.test(file?.name || '') ||
    /\.(mp4|webm|mkv|mov)$/i.test(result?.filename || '') ||
    (typeof audioUrl === 'string' && /\.(mp4|webm|mkv|mov)($|\?)/i.test(audioUrl))
  );

  const handleSkipAudio = (seconds) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
    }
  };

  const handleTogglePlaybackSpeed = () => {
    if (audioRef?.current) {
      const speeds = [1.0, 1.25, 1.5, 2.0];
      const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length] || 1.0;
      audioRef.current.playbackRate = next;
      setPlaybackSpeed(next);
    }
  };

  const wordCount = result?.transcript ? result.transcript.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadTime = Math.ceil(wordCount / 200);
  const totalTasks = result?.action_items?.length || 0;
  const completedCount = Object.values(completedTasks).filter(Boolean).length;

  if (isProcessing) {
    return <WorkspaceLoading elapsedTime={elapsedTime} onStopWaiting={onStopWaiting} />;
  }

  if (!result) {
    return (
      <WorkspaceDropzone
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        spokenLanguage={spokenLanguage}
        setSpokenLanguage={setSpokenLanguage}
        enableMmr={enableMmr}
        setEnableMmr={setEnableMmr}
        showAdvancedMmr={showAdvancedMmr}
        setShowAdvancedMmr={setShowAdvancedMmr}
        mmrLambda={mmrLambda}
        setMmrLambda={setMmrLambda}
        enableDiarization={enableDiarization}
        setEnableDiarization={setEnableDiarization}
        numSpeakers={numSpeakers}
        setNumSpeakers={setNumSpeakers}
        saveToLibrary={saveToLibrary}
        setSaveToLibrary={setSaveToLibrary}
        isContentSaving={isContentSaving}
        uploadError={uploadError}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        file={file}
        audioUrl={audioUrl}
        isVideoMedia={isVideoMedia}
        audioRef={audioRef}
        uploadLimits={uploadLimits}
        handleReset={handleReset}
        handleDemoSample={handleDemoSample}
      />
    );
  }

  return (
    <div className={`space-y-7 ${viewMode === 'split' ? 'max-w-7xl' : 'max-w-[1400px]'} mx-auto pt-2 pb-6 select-text transition-all duration-300`}>
      <WorkspaceHeader
        file={file}
        meetingTitle={meetingTitle}
        isDemoResult={isDemoResult}
        result={result}
        currentMeetingId={currentMeetingId}
        wordCount={wordCount}
        estimatedReadTime={estimatedReadTime}
        viewMode={viewMode}
        setViewMode={setViewMode}
        setShowConnectorsModal={setShowConnectorsModal}
        setShowShareModal={setShowShareModal}
        onSaveMeeting={onSaveMeeting}
        onShowEditor={onShowEditor}
        isSavingMeeting={isSavingMeeting}
        isContentSaving={isContentSaving}
        canSaveMeeting={canSaveMeeting}
        onCopyAll={onCopyAll}
        isCopied={isCopied}
        onDownloadMarkdown={onDownloadMarkdown}
        onDownloadJson={onDownloadJson}
        onDownloadTxt={onDownloadTxt}
        warnings={warnings}
      />

      {/* Transcript Review Passage Inspector */}
      <TranscriptReview
        key={reviewSession}
        segments={result?.segments}
        audioUrl={audioUrl}
        onSeekAudio={onSeekAudio}
        onReviewPassage={onReviewPassage}
        onAttachReviewAudio={onAttachReviewAudio}
        busy={isContentSaving}
      />

      {/* Media Player Sync Bar (Video or Audio) */}
      {audioUrl && (
        isVideoMedia ? (
          <VideoSubtitlesPlayer
            ref={audioRef}
            src={audioUrl}
            segments={result?.segments || []}
            title={file?.name || meetingTitle || 'Meeting Video'}
            onSeek={onSeekAudio}
          />
        ) : (
          <AudioSyncBar
            audioRef={audioRef}
            src={audioUrl}
            playbackSpeed={playbackSpeed}
            onSkip={handleSkipAudio}
            onToggleSpeed={handleTogglePlaybackSpeed}
          />
        )
      )}

      {!isDemoResult && (
        <p className="text-xs text-slate-600">
          {currentMeetingId ? 'Saved to library' : 'Session only — save or export before reloading or starting another meeting.'}
        </p>
      )}

      {/* VIEW MODE 1: STUDIO (STANDARD TABBED WORKSPACE) */}
      {viewMode === 'studio' && (
        <div className="space-y-6">
          <nav aria-label="Document sections" className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/70 border border-slate-200 text-xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveDocTab('doc')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeDocTab === 'doc' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Document
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('summary')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeDocTab === 'summary' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('tasks')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeDocTab === 'tasks' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Action Items</span>
              {totalTasks > 0 && (
                <span className="text-xs font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                  {completedCount}/{totalTasks}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('insights')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeDocTab === 'insights' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Decisions & Risks
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('transcript')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                activeDocTab === 'transcript' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transcript
            </button>
          </nav>

          {(activeDocTab === 'doc' || activeDocTab === 'summary') && (
            <SummarySection
              summary={result?.summary}
              modelName={result?.model_name || metaInfo?.model}
              onCopySummary={onCopySummary}
              summaryCopied={summaryCopied}
            />
          )}

          {(activeDocTab === 'doc' || activeDocTab === 'tasks') && (
            <TasksSection
              actionItems={result?.action_items}
              completedTasks={completedTasks}
              updatingTasks={updatingTasks}
              onToggleTask={onToggleTask}
              isContentSaving={isContentSaving}
              currentMeetingId={currentMeetingId}
            />
          )}

          {(activeDocTab === 'doc' || activeDocTab === 'insights') && (
            <InsightsSection
              insights={result?.insights}
              viewMode="studio"
              audioUrl={audioUrl}
              onSeekAudio={onSeekAudio}
              setActiveHighlightStart={setActiveHighlightStart}
            />
          )}

          {(activeDocTab === 'doc' || activeDocTab === 'transcript') && (
            <TranscriptSection
              result={result}
              transcriptView={transcriptView}
              setTranscriptView={setTranscriptView}
              speakerFilter={speakerFilter}
              setSpeakerFilter={setSpeakerFilter}
              onRenameSpeaker={onRenameSpeaker}
              onCycleSpeaker={onCycleSpeaker}
              onSeekAudio={onSeekAudio}
              audioUrl={audioUrl}
              activeHighlightStart={activeHighlightStart}
              viewMode="studio"
              mmrTelemetry={mmrTelemetry}
              isContentSaving={isContentSaving}
            />
          )}
        </div>
      )}

      {/* VIEW MODE 2: SPLIT (2-COLUMN PRODUCTIVITY INSPECTOR) */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <TranscriptSection
              result={result}
              transcriptView={transcriptView}
              setTranscriptView={setTranscriptView}
              speakerFilter={speakerFilter}
              setSpeakerFilter={setSpeakerFilter}
              onRenameSpeaker={onRenameSpeaker}
              onCycleSpeaker={onCycleSpeaker}
              onSeekAudio={onSeekAudio}
              audioUrl={audioUrl}
              activeHighlightStart={activeHighlightStart}
              viewMode="split"
              mmrTelemetry={mmrTelemetry}
              isContentSaving={isContentSaving}
            />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <SummarySection
              summary={result?.summary}
              modelName={result?.model_name || metaInfo?.model}
              onCopySummary={onCopySummary}
              summaryCopied={summaryCopied}
            />
            <TasksSection
              actionItems={result?.action_items}
              completedTasks={completedTasks}
              updatingTasks={updatingTasks}
              onToggleTask={onToggleTask}
              isContentSaving={isContentSaving}
              currentMeetingId={currentMeetingId}
            />
            <InsightsSection
              insights={result?.insights}
              viewMode="split"
              audioUrl={audioUrl}
              onSeekAudio={onSeekAudio}
              setActiveHighlightStart={setActiveHighlightStart}
            />
          </div>
        </div>
      )}

      {/* VIEW MODE 3: ZEN SLIDE DECK PRESENTATION */}
      {viewMode === 'zen' && (
        <LazyPanel
          load={loadPresentationDeck}
          name="the presentation"
          onClose={() => setViewMode('studio')}
          errorClassName="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4 p-6"
          fallback={
            <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
              <p role="status" className="text-sm text-slate-600">Loading presentation…</p>
              <button
                type="button"
                onClick={() => setViewMode('studio')}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 cursor-pointer"
              >
                Close presentation
              </button>
            </div>
          }
        >
          {(PresentationDeck) => (
            <PresentationDeck
              meetingData={{
                title: file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document'),
                date: metaInfo?.hardware ? metaInfo.hardware.split('•')[1]?.trim() : new Date().toISOString().split('T')[0],
                duration: formatMeetingDuration(result?.duration),
                summary: result?.summary,
                keyDecisions: result?.insights?.decisions?.map(d => typeof d === 'object' ? d.text : d) || result?.key_decisions || [],
                risks: result?.insights?.risks?.map(r => typeof r === 'object' ? r.text : r) || result?.risks || [],
                attendees: Array.from(new Set((result?.segments || []).map(s => s.speaker).filter(Boolean)))
              }}
              actionItems={result?.action_items?.map(item => typeof item === 'object' ? { text: item.task, assignee: item.assignee, due: item.deadline } : item) || []}
              completedTasks={new Set(Object.entries(completedTasks).filter(([, v]) => Boolean(v)).map(([k]) => { const n = Number(k); return Number.isFinite(n) ? n : k; }))}
              onToggleTask={onToggleTask}
              onExit={() => setViewMode('studio')}
            />
          )}
        </LazyPanel>
      )}

      {/* Local Network Share Modal */}
      {showShareModal && currentMeetingId && (
        <ShareModal
          meetingId={currentMeetingId}
          meetingTitle={file?.name || meetingTitle || 'Meeting Document'}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Connectors Hub Sheet */}
      <ConnectorsModal
        isOpen={showConnectorsModal}
        onClose={() => setShowConnectorsModal(false)}
        meetingData={{
          id: currentMeetingId,
          meetingId: currentMeetingId,
          title: file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document'),
          date: new Date().toISOString().split('T')[0],
          summary: result?.summary,
          keyDecisions: result?.insights?.decisions?.map(d => typeof d === 'object' ? d.text : d) || result?.key_decisions || [],
          risks: result?.insights?.risks?.map(r => typeof r === 'object' ? r.text : r) || result?.risks || [],
          attendees: Array.from(new Set((result?.segments || []).map(s => s.speaker).filter(Boolean)))
        }}
        actionItems={result?.action_items?.map(item => typeof item === 'object' ? { text: item.task, assignee: item.assignee, due: item.deadline } : item) || []}
        completedTasks={new Set(Object.entries(completedTasks).filter(([, v]) => Boolean(v)).map(([k]) => { const n = Number(k); return Number.isFinite(n) ? n : k; }))}
      />

      {/* Subtle Editorial Footer */}
      <footer className="pt-6 border-t border-slate-200/60 text-xs text-slate-500 text-center">
        Review generated notes and decisions against the source transcript before distribution.
      </footer>
    </div>
  );
}
