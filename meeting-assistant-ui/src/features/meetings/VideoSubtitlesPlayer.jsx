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
  Sparkles,
} from 'lucide-react';
import { downloadSrt, downloadVtt } from './subtitles.js';

const SPEEDS = [1.0, 1.25, 1.5, 2.0];

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const VideoSubtitlesPlayer = forwardRef(function VideoSubtitlesPlayer(
  {
    src,
    segments = [],
    title = 'Meeting Video',
    mediaRef,
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
  const [captionSize, setCaptionSize] = useState('normal'); // 'normal' | 'large'
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const hideTimeoutRef = useRef(null);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

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
    const targetTime = pos * (el.duration || duration || 0);
    el.currentTime = targetTime;
    setCurrentTime(targetTime);
    if (onSeek) onSeek(targetTime);
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const nextMute = !isMuted;
    el.muted = nextMute;
    setIsMuted(nextMute);
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
    if (el) {
      el.playbackRate = nextSpeed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }
      const el = videoRef.current;
      if (!el) return;

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        handleSkip(-5);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        handleSkip(5);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowCaptions((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Controls autohide on mouse idle
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

  // Find currently active transcript segment based on currentTime
  const activeSegment = segments.find(
    (seg) => seg && currentTime >= Number(seg.start) && currentTime <= (Number(seg.end) || (Number(seg.start) + 3.0))
  );

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) setIsControlsVisible(false);
      }}
      className="relative aspect-video w-full max-w-4xl mx-auto rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl group select-none flex items-center justify-center"
      data-video-player
    >
      {/* HTML5 Native Video */}
      <video
        ref={(el) => {
          videoRef.current = el;
          const targetRef = forwardedRef || mediaRef;
          if (typeof targetRef === 'function') {
            targetRef(el);
          } else if (targetRef) {
            targetRef.current = el;
          }
        }}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Center Big Play Button (when paused) */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer z-10"
        >
          <Play className="w-7 h-7 fill-white ml-1" />
        </button>
      )}

      {/* ─── YouTube AI Closed Captions Live Overlay ─── */}
      {showCaptions && activeSegment && activeSegment.text && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 max-w-[90%] sm:max-w-[82%] text-center pointer-events-none transition-all duration-150 z-20 ${
            isControlsVisible ? 'bottom-16 sm:bottom-20' : 'bottom-6 sm:bottom-8'
          }`}
          aria-live="polite"
        >
          <div className="inline-block bg-black/85 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl border border-white/10 shadow-2xl text-white">
            {activeSegment.speaker && (
              <span className="inline-flex items-center gap-1.5 font-bold font-mono text-[11px] sm:text-xs uppercase px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 mr-2 tracking-wide">
                <Sparkles className="w-3 h-3 text-indigo-300" />
                {activeSegment.speaker}
              </span>
            )}
            <span
              className={`leading-relaxed font-medium tracking-wide drop-shadow-md text-white ${
                captionSize === 'large' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm md:text-base'
              }`}
            >
              {activeSegment.text.trim()}
            </span>
          </div>
        </div>
      )}

      {/* ─── Custom YouTube-Style Controls Overlay ─── */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2 transition-opacity duration-200 z-30 ${
          isControlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Scrubber Timeline */}
        <div
          onClick={handleScrub}
          className="relative w-full h-2.5 sm:h-3 group/timeline cursor-pointer flex items-center"
          role="slider"
          aria-label="Video timeline scrubber"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          tabIndex={0}
        >
          {/* Track background */}
          <div className="w-full h-1 group-hover/timeline:h-1.5 bg-white/20 rounded-full transition-all duration-150 relative overflow-hidden">
            {/* Played progress */}
            <div
              className="h-full bg-indigo-500 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Scrubber thumb handle */}
          <div
            className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md -translate-x-1/2 scale-0 group-hover/timeline:scale-100 transition-transform duration-150 border-2 border-indigo-600"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Buttons and Time Row */}
        <div className="flex items-center justify-between gap-2 text-white text-xs">
          {/* Left Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (k / space)' : 'Play (k / space)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(-5)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px]"
              title="Rewind 5s (j / left arrow)"
              aria-label="Rewind 5 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">5s</span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(5)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px]"
              title="Forward 5s (l / right arrow)"
              aria-label="Forward 5 seconds"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">5s</span>
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-1 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
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
                className="w-14 sm:w-20 h-1 bg-white/30 rounded-lg accent-indigo-500 cursor-pointer hidden group-hover/volume:block transition-all"
              />
            </div>

            {/* Time display */}
            <div className="font-mono text-[11px] sm:text-xs text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Speed toggle */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono font-medium text-[11px] transition-colors cursor-pointer"
              title="Playback speed"
              aria-label="Playback speed"
            >
              {playbackSpeed}x
            </button>

            {/* Closed Captions toggle (YouTube style) */}
            <button
              type="button"
              onClick={() => setShowCaptions((prev) => !prev)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                showCaptions
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title={showCaptions ? 'Subtitles On (c)' : 'Subtitles Off (c)'}
              aria-label="Toggle subtitles"
            >
              <Subtitles className="w-4 h-4" />
              <span className="text-[10px] font-bold tracking-wider hidden sm:inline">CC</span>
            </button>

            {/* Settings & Subtitle Export dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
                title="Settings & Subtitles"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2 text-xs text-white z-40 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="px-2 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
                    Subtitle Options
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptionSize((prev) => (prev === 'normal' ? 'large' : 'normal'));
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between cursor-pointer"
                  >
                    <span>Caption Size</span>
                    <span className="font-mono text-indigo-400 font-semibold uppercase text-[10px]">
                      {captionSize}
                    </span>
                  </button>

                  <div className="border-t border-slate-800 my-1" />

                  <p className="px-2 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
                    Export Subtitles
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      downloadSrt(segments, title);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 cursor-pointer text-purple-300"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download SubRip (.SRT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadVtt(segments, title);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 cursor-pointer text-teal-300"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download WebVTT (.VTT)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}
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
