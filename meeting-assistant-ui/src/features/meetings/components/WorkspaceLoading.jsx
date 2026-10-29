import { Loader2, Clock } from 'lucide-react';

/**
 * Skeletal shimmer loading screen displayed while local AI models are analyzing audio.
 */
export default function WorkspaceLoading({ elapsedTime, onStopWaiting }) {
  return (
    <div className="space-y-7 max-w-[1400px] mx-auto py-8">
      {/* Processing Banner */}
      <div className="bg-white/80 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-8 shadow-glass flex flex-col items-center justify-center text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <span className="absolute -inset-2 rounded-2xl bg-indigo-500/10 animate-ping opacity-60" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            Analyzing Recording with Local AI
          </h3>
          <p className="text-xs text-slate-600 max-w-md">
            Running multi-agent pipeline (Whisper STT, MMR Redundancy Filter, Llama 3 Summary & Task Extraction).
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-700">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 font-mono tabular-nums text-xs text-indigo-700">
            <Clock className="w-3 h-3" /> Elapsed: {elapsedTime}s
          </span>
          <div className="flex items-center gap-1 h-3" aria-hidden="true">
            <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse" />
            <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse delay-100" />
            <span className="w-1 h-3 bg-indigo-400 rounded-full animate-pulse delay-200" />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onStopWaiting}
            className="text-xs text-slate-600 hover:text-slate-800 underline transition-colors cursor-pointer"
          >
            Stop waiting
          </button>
        </div>
      </div>

      {/* Shimmer Skeleton Document Layout */}
      <div className="space-y-6 opacity-60 pointer-events-none select-none">
        <div className="space-y-2">
          <div className="h-7 w-72 bg-slate-100 rounded-xl skeleton-shimmer" />
          <div className="h-4 w-48 bg-slate-100/60 rounded-lg skeleton-shimmer" />
        </div>

        <div className="p-6 rounded-3xl bg-white/40 border border-slate-200 space-y-3">
          <div className="h-4 w-36 bg-slate-100 rounded-sm skeleton-shimmer" />
          <div className="h-3 w-full bg-slate-100/60 rounded-sm skeleton-shimmer" />
          <div className="h-3 w-5/6 bg-slate-100/60 rounded-sm skeleton-shimmer" />
          <div className="h-3 w-3/4 bg-slate-100/60 rounded-sm skeleton-shimmer" />
        </div>

        <div className="p-6 rounded-3xl bg-white/40 border border-slate-200 space-y-3">
          <div className="h-4 w-44 bg-slate-100 rounded-sm skeleton-shimmer" />
          <div className="h-10 w-full bg-slate-100/40 rounded-xl skeleton-shimmer" />
          <div className="h-10 w-full bg-slate-100/40 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
