import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Mail,
  Check,
  CheckSquare,
  Square,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Send,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import {
  buildGitHubIssuePayload,
  buildGitHubIssueUrl,
  buildGmailDispatchUrl,
  formatEmailMinutes,
  postGitHubIssue,
  extractAssignee
} from './connectors.js';

const STORAGE_KEY_REPO = 'ma_github_repo';
const STORAGE_KEY_TOKEN = 'ma_github_token';

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

/**
 * ConnectorsModal: Apple Dynamic Glass sheet for GitHub Issues sync & Gmail minutes dispatch
 */
export default function ConnectorsModal({
  isOpen,
  onClose,
  meetingData = {},
  actionItems = [],
  completedTasks = new Set()
}) {
  const [activeTab, setActiveTab] = useState('github'); // 'github' | 'gmail'

  // GitHub State
  const [repo, setRepo] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_REPO) || 'my-org/my-project';
    } catch {
      return 'my-org/my-project';
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    } catch {
      return '';
    }
  });
  const [showToken, setShowToken] = useState(false);
  const [deselectedTaskIndices, setDeselectedTaskIndices] = useState(() => new Set());
  const [githubStatus, setGithubStatus] = useState(null); // { type: 'loading'|'success'|'error', message: string }

  // Gmail State
  const [emailTemplate, setEmailTemplate] = useState('brief'); // 'brief' | 'comprehensive'
  const [recipients, setRecipients] = useState(() => {
    const attendees = meetingData?.attendees || [];
    return attendees.map(a => `${a.toLowerCase()}@example.com`).join(', ');
  });
  const [copiedType, setCopiedType] = useState(null); // 'markdown' | 'email' | null

  // Save repo and token to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REPO, repo);
    } catch {
      // ignore
    }
  }, [repo]);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEY_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    } catch {
      // ignore
    }
  }, [token]);

  // Derived selected task indices
  const selectedTaskIndices = useMemo(() => {
    return new Set(
      actionItems
        .map((_, i) => i)
        .filter(i => !deselectedTaskIndices.has(i))
    );
  }, [actionItems, deselectedTaskIndices]);

  // Dismiss on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Task selection helpers
  const toggleTask = (index) => {
    setDeselectedTaskIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIndices.size === actionItems.length) {
      setDeselectedTaskIndices(new Set(actionItems.map((_, i) => i)));
    } else {
      setDeselectedTaskIndices(new Set());
    }
  };

  // Pre-formatted email content
  const emailBody = useMemo(() => {
    return formatEmailMinutes(
      {
        title: meetingData?.title || 'Meeting Summary',
        date: meetingData?.date,
        summary: meetingData?.summary || '',
        keyDecisions: meetingData?.keyDecisions || [],
        risks: meetingData?.risks || [],
        actionItems,
        attendees: meetingData?.attendees || []
      },
      { template: emailTemplate }
    );
  }, [meetingData, actionItems, emailTemplate]);

  const emailSubject = useMemo(() => {
    const title = meetingData?.title || 'Executive Session';
    return emailTemplate === 'brief'
      ? `Executive Briefing: ${title}`
      : `Meeting Minutes & Action Items: ${title}`;
  }, [meetingData, emailTemplate]);

  // Handle direct GitHub API sync
  const handleBatchCreateGitHubIssues = async () => {
    if (!token.trim()) {
      setGithubStatus({
        type: 'error',
        message: 'Personal Access Token required for direct batch creation. Or use the "Open in GitHub" fallback button.'
      });
      return;
    }

    const selectedTasks = actionItems.filter((_, i) => selectedTaskIndices.has(i));
    if (selectedTasks.length === 0) {
      setGithubStatus({ type: 'error', message: 'Please select at least one action item.' });
      return;
    }

    setGithubStatus({
      type: 'loading',
      message: `Creating 0 of ${selectedTasks.length} issues in GitHub...`
    });

    let successCount = 0;
    try {
      for (let i = 0; i < selectedTasks.length; i++) {
        const task = selectedTasks[i];
        setGithubStatus({
          type: 'loading',
          message: `Creating ${i + 1} of ${selectedTasks.length}: "${typeof task === 'object' ? task.text : task}"...`
        });

        const payload = buildGitHubIssuePayload(task, {
          title: meetingData?.title,
          meetingId: meetingData?.id || meetingData?.meetingId
        });

        await postGitHubIssue({
          repo: repo.trim(),
          token: token.trim(),
          payload
        });
        successCount++;
      }

      setGithubStatus({
        type: 'success',
        message: `Successfully created ${successCount} GitHub issue${successCount > 1 ? 's' : ''} in ${repo}!`
      });
    } catch (err) {
      setGithubStatus({
        type: 'error',
        message: `Failed after ${successCount} issue${successCount !== 1 ? 's' : ''}: ${err.message}`
      });
    }
  };

  // Open fallback GitHub issue URL for first selected task
  const handleOpenFallbackGitHub = () => {
    const selectedTasks = actionItems.filter((_, i) => selectedTaskIndices.has(i));
    const targetTask = selectedTasks[0] || actionItems[0] || 'Implement meeting action items';
    const payload = buildGitHubIssuePayload(targetTask, {
      title: meetingData?.title,
      meetingId: meetingData?.id || meetingData?.meetingId
    });
    const url = buildGitHubIssueUrl(repo, payload);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Copy Markdown
  const handleCopyMarkdown = useCallback(async () => {
    const selectedTasks = actionItems.filter((_, i) => selectedTaskIndices.has(i));
    const lines = [
      `## 🎯 Action Items from: ${meetingData?.title || 'Meeting'}`,
      ``,
      ...selectedTasks.map(t => {
        const text = typeof t === 'object' ? t.text : String(t);
        const assignee = typeof t === 'object' ? t.assignee : extractAssignee(text);
        const assigneeBadge = assignee ? ` **@${assignee}**` : '';
        return `- [ ] ${text}${assigneeBadge}`;
      }),
      ``,
      `*Generated via AI Meeting Assistant Connectors Hub*`
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedType('markdown');
    setTimeout(() => setCopiedType(null), 2500);
  }, [actionItems, selectedTaskIndices, meetingData]);

  // Copy Email Text
  const handleCopyEmail = useCallback(async () => {
    await navigator.clipboard.writeText(emailBody);
    setCopiedType('email');
    setTimeout(() => setCopiedType(null), 2500);
  }, [emailBody]);

  // Dispatch Gmail Web
  const handleOpenGmailWeb = () => {
    const url = buildGmailDispatchUrl({
      to: recipients,
      subject: emailSubject,
      body: emailBody,
      format: 'web'
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Dispatch Native Mailto
  const handleOpenMailto = () => {
    const url = buildGmailDispatchUrl({
      to: recipients,
      subject: emailSubject,
      body: emailBody,
      format: 'mailto'
    });
    window.location.href = url;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Apple Dynamic Glass Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          aria-hidden="true"
        />

        {/* Modal Window Sheet */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 p-6 sm:p-8 text-slate-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connectors-modal-title"
        >
          {/* Header & Tabs */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 border border-white/15 shadow-inner">
                <Sparkles className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h2 id="connectors-modal-title" className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                  Executive Connectors Hub
                </h2>
                <p className="text-xs text-slate-400">
                  Export tasks and dispatch executive summaries without context switching.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Dynamic Switcher Pill */}
          <div className="mt-6 flex rounded-2xl bg-black/40 p-1 border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('github')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'github'
                  ? 'bg-white/10 text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GithubIcon className="h-4 w-4 text-purple-400" />
              <span>GitHub Issues Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('gmail')}
              className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'gmail'
                  ? 'bg-white/10 text-white shadow-sm border border-white/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="h-4 w-4 text-red-400" />
              <span>Gmail Executive Dispatch</span>
            </button>
          </div>

          {/* TAB 1: GITHUB ISSUES SYNC */}
          {activeTab === 'github' && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Repository Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target GitHub Repository
                  </label>
                  <input
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="e.g. facebook/react"
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                </div>

                {/* Optional PAT Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Personal Access Token (Optional)</span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Stored locally in browser
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="w-full rounded-xl bg-black/40 border border-white/10 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Items List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300">
                    Select Action Items to Export ({selectedTaskIndices.size} of {actionItems.length})
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5"
                  >
                    {selectedTaskIndices.size === actionItems.length ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5" /> Select All
                      </>
                    )}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-2 space-y-1.5 divide-y divide-white/[0.04]">
                  {actionItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No action items detected in this meeting yet.
                    </div>
                  ) : (
                    actionItems.map((task, idx) => {
                      const isSelected = selectedTaskIndices.has(idx);
                      const isCompleted = completedTasks.has(idx);
                      const taskText = typeof task === 'object' ? task.text : String(task);
                      const assignee = typeof task === 'object' ? task.assignee : extractAssignee(taskText);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleTask(idx)}
                          className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                            isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="mt-0.5 text-sky-400">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-sky-400" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {taskText}
                            </p>
                            {assignee && (
                              <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
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

              {/* Status Banner */}
              {githubStatus && (
                <div
                  className={`flex items-center gap-2.5 p-3 rounded-xl text-xs border ${
                    githubStatus.type === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : githubStatus.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                  }`}
                >
                  {githubStatus.type === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />}
                  {githubStatus.type === 'success' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />}
                  {githubStatus.type === 'loading' && (
                    <div className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                  )}
                  <span className="flex-1">{githubStatus.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-[0.98]"
                  >
                    {copiedType === 'markdown' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedType === 'markdown' ? 'Copied!' : 'Copy Markdown'}</span>
                  </button>

                  <button
                    onClick={handleOpenFallbackGitHub}
                    className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-[0.98]"
                    title="Open instant issue creator in browser without a token"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open in GitHub (No Token)</span>
                  </button>
                </div>

                <button
                  onClick={handleBatchCreateGitHubIssues}
                  disabled={githubStatus?.type === 'loading'}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <GithubIcon className="h-4 w-4" />
                  <span>Create GitHub Issues</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GMAIL EXECUTIVE DISPATCH */}
          {activeTab === 'gmail' && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Template Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Minutes Template Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEmailTemplate('brief')}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition-all ${
                        emailTemplate === 'brief'
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Executive Brief</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailTemplate('comprehensive')}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition-all ${
                        emailTemplate === 'comprehensive'
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Comprehensive</span>
                    </button>
                  </div>
                </div>

                {/* Attendees / Recipients */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Recipients (comma-separated emails)
                  </label>
                  <input
                    type="text"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="alice@corp.com, bob@corp.com"
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Pre-formatted Email Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Pre-rendered Email Preview
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Subject: {emailSubject}
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap selection:bg-sky-500/30">
                  {emailBody}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={handleCopyEmail}
                  className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-[0.98]"
                >
                  {copiedType === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedType === 'email' ? 'Copied!' : 'Copy Email Body'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenMailto}
                    className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-[0.98]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Open in Mail App</span>
                  </button>

                  <button
                    onClick={handleOpenGmailWeb}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open in Gmail Web</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
