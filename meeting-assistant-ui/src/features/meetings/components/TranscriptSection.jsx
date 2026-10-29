import { FileText, Edit2, Play } from 'lucide-react';
import { normalizeCitation, speechDisplayText } from '../session.js';
import {
  getSpeakerBadgeStyle,
  getSpeakerAvatarStyle,
  getSpeakerInitial,
} from './speaker-styles.js';

/**
 * Filterable speaker dialogue transcript section with click-to-seek and rename.
 */
export default function TranscriptSection({
  result,
  transcriptView = 'segments',
  setTranscriptView,
  speakerFilter = 'all',
  setSpeakerFilter,
  onRenameSpeaker,
  onCycleSpeaker,
  onSeekAudio,
  audioUrl,
  activeHighlightStart,
  viewMode = 'studio',
  mmrTelemetry,
  isContentSaving = false,
}) {
  const segments = result?.segments || [];
  const speakers = Array.from(new Set(segments.map(s => s.speaker).filter(Boolean)));

  return (
    <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
            <FileText className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Attributed Dialogue Transcript</h2>
        </div>

        {/* View Sub-Toggle (Raw / Segments / MMR) */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setTranscriptView('raw')}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all cursor-pointer ${
              transcriptView === 'raw' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Text
          </button>
          {segments.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscriptView('segments')}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition-all cursor-pointer ${
                transcriptView === 'segments' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Segments ({segments.length})
            </button>
          )}
          {result?.condensed_transcript && (
            <button
              type="button"
              onClick={() => setTranscriptView('mmr')}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition-all cursor-pointer ${
                transcriptView === 'mmr' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MMR Filtered
            </button>
          )}
        </div>
      </div>

      {/* Speaker Filter Pills */}
      {transcriptView === 'segments' && segments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2 text-xs">
          <span className="text-slate-500 font-mono text-xs mr-1">Filter Speaker:</span>
          <button
            type="button"
            onClick={() => setSpeakerFilter('all')}
            className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
              speakerFilter === 'all'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
            }`}
          >
            All
          </button>
          {speakers.map((speaker) => {
            const isSelected = speakerFilter === speaker;
            return (
              <div key={speaker} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSpeakerFilter(speaker)}
                  className={`px-2.5 py-0.5 rounded-l-lg transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold border-indigo-500'
                      : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  {speaker}
                </button>
                <button
                  type="button"
                  onClick={() => onRenameSpeaker(speaker)}
                  disabled={isContentSaving}
                  title={`Rename speaker "${speaker}"`}
                  className={`px-1.5 py-0.5 rounded-r-lg border border-l-0 transition-all cursor-pointer ${
                    isSelected ? 'bg-indigo-700 border-indigo-500 text-white hover:text-indigo-100' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Transcript Dialogue Scroll Container */}
      <div className={`overflow-y-auto pr-1 space-y-2.5 scrollbar-thin ${viewMode === 'split' ? 'max-h-[700px]' : 'max-h-[500px]'}`}>
        {transcriptView === 'segments' && segments.length > 0 ? (
          segments
            .map((seg, originalIdx) => ({ seg, originalIdx }))
            .filter(({ seg }) => speakerFilter === 'all' || !seg.speaker || seg.speaker === speakerFilter)
            .map(({ seg, originalIdx }, displayIdx) => (
              <div 
                key={originalIdx} 
                id={`segment-${originalIdx}`}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all duration-200 group ${
                  activeHighlightStart !== null && Math.abs(Number(seg.start || 0) - Number(activeHighlightStart)) < 0.6
                    ? 'ring-2 ring-amber-400 bg-amber-50/80 border-amber-300 shadow-sm scale-[1.005]'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Speaker avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${getSpeakerAvatarStyle(seg.speaker)}`}>
                  {getSpeakerInitial(seg.speaker)}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs sm:text-sm tracking-tight">{seg.speaker || 'Speaker'}</span>

                      {seg.speaker_auto_identified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title={`Cross-meeting voiceprint recognized (${Math.round((seg.speaker_confidence || 0.82) * 100)}% match)`}>
                          Auto-ID {Math.round((seg.speaker_confidence || 0.82) * 100)}%
                        </span>
                      )}

                      {seg.glossary_corrections && seg.glossary_corrections.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200" title={seg.glossary_corrections.map(c => `${c.canonical} (${c.category})`).join(', ')}>
                          Glossary ({seg.glossary_corrections.length})
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(seg).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(seg).seconds)}
                        className="inline-flex items-center gap-1 font-mono text-xs text-teal-700 hover:text-teal-700 px-1.5 py-0.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all cursor-pointer disabled:opacity-40"
                        title={`Seek audio to ${seg.timestamp}`}
                      >
                        <Play className="w-2.5 h-2.5 fill-teal-400" />
                        <span>{seg.timestamp || `Turn #${displayIdx + 1}`}</span>
                      </button>
                    </div>

                    {seg.speaker && (
                      <button
                        type="button"
                        onClick={() => onCycleSpeaker(originalIdx)}
                        disabled={isContentSaving}
                        title="Click to cycle speaker attribution"
                        className={`px-2 py-0.5 rounded-md font-semibold text-xs border flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer ${getSpeakerBadgeStyle(seg.speaker)}`}
                      >
                        <span>{seg.speaker}</span>
                        <span className="text-xs opacity-60">⇄</span>
                      </button>
                    )}
                  </div>

                  <p 
                    className="text-sm sm:text-base text-slate-800 leading-relaxed font-sans cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => {
                      const secs = normalizeCitation(seg).seconds;
                      if (audioUrl && secs !== null) onSeekAudio(secs);
                    }}
                  >
                    {speechDisplayText(seg)}
                  </p>
                </div>
              </div>
            ))
        ) : transcriptView === 'mmr' && result?.condensed_transcript ? (
          <div className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap p-3 rounded-2xl bg-slate-50/60 border border-slate-200">
            {mmrTelemetry?.applied && <p className="mb-3 text-amber-700">Selected {mmrTelemetry.selected_sentences} of {mmrTelemetry.original_sentences} sentences; original transcript remains available.</p>}
            {result.condensed_transcript}
          </div>
        ) : (
          <div className="text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap p-3 rounded-2xl bg-slate-50/60 border border-slate-200">
            {result?.transcript}
          </div>
        )}
      </div>
    </article>
  );
}
