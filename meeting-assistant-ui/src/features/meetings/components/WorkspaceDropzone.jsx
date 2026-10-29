import {
  Users,
  Play,
  FileAudio,
  UploadCloud,
  X,
  Sliders,
} from 'lucide-react';
import { formatUploadLimits } from '../../recording/upload.js';

/**
 * Upload Dropzone & AI Configuration Hero component.
 */
export default function WorkspaceDropzone({
  selectedModel,
  setSelectedModel,
  spokenLanguage,
  setSpokenLanguage,
  enableMmr,
  setEnableMmr,
  showAdvancedMmr,
  setShowAdvancedMmr,
  mmrLambda,
  setMmrLambda,
  enableDiarization,
  setEnableDiarization,
  numSpeakers,
  setNumSpeakers,
  saveToLibrary,
  setSaveToLibrary,
  isContentSaving,
  uploadError,
  getRootProps,
  getInputProps,
  isDragActive,
  file,
  audioUrl,
  isVideoMedia,
  audioRef,
  uploadLimits,
  handleReset,
  handleDemoSample,
}) {
  return (
    <div className="space-y-7 max-w-[1400px] mx-auto pt-2 pb-6">
      {/* Page Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Meeting Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Upload an audio or video recording to transcribe, summarize, and extract actionable deliverables.
        </p>
      </div>

      {/* Configuration Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-4 rounded-2xl bg-white border border-slate-200/90 text-xs sm:text-sm shadow-xs">
        {/* Model Switcher */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800">
          <span className="text-[#6370ce] font-semibold text-xs tracking-tight">AI Model:</span>
          <select
            aria-label="Processing model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-transparent text-slate-800 text-xs focus:outline-hidden cursor-pointer font-medium"
          >
            <option value="auto" className="bg-white text-slate-800">Auto (Adaptive)</option>
            <option value="llama3" className="bg-white text-slate-800">Llama 3 (8B · GPU)</option>
            <option value="llama3.2:3b" className="bg-white text-slate-800">Llama 3.2 (3B · Fast CPU)</option>
            <option value="llama3.2:1b" className="bg-white text-slate-800">Llama 3.2 (1B · Light)</option>
            <option value="instant_demo" className="bg-white text-slate-800">Instant Demo (Zero Compute)</option>
          </select>
        </div>

        {/* Spoken Language */}
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-700">
          Language:
          <select 
            value={spokenLanguage} 
            onChange={(e) => setSpokenLanguage(e.target.value)}
            className="bg-white text-slate-800 rounded-md border border-slate-200 px-2 py-0.5 focus:outline-hidden cursor-pointer"
          >
            <option value="">Auto-detect</option>
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>

        {/* MMR Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setEnableMmr(!enableMmr)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl border text-xs font-medium transition-all cursor-pointer ${
              enableMmr 
                ? 'bg-[#eef1fc] border-[#d9dff8] text-[#4854b8]'
                : 'bg-slate-100/70 border-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
            title="Maximal Marginal Relevance (Redundancy Filter)"
          >
            <span>MMR Filter</span>
            <span className={`text-xs px-1 rounded-sm font-mono font-bold ${enableMmr ? 'text-[#4854b8]' : 'text-slate-500'}`}>
              {enableMmr ? 'ON' : 'OFF'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedMmr(!showAdvancedMmr)}
            aria-label="MMR lambda settings"
            className={`px-2 py-1.5 rounded-r-xl border border-l-0 text-xs transition-all cursor-pointer ${
              showAdvancedMmr ? 'bg-[#5867ce] text-white border-[#5867ce]' : 'bg-slate-100/70 border-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
            title="Configure λ hyperparameter"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Diarization Toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setEnableDiarization(!enableDiarization)}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${enableDiarization ? 'rounded-l-xl' : 'rounded-xl'} border text-xs font-medium transition-all cursor-pointer ${
              enableDiarization 
                ? 'bg-[#eef1fc] border-[#d9dff8] text-[#4854b8]'
                : 'bg-slate-100/70 border-slate-200/80 text-slate-600 hover:text-slate-900'
            }`}
            title="Speaker Diarization (Identify speakers)"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Diarize</span>
          </button>
          {enableDiarization && (
            <select
              value={numSpeakers}
              onChange={(e) => setNumSpeakers(e.target.value)}
              className="bg-[#f5f7fe] text-[#4854b8] border border-l-0 border-[#d9dff8] rounded-r-xl px-2 py-1.5 text-xs focus:outline-hidden font-medium cursor-pointer"
              title="Expected speaker count"
            >
              <option value="">Auto Spk</option>
              <option value="2">2 Spk</option>
              <option value="3">3 Spk</option>
              <option value="4">4 Spk</option>
            </select>
          )}
        </div>
      </div>

      {/* Advanced MMR Slider */}
      <div className="rounded-2xl border border-slate-200 bg-white/50 p-4 space-y-2">
        <label className="flex items-center gap-3 text-sm text-slate-800 cursor-pointer">
          <input type="checkbox" checked={saveToLibrary ?? true}
            disabled={selectedModel === 'instant_demo' || isContentSaving}
            onChange={event => setSaveToLibrary(event.target.checked)} className="accent-indigo-500" />
          Save results to library
        </label>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {selectedModel === 'instant_demo' ? 'Demo results are not added to the meeting library.'
            : saveToLibrary ? 'Keep the transcript, notes and action items for later. The original recording is not stored.'
              : 'Session only. Save or export the results before reloading or starting another meeting.'}
        </p>
      </div>
      {uploadError && <p role="alert" className="text-sm text-rose-700">{uploadError}</p>}

      {showAdvancedMmr && (
        <div className="bg-white/90 border border-indigo-500/40 rounded-2xl p-4 shadow-panel backdrop-blur-md space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">MMR Hyperparameter Tuning: Relevance vs Diversity</span>
            <span className="font-mono text-indigo-700 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-sm border border-indigo-500/20">
              λ = {mmrLambda.toFixed(2)}
            </span>
          </div>
          <input 
            type="range"
            aria-label="MMR relevance and diversity balance"
            min="0.10"
            max="0.90"
            step="0.05"
            value={mmrLambda}
            onChange={(e) => setMmrLambda(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Higher λ preserves sentences closest to the central theme; lower λ penalizes repetition and extracts broader conversational variety.
          </p>
        </div>
      )}

      {/* Drag and Drop Zone */}
      <div 
        {...getRootProps({ role: 'button', 'aria-label': 'Choose meeting audio or video file' })}
        className={`relative group rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden ${
          isDragActive 
            ? 'border-[#6370ce] bg-[#eef1fc]/40'
            : file 
              ? 'border-[#dce2f4] bg-white/80 shadow-xs'
              : 'border-slate-200/90 hover:border-[#3c4999]/50 bg-white shadow-xs hover:bg-slate-50/50'
        }`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4 relative z-10">
          {file ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <div className="p-4 bg-[#eef1fc] border border-[#d9dff8] text-[#5867ce] rounded-2xl shadow-xs">
                <FileAudio className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2b3559] truncate max-w-sm">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">Ready for analysis • {formatUploadLimits(uploadLimits)}</p>
              </div>

              {audioUrl && (
                <div className="w-full pt-2" onClick={(e) => e.stopPropagation()}>
                  {isVideoMedia ? (
                    <video controls src={audioUrl} className="w-full max-h-48 rounded-lg bg-black object-contain" />
                  ) : (
                    <audio ref={audioRef} controls src={audioUrl} className="w-full h-8 rounded-lg accent-[#6370ce]" />
                  )}
                </div>
              )}

              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 px-3 py-1 rounded-full bg-slate-100 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" /> Change File
              </button>
            </div>
          ) : (
            <>
              <div className="p-5 bg-[#eef1fc] border border-[#d9dff8] text-[#5867ce] rounded-3xl shadow-xs group-hover:scale-105 transition-transform duration-300">
                <UploadCloud className="w-10 h-10" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-semibold text-slate-900">
                  Drag and drop your meeting audio or video here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  or click anywhere to browse from your computer ({formatUploadLimits(uploadLimits)})
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                {['.MP3', '.WAV', '.M4A', '.OGG', '.FLAC', '.MP4', '.WEBM'].map((ext) => (
                  <span key={ext} className="text-xs font-mono px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 border border-slate-300/60">
                    {ext}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sample Meeting Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#eef1fc] border border-[#d9dff8] text-[#5867ce]">
            <Play className="w-4 h-4 fill-current" />
          </div>
          <div>
            <p className="font-semibold text-[#2b3559]">Want to test right away without an audio file?</p>
            <p className="text-xs text-slate-500">Load a pre-packaged Q3 product and budget review audio sample.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDemoSample}
          className="px-3.5 py-2 rounded-xl bg-[#eef1fc] hover:bg-[#e2e7fb] text-[#3c4999] border border-[#d5dcf8] text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer shadow-xs shrink-0"
        >
          Load Sample Audio
        </button>
      </div>
    </div>
  );
}
