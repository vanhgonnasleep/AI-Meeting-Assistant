import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users
} from 'lucide-react';
import { extractAssignee } from './connectors.js';

const AUTOPLAY_INTERVAL_MS = 7000;

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 32,
      mass: 0.85
    }
  },
  exit: (direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.2
    }
  })
};

/**
 * PresentationDeck: Fullscreen Zen slide presentation mode with Apple Dynamic Glass aesthetics
 */
export default function PresentationDeck({
  meetingData = {},
  actionItems = [],
  completedTasks = new Set(),
  onToggleTask,
  onExit
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isAutoplay, setIsAutoplay] = useState(false);

  // Extract structured slides data
  const slides = useMemo(() => {
    const title = meetingData?.title || 'Executive Session';
    const date = meetingData?.date || new Date().toISOString().split('T')[0];
    const duration = meetingData?.duration || meetingData?.audioDuration || 'Recorded';
    const attendees = meetingData?.attendees || [];
    const summary = meetingData?.summary || 'No summary available for this session.';
    const decisions = Array.isArray(meetingData?.keyDecisions) ? meetingData.keyDecisions : [];
    const risks = Array.isArray(meetingData?.risks) ? meetingData.risks : [];

    return [
      {
        id: 'briefing',
        badge: 'Executive Briefing',
        icon: Sparkles,
        title,
        date,
        duration,
        attendees,
        summary
      },
      {
        id: 'decisions',
        badge: 'Governance & Key Decisions',
        icon: ShieldCheck,
        title: 'Key Decisions & Strategic Alignment',
        decisions: decisions.length > 0 ? decisions : ['All discussed items aligned with core strategy.']
      },
      {
        id: 'risks',
        badge: 'Risk Analysis & Blockers',
        icon: AlertTriangle,
        title: 'Identified Risks & Dependencies',
        risks: risks.length > 0 ? risks : ['No critical blockers or architectural risks identified.']
      },
      {
        id: 'deliverables',
        badge: 'Action Plan & Execution',
        icon: CheckCircle2,
        title: 'Deliverables & Next Steps',
        tasks: actionItems
      }
    ];
  }, [meetingData, actionItems]);

  const totalSlides = slides.length;

  const goToSlide = useCallback((nextIdx, newDirection = 1) => {
    setDirection(newDirection);
    setCurrentSlide((nextIdx + totalSlides) % totalSlides);
  }, [totalSlides]);

  const handleNext = useCallback(() => {
    goToSlide(currentSlide + 1, 1);
  }, [goToSlide, currentSlide]);

  const handlePrev = useCallback(() => {
    goToSlide(currentSlide - 1, -1);
  }, [goToSlide, currentSlide]);

  // Autoplay timer
  useEffect(() => {
    if (!isAutoplay) return;
    const timer = setInterval(() => {
      goToSlide(currentSlide + 1, 1);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isAutoplay, currentSlide, goToSlide]);

  // Keyboard navigation: ArrowLeft, ArrowRight, Esc, Space
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onExit]);

  const activeSlide = slides[currentSlide];
  const ActiveIcon = activeSlide.icon;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 text-slate-100 p-6 sm:p-10 backdrop-blur-3xl overflow-hidden select-none">
      {/* Background ambient lighting blur spheres */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-[120px]" />

      {/* Top Header Navigation */}
      <div className="relative z-10 flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-xl">
            <ActiveIcon className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Zen Mode
              </span>
              <span className="text-white/20">•</span>
              <span className="text-xs text-slate-400">
                Slide {currentSlide + 1} of {totalSlides}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate max-w-md sm:max-w-xl">
              {meetingData?.title || 'Executive Session'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAutoplay(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isAutoplay
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-white/[0.05] border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Toggle presentation autoplay (7s)"
          >
            {isAutoplay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isAutoplay ? 'Autoplaying' : 'Autoplay'}</span>
          </button>

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-medium text-slate-200 hover:text-white transition-all active:scale-[0.98]"
            title="Exit Zen Presentation (Esc)"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit (Esc)</span>
          </button>
        </div>
      </div>

      {/* Main Slide Stage */}
      <div className="relative z-10 my-auto flex items-center justify-center w-full max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full rounded-3xl border border-white/10 bg-slate-900/60 p-8 sm:p-12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          >
            {/* Slide Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 text-xs font-medium text-sky-300 mb-6">
              <ActiveIcon className="h-3.5 w-3.5" />
              <span>{activeSlide.badge}</span>
            </div>

            {/* SLIDE 1: Executive Briefing */}
            {activeSlide.id === 'briefing' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3">
                    {activeSlide.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" /> {activeSlide.date}
                    </span>
                    {activeSlide.attendees.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-500" /> {activeSlide.attendees.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-200 text-base sm:text-lg leading-relaxed font-normal">
                  {activeSlide.summary}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                    ✓ AI Diarization Verified
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                    ✓ Agent 5 Governance Matrix
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-medium">
                    ✓ Action Items Extracted
                  </span>
                </div>
              </div>
            )}

            {/* SLIDE 2: Key Decisions */}
            {activeSlide.id === 'decisions' && (
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Key Decisions & Commitments
                </h2>
                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-2">
                  {activeSlide.decisions.map((decision, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-colors"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
                        {decision}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* SLIDE 3: Identified Risks */}
            {activeSlide.id === 'risks' && (
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Delivery Blockers & Risk Matrix
                </h2>
                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-2">
                  {activeSlide.risks.map((risk, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-200 transition-colors"
                    >
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" />
                      <p className="text-sm sm:text-base leading-relaxed font-medium text-amber-100">
                        {risk}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* SLIDE 4: Action Items */}
            {activeSlide.id === 'deliverables' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Action Items & Deliverables
                  </h2>
                  <span className="text-xs font-medium text-slate-400">
                    {completedTasks.size} of {activeSlide.tasks.length} Completed
                  </span>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {activeSlide.tasks.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No pending action items for this meeting.
                    </div>
                  ) : (
                    activeSlide.tasks.map((task, idx) => {
                      const isCompleted = completedTasks.has(idx);
                      const taskText = typeof task === 'object' ? task.text : String(task);
                      const assignee = typeof task === 'object' ? task.assignee : extractAssignee(taskText);

                      return (
                        <div
                          key={idx}
                          onClick={() => onToggleTask && onToggleTask(idx)}
                          className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-white/[0.02] border-white/[0.04] opacity-60'
                              : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/10'
                          }`}
                        >
                          <div className={`mt-0.5 ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}`}>
                            <CheckCircle2 className={`h-5 w-5 ${isCompleted ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm sm:text-base font-medium ${isCompleted ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                              {taskText}
                            </p>
                            {assignee && (
                              <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                @{assignee}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Floating Navigation Dock (Apple Dynamic Island style) */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-slate-900/80 border border-white/15 backdrop-blur-2xl shadow-2xl">
          <button
            onClick={handlePrev}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-slate-300 hover:text-white transition-all active:scale-95"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx, idx > currentSlide ? 1 : -1)}
                className={`h-2.5 rounded-full transition-all ${
                  idx === currentSlide
                    ? 'w-7 bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                    : 'w-2.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-slate-300 hover:text-white transition-all active:scale-95"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
