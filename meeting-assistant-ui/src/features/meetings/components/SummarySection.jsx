import { Sparkles, Copy, Check } from 'lucide-react';

/**
 * Executive Summary Section Component
 */
export default function SummarySection({
  summary,
  modelName,
  onCopySummary,
  summaryCopied,
}) {
  return (
    <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Executive Summary</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopySummary}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200 border border-slate-300/60 transition-all active:scale-95 cursor-pointer"
            title="Copy summary"
          >
            {summaryCopied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
            <span>{summaryCopied ? 'Copied' : 'Copy'}</span>
          </button>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            {modelName || 'Local Model'}
          </span>
        </div>
      </div>

      <div className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
        {summary}
      </div>
    </article>
  );
}
