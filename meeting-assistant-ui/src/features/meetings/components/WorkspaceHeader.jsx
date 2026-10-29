import {
  FileText,
  Clock,
  Columns,
  FolderOpen,
  Check,
  Copy,
  Radio,
  Target,
} from 'lucide-react';
import { formatMeetingDuration } from '../../../app/navigation.js';
import { GitHubMark, GmailMark } from '../../../shared/ui/BrandMarks.jsx';
import DocumentExportBar from './DocumentExportBar.jsx';

/**
 * Clean, structured workspace header with metadata, mode switcher, and actions.
 */
export default function WorkspaceHeader({
  file,
  meetingTitle,
  isDemoResult,
  result,
  currentMeetingId,
  wordCount,
  estimatedReadTime,
  viewMode,
  setViewMode,
  setShowConnectorsModal,
  setShowShareModal,
  onSaveMeeting,
  onShowEditor,
  isSavingMeeting,
  isContentSaving,
  canSaveMeeting,
  onCopyAll,
  isCopied,
  onDownloadMarkdown,
  onDownloadJson,
  onDownloadTxt,
  warnings = [],
}) {
  return (
    <header className="pb-6 border-b border-slate-200/80 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title and Metadata */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate" title={file?.name || meetingTitle}>
              {file?.name || meetingTitle || (isDemoResult ? 'Q3 Product & Budget Review' : 'Executive Meeting Document')}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${
              isDemoResult 
                ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                : result?.review_status === 'reviewed' 
                  ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                  : 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30'
            }`}>
              {isDemoResult ? 'DEMO' : result?.review_status === 'reviewed' ? 'REVIEWED' : 'DRAFT'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 font-mono tabular-nums">
            <span className="flex items-center gap-1 text-slate-700">
              <Clock className="w-3.5 h-3.5 text-indigo-700" />
              {formatMeetingDuration(result?.duration)}
            </span>
            <span>•</span>
            <span>~{wordCount} words</span>
            <span>•</span>
            <span>~{estimatedReadTime} min read</span>
            <span>•</span>
            <span className="uppercase text-slate-600">
              {result?.language ? `Lang: ${result.language}` : 'Auto-detected'}
            </span>
            {currentMeetingId && (
              <>
                <span>•</span>
                <span className="text-slate-500">Record #{currentMeetingId}</span>
                {result?.project_id && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-sans font-medium text-[11px]">
                      <FolderOpen className="w-3 h-3" />
                      Project #{result.project_id}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Segmented View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'studio'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Studio Document Editor"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="2-Column Split Inspector"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('zen')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'zen'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Fullscreen Zen Slide Deck Presentation"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Zen Deck</span>
            </button>
          </div>

          {/* Connect Hub */}
          <button
            type="button"
            onClick={() => setShowConnectorsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            title="Preview a GitHub issue or Gmail draft"
          >
            <GitHubMark size={14} /><GmailMark size={16} />
            <span>GitHub & Gmail</span>
          </button>

          {/* Save / Edit */}
          {!currentMeetingId && !isDemoResult && (
            <button
              type="button"
              onClick={onSaveMeeting}
              disabled={isContentSaving || !canSaveMeeting}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {isSavingMeeting ? 'Saving…' : 'Save this meeting'}
            </button>
          )}

          {currentMeetingId && !isDemoResult && (
            <button
              type="button"
              onClick={onShowEditor}
              disabled={isContentSaving}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-medium transition-all active:scale-[0.98] cursor-pointer"
            >
              Edit & Review
            </button>
          )}

          {/* Copy All */}
          <button
            type="button"
            onClick={onCopyAll}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all active:scale-[0.98] cursor-pointer"
            title="Copy full document text"
            aria-label="Copy full document text"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Share to Local Network */}
          {currentMeetingId && (
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
              title="Share to Local Network (Wi-Fi/LAN)"
              aria-label="Share meeting to LAN"
            >
              <Radio className="w-3.5 h-3.5 text-slate-600" />
              <span>Share LAN</span>
            </button>
          )}

          {/* Consolidated Export Dropdown */}
          <DocumentExportBar
            currentMeetingId={currentMeetingId}
            segments={result?.segments}
            fileName={file?.name}
            meetingTitle={meetingTitle}
            onDownloadMarkdown={onDownloadMarkdown}
            onDownloadJson={onDownloadJson}
            onDownloadTxt={onDownloadTxt}
          />
        </div>
      </div>

      {/* Demo / Warnings Banner */}
      {(isDemoResult || warnings.length > 0) && (
        <div role="status" className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 text-xs space-y-1">
          {isDemoResult && <p className="font-medium">Demo data — results are from the pre-packaged sample meeting.</p>}
          {warnings.map((w, idx) => <p key={idx}>{w}</p>)}
        </div>
      )}
    </header>
  );
}
