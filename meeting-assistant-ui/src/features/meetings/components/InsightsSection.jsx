import { Target, CheckCircle2, AlertTriangle, HelpCircle, Play } from 'lucide-react';
import { normalizeCitation } from '../session.js';
import { getSpeakerBadgeStyle } from './speaker-styles.js';

/**
 * Key Decisions, Risks, and Open Questions 3-pillar intelligence section.
 */
export default function InsightsSection({
  insights = {},
  viewMode = 'studio',
  audioUrl,
  onSeekAudio,
  setActiveHighlightStart,
}) {
  const decisions = insights?.decisions || [];
  const risks = insights?.risks || [];
  const openQuestions = insights?.open_questions || [];

  return (
    <article className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Key Decisions & Risk Matrix</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">3-pillar governance intelligence with click-to-seek audio evidence</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
          Agent 5 Governance
        </span>
      </div>

      <div className={`grid grid-cols-1 ${viewMode === 'split' ? 'grid-cols-1' : 'md:grid-cols-3'} gap-4`}>
        {/* Pillar 1: Decisions */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Decisions</span>
            </div>
            <span className="text-xs font-mono text-slate-600 font-bold">
              {decisions.length}
            </span>
          </div>
          <div className="space-y-2">
            {decisions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No key decisions extracted.</p>
            ) : (
              decisions.map((dec, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => {
                    const sec = normalizeCitation(dec).seconds;
                    if (sec !== null && setActiveHighlightStart) setActiveHighlightStart(sec);
                  }}
                  onMouseLeave={() => setActiveHighlightStart && setActiveHighlightStart(null)}
                  className="p-2.5 rounded-xl bg-white/60 hover:bg-emerald-50/50 hover:border-emerald-300 border border-slate-200/80 space-y-1.5 group transition-colors"
                >
                  <p className="text-xs text-slate-800 leading-snug">{dec.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs">
                    {dec.speaker && (
                      <span className={`px-1.5 py-0.2 rounded-sm border ${getSpeakerBadgeStyle(dec.speaker)}`}>
                        {dec.speaker}
                      </span>
                    )}
                    {dec.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(dec).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(dec).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-sm bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-700 border border-emerald-500/30 font-mono transition-all cursor-pointer active:scale-[0.96] disabled:opacity-40"
                        title={`Jump audio to ${dec.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-emerald-300" />
                        <span>{dec.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 2: Risks & Blockers */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Risks & Blockers</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 font-bold">
              {risks.length}
            </span>
          </div>
          <div className="space-y-2">
            {risks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No critical delivery risks detected.</p>
            ) : (
              risks.map((risk, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => {
                    const sec = normalizeCitation(risk).seconds;
                    if (sec !== null && setActiveHighlightStart) setActiveHighlightStart(sec);
                  }}
                  onMouseLeave={() => setActiveHighlightStart && setActiveHighlightStart(null)}
                  className="p-2.5 rounded-xl bg-white/60 hover:bg-emerald-50/50 hover:border-emerald-300 border border-slate-200/80 space-y-1.5 group transition-colors"
                >
                  <p className="text-xs text-slate-800 leading-snug">{risk.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs">
                    {risk.speaker && (
                      <span className={`px-1.5 py-0.2 rounded-sm border ${getSpeakerBadgeStyle(risk.speaker)}`}>
                        {risk.speaker}
                      </span>
                    )}
                    {risk.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(risk).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(risk).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-sm bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 border border-amber-500/30 font-mono transition-all cursor-pointer active:scale-[0.96] disabled:opacity-40"
                        title={`Jump audio to ${risk.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-amber-300" />
                        <span>{risk.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pillar 3: Open Questions */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Open Questions</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 font-bold">
              {openQuestions.length}
            </span>
          </div>
          <div className="space-y-2">
            {openQuestions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No open questions recorded.</p>
            ) : (
              openQuestions.map((q, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => {
                    const sec = normalizeCitation(q).seconds;
                    if (sec !== null && setActiveHighlightStart) setActiveHighlightStart(sec);
                  }}
                  onMouseLeave={() => setActiveHighlightStart && setActiveHighlightStart(null)}
                  className="p-2.5 rounded-xl bg-white/60 hover:bg-emerald-50/50 hover:border-emerald-300 border border-slate-200/80 space-y-1.5 group transition-colors"
                >
                  <p className="text-xs text-slate-800 leading-snug">{q.text}</p>
                  <div className="flex flex-wrap items-center gap-1 pt-0.5 text-xs">
                    {q.speaker && (
                      <span className={`px-1.5 py-0.2 rounded-sm border ${getSpeakerBadgeStyle(q.speaker)}`}>
                        {q.speaker}
                      </span>
                    )}
                    {q.timestamp && (
                      <button
                        type="button"
                        disabled={!audioUrl || normalizeCitation(q).seconds === null}
                        onClick={() => onSeekAudio(normalizeCitation(q).seconds)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-sm bg-blue-500/15 hover:bg-blue-500/30 text-blue-700 border border-blue-500/30 font-mono transition-all cursor-pointer active:scale-[0.96] disabled:opacity-40"
                        title={`Jump audio to ${q.timestamp}`}
                      >
                        <Play className="w-2 h-2 fill-blue-300" />
                        <span>{q.timestamp}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
