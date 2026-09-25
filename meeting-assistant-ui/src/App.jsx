import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  Download, 
  RefreshCw, 
  Cpu, 
  ListTodo, 
  FileText, 
  SplitSquareVertical, 
  ShieldCheck, 
  Check, 
  X,
  Clock,
  Layers
} from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [result, setResult] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'summary' | 'tasks' | 'transcript'
  const [completedTasks, setCompletedTasks] = useState({});
  const [healthStatus, setHealthStatus] = useState({ online: false, checking: true });

  // Check backend and Ollama health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8002/api/health");
        if (res.ok) {
          const data = await res.json();
          setHealthStatus({ online: data.ollama_online, checking: false, data });
        } else {
          setHealthStatus({ online: false, checking: false });
        }
      } catch {
        setHealthStatus({ online: false, checking: false });
      }
    };
    checkHealth();
  }, []);

  // Timer while processing
  useEffect(() => {
    let timer;
    if (isProcessing) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isProcessing]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles?.length > 0) setFile(acceptedFiles[0]);
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    maxFiles: 1
  });

  const handleProcessAudio = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);
    setCompletedTasks({});

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8002/api/process-audio", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Server connection error or unsupported file format");
      
      const data = await response.json();
      setResult(data.data);
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoSample = () => {
    const mockFile = new File(["sample meeting dummy binary content"], "q3_product_budget_review.mp3", {
      type: "audio/mp3",
    });
    setFile(mockFile);
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setIsCopied(false);
    setCompletedTasks({});
  };

  const toggleTask = (idx) => {
    setCompletedTasks(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const getFullMarkdown = () => {
    if (!result) return "";
    return `# MEETING EXECUTIVE SUMMARY\n\n${result.summary}\n\n## ACTION ITEMS\n${result.action_items.map((item, idx) => `- [${completedTasks[idx] ? 'x' : ' '}] ${item.task} (Assignee: ${item.assignee})`).join('\n')}\n\n## RAW TRANSCRIPT\n${result.transcript}`;
  };

  const handleCopyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(getFullMarkdown());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([getFullMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-summary-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const wordCount = result?.transcript ? result.transcript.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadTime = Math.ceil(wordCount / 200);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-blue-600/20 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[400px] bg-purple-700/10 blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Navbar / Top Bar */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl border border-slate-800/80 shadow-2xl shadow-indigo-950/20">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">AI Meeting Assistant</h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Orchestrator v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local meeting intelligence powered by Whisper & Llama 3 Map-Reduce
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Health Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
              <span className={`w-2 h-2 rounded-full ${healthStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300 font-medium">
                {healthStatus.checking ? 'Checking...' : healthStatus.online ? 'Llama 3 Local (Ready)' : 'Ollama Offline'}
              </span>
            </div>

            {/* Actions */}
            {result && !isProcessing && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Meeting
              </button>
            )}

            <button 
              onClick={handleProcessAudio}
              disabled={!file || isProcessing}
              className={`px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-2
                ${!file || isProcessing 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40' 
                  : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:opacity-95 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98]'}`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Start Processing
                </>
              )}
            </button>
          </div>
        </header>

        {/* Upload Hero Section (When no active result and not processing) */}
        {!isProcessing && !result && (
          <div className="space-y-6">
            <div 
              {...getRootProps()} 
              className={`relative group rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 border-2 border-dashed overflow-hidden
                ${isDragActive 
                  ? 'border-indigo-400 bg-indigo-950/30' 
                  : file 
                    ? 'border-emerald-500/50 bg-slate-900/60 hover:border-emerald-400' 
                    : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-slate-900/70'}`}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center gap-5 relative z-10">
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-inner shadow-emerald-500/10">
                      <FileAudio className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatFileSize(file.size)} • Ready to analyze</p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 transition-colors"
                    >
                      <X className="w-3 h-3" /> Change File
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-5 bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl shadow-inner shadow-indigo-500/5 group-hover:scale-105 transition-transform duration-300">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-100">
                        Drag and drop your meeting audio here
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        or click anywhere to browse from your device
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {['.MP3', '.WAV', '.M4A'].map((ext) => (
                        <span key={ext} className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Feature Highlights & Demo Option */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">100% Private & Local</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Runs on local Llama 3 via Ollama. No data leaves your machine.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Map-Reduce Chunking</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sliding-window algorithm supports 2+ hour long meetings with zero hallucination.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-200">Fast Testing</h3>
                    <button
                      type="button"
                      onClick={handleDemoSample}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                    >
                      Try Sample File
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click to auto-load a mock Q3 budget meeting audio sample.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing State (Interactive Stepper) */}
        {isProcessing && (
          <div className="py-16 flex flex-col items-center justify-center space-y-6 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full bg-indigo-500/15 blur-xl animate-pulse -z-10" />
            </div>

            <div className="text-center space-y-2 max-w-md px-4">
              <h3 className="text-lg font-bold text-white">Transcribing & Analyzing Meeting</h3>
              <p className="text-xs text-slate-400">
                Executing multi-agent pipeline: Whisper STT & Llama 3 Map-Reduce summarization...
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono mt-2">
                <Clock className="w-3 h-3" /> Elapsed: {elapsedTime}s
              </div>
            </div>

            {/* Multi-step progress pills */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pt-2">
              <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Ingested</span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1 text-indigo-300 animate-pulse"><Cpu className="w-3.5 h-3.5" /> STT & Map-Reduce</span>
              <span className="text-slate-600">→</span>
              <span className="flex items-center gap-1 text-slate-500"><ListTodo className="w-3.5 h-3.5" /> Action Items</span>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !isProcessing && (
          <div className="space-y-6">
            
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3.5 shadow-sm">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Transcript Size</p>
                  <p className="text-lg font-bold text-white mt-0.5">~{wordCount} words <span className="text-xs font-normal text-slate-400">({estimatedReadTime} min read)</span></p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3.5 shadow-sm">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <ListTodo className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Action Items</p>
                  <p className="text-lg font-bold text-white mt-0.5">{result.action_items?.length || 0} tasks identified</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3.5 shadow-sm">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">AI Engine</p>
                  <p className="text-lg font-bold text-white mt-0.5">Llama 3 <span className="text-xs font-normal text-purple-300">(Map-Reduce)</span></p>
                </div>
              </div>
            </div>

            {/* View Switcher & Export Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-2 rounded-2xl border border-slate-800/80">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('split')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'split' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" /> Split View
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Summary
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5" /> Tasks ({result.action_items?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'transcript' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Transcript
                </button>
              </div>

              {/* Export Toolbar */}
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleCopyResult}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                    isCopied 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copied Markdown!' : 'Copy All'}
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .MD
                </button>
              </div>
            </div>

            {/* Dashboard Content Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Raw Transcript (Visible in 'split' or 'transcript' mode) */}
              {(activeTab === 'split' || activeTab === 'transcript') && (
                <div className={`${activeTab === 'split' ? 'lg:col-span-5' : 'lg:col-span-12'} bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-xl space-y-4`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <h2>Raw Transcript (Agent 1)</h2>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Whisper Audio STT
                    </span>
                  </div>
                  
                  <div className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-[550px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                    {result.transcript}
                  </div>
                </div>
              )}

              {/* Right Column: AI Outputs (Visible in 'split', 'summary', or 'tasks' mode) */}
              {(activeTab === 'split' || activeTab === 'summary' || activeTab === 'tasks') && (
                <div className={`${activeTab === 'split' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6`}>
                  
                  {/* Executive Summary Card */}
                  {(activeTab === 'split' || activeTab === 'summary') && (
                    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-purple-950/20 backdrop-blur-xl p-6 rounded-3xl border border-purple-500/30 shadow-xl shadow-purple-950/10 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <h2 className="text-sm font-bold text-white">Executive Summary (Agent 2)</h2>
                        </div>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          Llama 3 Map-Reduce
                        </span>
                      </div>
                      
                      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {result.summary}
                      </div>
                    </div>
                  )}

                  {/* Action Items Interactive Checklist Card */}
                  {(activeTab === 'split' || activeTab === 'tasks') && (
                    <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                            <ListTodo className="w-4 h-4" />
                          </div>
                          <h2 className="text-sm font-bold text-white">Extracted Action Plan (Agent 3)</h2>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {Object.values(completedTasks).filter(Boolean).length}/{result.action_items?.length || 0} completed
                        </span>
                      </div>

                      <ul className="space-y-2.5">
                        {result.action_items?.map((item, idx) => {
                          const isDone = completedTasks[idx];
                          return (
                            <li 
                              key={idx}
                              onClick={() => toggleTask(idx)}
                              className={`group flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                isDone 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400' 
                                  : 'bg-slate-950/50 hover:bg-slate-800/50 border-slate-800/80 hover:border-slate-700 text-slate-200'
                              }`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                isDone 
                                  ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                                  : 'border-slate-600 group-hover:border-indigo-400'
                              }`}>
                                {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>

                              <div className="flex-1">
                                <p className={`text-xs font-medium leading-snug ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                                  {item.task}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                    Assignee: {item.assignee}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default App;