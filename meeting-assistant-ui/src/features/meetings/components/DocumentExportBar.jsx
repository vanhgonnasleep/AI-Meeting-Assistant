import { Download, FileCode, FileText, Printer } from 'lucide-react';
import { downloadSrt, downloadVtt } from '../subtitles.js';

/**
 * Clean, unified document export controls.
 * Replaces scattered rainbow buttons with a cohesive, calm action group.
 */
export default function DocumentExportBar({
  currentMeetingId,
  segments = [],
  fileName,
  meetingTitle,
  onDownloadMarkdown,
  onDownloadJson,
  onDownloadTxt,
}) {
  const title = fileName || meetingTitle || 'Meeting';
  const hasSubtitles = Array.isArray(segments) && segments.length > 0;

  return (
    <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/90 border border-slate-200 shadow-xs">
      {/* Word DOCX (if saved) */}
      {currentMeetingId && (
        <button
          type="button"
          onClick={() => window.open(`/api/meetings/${currentMeetingId}/export/docx`, '_blank')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
          title="Export Word Document (.DOCX)"
          aria-label="Export Word DOCX file"
        >
          <FileText className="w-3.5 h-3.5 text-slate-600" />
          <span>DOCX</span>
        </button>
      )}

      {/* Markdown */}
      <button
        type="button"
        onClick={onDownloadMarkdown}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
        title="Export Markdown (.MD)"
        aria-label="Export Markdown file"
      >
        <Download className="w-3.5 h-3.5 text-slate-600" />
        <span>MD</span>
      </button>

      {/* JSON */}
      <button
        type="button"
        onClick={onDownloadJson}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
        title="Export Raw Data (.JSON)"
        aria-label="Export JSON file"
      >
        <FileCode className="w-3.5 h-3.5 text-slate-600" />
        <span>JSON</span>
      </button>

      {/* TXT */}
      <button
        type="button"
        onClick={onDownloadTxt}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
        title="Export Plain Text (.TXT)"
        aria-label="Export text file"
      >
        <FileText className="w-3.5 h-3.5 text-slate-600" />
        <span>TXT</span>
      </button>

      {/* Subtitles (SRT & VTT) */}
      {hasSubtitles && (
        <>
          <button
            type="button"
            onClick={() => downloadSrt(segments, title)}
            className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
            title="Export AI Subtitles (.SRT)"
            aria-label="Export Subtitles SRT"
          >
            SRT
          </button>
          <button
            type="button"
            onClick={() => downloadVtt(segments, title)}
            className="px-2 py-1 rounded-lg hover:bg-white text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer"
            title="Export WebVTT Subtitles (.VTT)"
            aria-label="Export Subtitles VTT"
          >
            VTT
          </button>
        </>
      )}

      {/* Print / Save as PDF */}
      <button
        type="button"
        onClick={() => window.print()}
        className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
        title="Print or Save as PDF"
        aria-label="Print or Save as PDF"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
