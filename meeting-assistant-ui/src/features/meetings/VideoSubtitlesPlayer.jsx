import { useState, useEffect, useRef, forwardRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  FileText,
  Download,
  Settings,
} from 'lucide-react';
import { downloadSrt, downloadVtt } from './subtitles.js';

const SPEEDS = [1.0, 1.25, 1.5, 2.0];

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * YouTube-style clean subtitle overlay.
 * Restrained typography with no decorative emoji clutter.
 */
function SubtitleOverlay({ segment, size = 'normal', isControlsVisible }) {
  if (!segment?.text) return null;

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 max-w-[90%] sm:max-w-[80%] text-center pointer-events-none transition-all duration-200 z-20 ${
        isControlsVisible ? 'bottom-16 sm:bottom-20' : 'bottom-6 sm:bottom-8'
      }`}
      aria-live="polite"
    >
      <div className="inline-block bg-black/85 backdrop-blur-xs px-3.5 py-1.5 rounded-lg border border-white/10 shadow-lg text-white">
        {segment.speaker && (
          <span className="font-semibold font-mono text-[11px] sm:text-xs text-indigo-300 mr-2 uppercase tracking-wide">
            {segment.speaker}:
          </span>
        )}
        <span
          className={`leading-relaxed font-normal text-white ${
            size === 'large' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
          }`}
        >
          {segment.text.trim()}
        </span>
      </div>
    </div>
  );
}

/**
 * YouTube-style scrub timeline bar.
 */
function VideoTimeline({ currentTime, duration, onScrub }) {
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onClick={onScrub}
      className="relative w-full h-2.5 sm:h-3 group/timeline cursor-pointer flex items-center"
      role="slider"
      aria-label="Video timeline scrubber"
      aria-valuenow={currentTime}
      aria-valuemin={0}
      aria-valuemax={duration}
      tabIndex={0}
    >
      <div className="w-full h-1 group-hover/timeline:h-1.5 bg-white/25 rounded-full transition-all relative overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progressPercent}%` }} />
      </div>
      <div
        className="absolute w-3 h-3 bg-white rounded-full shadow-md -translate-x-1/2 scale-0 group-hover/timeline:scale-100 transition-transform border-2 border-indigo-600"
        style={{ left: `${progressPercent}%` }}
      />
    </div>
  );
}

/**
 * Interactive Video Subtitles Player.
 * Replaces complex multi-state clutter with clean, declarative subcomponents.
 */
const VideoSubtitlesPlayer = forwardRef(function VideoSubtitlesPlayer(
  {
    src,
    segments = [],
    title = 'Meeting Video',
    onSeek,
  },
  forwardedRef
) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [captionSize, setCaptionSize] = useState('normal');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const hideTimeoutRef = useRef(null);

  // Playback handlers
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleSkip = (seconds) => {
    const el = videoRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds));
    el.currentTime = target;
    setCurrentTime(target);
    if (onSeek) onSeek(target);
  };

  const handleScrub = (e) => {
    const el = videoRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pos * (el.duration || duration || 0);
    el.currentTime = target;
    setCurrentTime(target);
    if (onSeek) onSeek(target);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !isMuted;
    el.muted = next;
    setIsMuted(next);
  };

  const handleVolumeChange = (e) => {
    const el = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (el) {
      el.volume = val;
      el.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const cycleSpeed = () => {
    const el = videoRef.current;
    const nextIdx = (SPEEDS.indexOf(playbackSpeed) + 1) % SPEEDS.length;
    const nextSpeed = SPEEDS[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (el) el.playbackRate = nextSpeed;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard shortcuts (YouTube standard)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); handleSkip(-5); }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); handleSkip(5); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setShowCaptions(prev => !prev); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
        setShowMenu(false);
      }, 3000);
    }
  };

  const activeSegment = segments.find(
    (seg) => seg && currentTime >= Number(seg.start) && currentTime <= (Number(seg.end) || (Number(seg.start) + 3.0))
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (isPlaying) setIsControlsVisible(false); }}
      className="relative aspect-video w-full max-w-4xl mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl group select-none flex items-center justify-center"
      data-video-player
    >
      <video
        ref={(el) => {
          videoRef.current = el;
          if (typeof forwardedRef === 'function') {
            forwardedRef(el);
          } else if (forwardedRef) {
            forwardedRef.current = el;
          }
        }}
        src={src}
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Center Big Play Button */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center backdrop-blur-xs border border-white/20 shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-pointer z-10"
        >
          <Play className="w-6 h-6 fill-white ml-0.5" />
        </button>
      )}

      {/* Live CC Subtitles */}
      {showCaptions && (
        <SubtitleOverlay
          segment={activeSegment}
          size={captionSize}
          isControlsVisible={isControlsVisible}
        />
      )}

      {/* YouTube Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 transition-opacity duration-200 z-30 ${
          isControlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <VideoTimeline currentTime={currentTime} duration={duration} onScrub={handleScrub} />

        <div className="flex items-center justify-between gap-2 text-white text-xs">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(-5)}
              className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 font-mono text-[11px]"
              title="Rewind 5s"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>5s</span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(5)}
              className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 font-mono text-[11px]"
              title="Forward 5s"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>5s</span>
            </button>

            <div className="flex items-center gap-1 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume slider"
                className="w-14 h-1 bg-white/30 rounded-lg accent-indigo-500 cursor-pointer hidden group-hover/volume:block transition-all"
              />
            </div>

            <div className="font-mono text-[11px] text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] transition-colors cursor-pointer"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>

            <button
              type="button"
              onClick={() => setShowCaptions((prev) => !prev)}
              className={`px-1.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold ${
                showCaptions ? 'bg-indigo-600 text-white' : 'hover:bg-white/10 text-slate-400'
              }`}
              title="Subtitles (c)"
              aria-label="Toggle subtitles"
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>CC</span>
            </button>

            {/* Subtitle menu dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="p-1 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
                title="Subtitle Settings"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 bottom-full mb-2 w-52 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl p-1.5 text-xs text-white z-40 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionSize((prev) => (prev === 'normal' ? 'large' : 'normal'));
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                  >
                    <span>Caption Size</span>
                    <span className="font-mono text-indigo-400 uppercase text-[10px]">{captionSize}</span>
                  </button>
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    type="button"
                    onClick={() => { downloadSrt(segments, title); setShowMenu(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .SRT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { downloadVtt(segments, title); setShowMenu(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2 cursor-pointer text-slate-200"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download .VTT</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
              title="Fullscreen (f)"
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoSubtitlesPlayer;
