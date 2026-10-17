import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Video, 
  Radio, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Sliders, 
  X 
} from 'lucide-react';
import { 
  detectMeetingPlatform, 
  getPlatformDetails, 
  validateMeetingUrl, 
  formatBotJoinConfirmation 
} from './notta-bot-utils.js';

/**
 * NottaBotCard: Enterprise-grade Meeting Bot Joiner widget inspired by Notta.ai
 * Supports Google Meet, Zoom, Microsoft Teams, Cisco Webex, and YouTube streams.
 */
export default function NottaBotCard({ disabled }) {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [botName, setBotName] = useState('AI Meeting Bot');
  const [language, setLanguage] = useState('auto');
  const [showConfig, setShowConfig] = useState(false);
  const [scheduledBot, setScheduledBot] = useState(null);

  const detectedPlatform = useMemo(() => {
    return detectMeetingPlatform(meetingUrl);
  }, [meetingUrl]);

  const platformInfo = useMemo(() => {
    return detectedPlatform ? getPlatformDetails(detectedPlatform) : null;
  }, [detectedPlatform]);

  const isValid = useMemo(() => {
    return validateMeetingUrl(meetingUrl);
  }, [meetingUrl]);

  const handleSummonBot = (e) => {
    e.preventDefault();
    if (!isValid) return;

    const confirmation = formatBotJoinConfirmation({
      url: meetingUrl,
      botName,
      language
    });

    setScheduledBot(confirmation);
  };

  const handleDismissModal = () => {
    setScheduledBot(null);
  };

  return (
    <>
      <div className="relative overflow-hidden p-6 rounded-3xl bg-white/60 backdrop-blur-xl border border-slate-200/80 hover:border-indigo-500/40 shadow-panel transition-all duration-300">
        {/* Subtle accent corner mesh */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-linear-to-bl from-blue-500/10 via-indigo-500/10 to-transparent pointer-events-none rounded-tr-3xl" />

        <div className="space-y-4">
          {/* Card Header: Notta Bot Status & Supported Platform Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">AI Meeting Bot</h3>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 font-mono text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Standby Ready
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-normal">
                  Auto-join online meetings to record, diarize, and transcribe live.
                </p>
              </div>
            </div>

            {/* Platform Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-mono text-xs">Google Meet</span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 font-mono text-xs">Zoom</span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-700 font-mono text-xs">Teams</span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 font-mono text-xs">YouTube</span>
            </div>
          </div>

          {/* Form: URL Input with Live Detection */}
          <form onSubmit={handleSummonBot} className="space-y-3">
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-slate-600 pointer-events-none">
                <Video className="w-4 h-4" />
              </div>
              
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="Paste meeting link (meet.google.com/xyz, zoom.us/j/..., teams.live.com/...)"
                disabled={disabled}
                className="w-full pl-10 pr-36 py-3 rounded-2xl bg-slate-50/70 border border-slate-300/80 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 text-xs text-slate-900 placeholder-slate-500 outline-hidden transition-all shadow-inner font-mono"
              />

              {/* Right inside badge: Detected platform pill */}
              <div className="absolute right-2 flex items-center gap-1.5">
                {platformInfo && (
                  <span className={`px-2 py-1 rounded-xl font-mono text-xs font-semibold border ${platformInfo.badgeClass}`}>
                    {platformInfo.label}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Configure Bot settings"
                  aria-label="Configure Bot settings"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expandable Configuration: Bot Name & Language */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3.5 rounded-2xl bg-slate-50/40 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Bot Display Name
                      </label>
                      <input
                        type="text"
                        value={botName}
                        onChange={(e) => setBotName(e.target.value)}
                        placeholder="AI Meeting Bot"
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs outline-hidden focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Spoken Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs outline-hidden focus:border-indigo-500"
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="vi">Vietnamese (vi)</option>
                        <option value="en">English (en)</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-normal">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                <span>Zero audio data leaked to third-party providers. Grounded locally.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!isValid || disabled}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 active:scale-95 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Send Bot to Meeting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Frosted Glass Modal when Bot is dispatched */}
      <AnimatePresence>
        {scheduledBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="relative w-full max-w-md p-6 rounded-3xl bg-white/90 border border-indigo-500/30 shadow-glass space-y-4 text-left"
            >
              <button
                type="button"
                onClick={handleDismissModal}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-700">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 tracking-tight">AI Bot Ready to Join</h4>
                  <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Configured for {scheduledBot.platformLabel}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Target Meeting:</span>
                  <span className="font-mono text-slate-800 truncate max-w-[200px]">{scheduledBot.url}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Bot Display Name:</span>
                  <span className="font-semibold text-slate-900">{scheduledBot.botName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Transcription Engine:</span>
                  <span className="text-indigo-700 font-mono">Whisper Large-v3</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {scheduledBot.readyMessage}
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDismissModal}
                  className="px-4 py-2 rounded-xl text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Dismiss
                </button>
                <a
                  href={scheduledBot.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleDismissModal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <span>Open Meeting Call</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
