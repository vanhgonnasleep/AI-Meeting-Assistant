import { Volume2, RotateCcw, RotateCw } from 'lucide-react';

/**
 * Clean, restrained audio playback bar with dialogue jump sync.
 */
export default function AudioSyncBar({
  audioRef,
  src,
  playbackSpeed = 1.0,
  onSkip,
  onToggleSpeed,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200 shadow-xs">
      <div className="flex items-center gap-2.5 w-full sm:w-auto">
        <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
          <Volume2 className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-900">Audio Sync Player</p>
          <p className="text-xs text-slate-500">Click any dialogue or citation to jump audio position</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSkip(-5)}
          className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1 text-xs font-mono cursor-pointer active:scale-95"
          title="Rewind 5 seconds"
        >
          <RotateCcw className="w-3 h-3" />
          <span>-5s</span>
        </button>

        <button
          type="button"
          onClick={() => onSkip(5)}
          className="p-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1 text-xs font-mono cursor-pointer active:scale-95"
          title="Forward 5 seconds"
        >
          <RotateCw className="w-3 h-3" />
          <span>+5s</span>
        </button>

        <button
          type="button"
          onClick={onToggleSpeed}
          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95"
          title="Cycle playback speed"
        >
          {playbackSpeed}x
        </button>

        <audio ref={audioRef} controls src={src} className="h-8 max-w-[200px] sm:max-w-xs accent-indigo-600" />
      </div>
    </div>
  );
}
