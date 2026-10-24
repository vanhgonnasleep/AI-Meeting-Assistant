import { useMemo, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Clock,
  FileAudio,
  Loader2,
  LayoutDashboard,
  CheckCircle2,
  FolderOpen,
  ChevronDown,
  Settings,
  LogOut,
  Play,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { appPageHref, formatMeetingDuration } from './navigation.js';
import { groupMeetingsByDate } from '../features/meetings/history.js';
import { ClarionWordmark } from '../shared/ui/BrandMarks.jsx';
import { API_BASE, apiFetch } from '../features/auth/api-client.js';

const NAV_ITEMS = [
  ['overview', 'Overview', LayoutDashboard],
  ['studio', 'Meeting studio', FileAudio],
  ['meetings', 'Meeting library', Clock],
  ['tasks', 'Action items', CheckCircle2],
  ['projects', 'Projects', FolderOpen],
];

export default function Sidebar({
  meetings = [],
  currentMeetingId = null,
  onSelectMeeting,
  onDeleteMeeting,
  onNewMeeting,
  canStartNew = true,
  searchQuery = '',
  onSearchChange,
  loadingHistory = false,
  loadingMeetingId = null,
  healthStatus = { online: false, checking: true },
  activePage = 'studio',
  onNavigate,
  account = null,
  onLogout,
  signingOut = false,
  onAccountUpdated,
  onNotify,
  file = null,
  result = null,
  isProcessing = false,
  uploadError = null,
  isContentSaving = false,
  onProcessAudio,
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Account Modal Form State
  const [displayName, setDisplayName] = useState(account?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountModalError, setAccountModalError] = useState('');
  const [accountModalSuccess, setAccountModalSuccess] = useState('');

  const historyRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close popovers on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (historyRef.current && !historyRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setHistoryOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const grouped = useMemo(() => groupMeetingsByDate(meetings), [meetings]);

  const userDisplayName = account?.name || 'Local Workspace';
  const userEmail = account?.email || 'Private local workspace';
  const userProvider =
    account?.provider === 'google'
      ? 'Google OAuth'
      : account?.provider === 'github'
        ? 'GitHub OAuth'
        : 'Local Account';
  const userInitial = (userDisplayName.trim()[0] || 'U').toUpperCase();

  const openAccountModal = () => {
    setUserMenuOpen(false);
    setDisplayName(account?.name || '');
    setCurrentPassword('');
    setNewPassword('');
    setAccountModalError('');
    setAccountModalSuccess('');
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (event) => {
    event.preventDefault();
    if (savingAccount) return;
    setAccountModalError('');
    setAccountModalSuccess('');
    if (!displayName.trim()) {
      setAccountModalError('Display name cannot be empty.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setAccountModalError('New password must be at least 8 characters long.');
      return;
    }
    setSavingAccount(true);
    try {
      const payload = {
        name: displayName.trim(),
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      const response = await apiFetch(`${API_BASE}/api/auth/account`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.user) {
        onAccountUpdated?.(data.user);
      }
      setCurrentPassword('');
      setNewPassword('');
      setAccountModalSuccess('Account details updated successfully.');
      onNotify?.('Account details updated');
    } catch (err) {
      setAccountModalError(
        err.message || 'Could not update account details. Please try again.',
      );
    } finally {
      setSavingAccount(false);
    }
  };

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={label} className="mb-3 last:mb-0">
        <div className="px-2.5 mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 font-mono">
            {label}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {items.length}
          </span>
        </div>
        <div className="space-y-0.5">
          {items.map((meeting) => {
            const isActive = currentMeetingId === meeting.id;
            const isLoading = loadingMeetingId === meeting.id;
            const dur = formatMeetingDuration(meeting.duration);

            return (
              <div
                key={meeting.id}
                className="group relative flex items-center rounded-xl transition-all duration-150"
              >
                <button
                  type="button"
                  onClick={() => {
                    setHistoryOpen(false);
                    onSelectMeeting(meeting);
                  }}
                  disabled={isLoading || !canStartNew}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all duration-150 border ${
                    isActive
                      ? 'bg-indigo-600/12 border-indigo-500/35 text-indigo-700 font-medium'
                      : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                  title={meeting.filename}
                >
                  <FileAudio
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive
                        ? 'text-indigo-700'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="truncate text-xs leading-snug">
                      {meeting.filename || 'Untitled Meeting'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      {dur && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" /> {dur}
                        </span>
                      )}
                      {meeting.action_items_count > 0 && (
                        <span>• {meeting.action_items_count} tasks</span>
                      )}
                    </div>
                  </div>
                  {isLoading && (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-700 animate-spin shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => onDeleteMeeting(meeting.id, e)}
                  aria-label={`Delete meeting ${meeting.filename || meeting.id}`}
                  disabled={!canStartNew}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-500/10 transition-all cursor-pointer"
                  title="Delete record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <header
        id="meeting-sidebar"
        className="clarion-topnav sticky top-0 z-30 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_16px_-10px_rgba(36,49,76,0.12)]"
      >
        <div className="max-w-[1440px] mx-auto h-16 px-4 md:px-6 flex items-center justify-between gap-3">
          {/* Left: Brand + Horizontal Navigation Tabs */}
          <div className="flex items-center gap-5 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 shrink-0 text-left hover:opacity-85 transition-opacity cursor-pointer"
              title="Go to Product Tour & Landing Page"
            >
              <ClarionWordmark
                markSize={19}
                textSize="text-[18px]"
                showTagline={false}
              />
            </button>

            <span
              className="hidden md:block h-5 w-px bg-slate-200/90 shrink-0"
              aria-hidden="true"
            />

            <nav
              className="clarion-horizontal-nav hidden lg:flex items-center gap-1"
              aria-label="Workspace navigation"
            >
              {NAV_ITEMS.map(([id, label, Icon]) => {
                const isCurrent = activePage === id;
                return (
                  <a
                    key={id}
                    href={appPageHref(id)}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey ||
                        event.button !== 0
                      ) {
                        return;
                      }
                      event.preventDefault();
                      onNavigate(id);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ease-out active:scale-[0.98] ${
                      isCurrent
                        ? 'bg-[#e8ecfe] text-[#3c4999] font-semibold shadow-[inset_0_0_0_1px_#d5dcf8]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Quick Search/History, + New Meeting, Process Button, User Profile Dropdown */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Search & Past Meetings Popover Trigger */}
            <div className="relative" ref={historyRef}>
              <button
                type="button"
                onClick={() => setHistoryOpen((prev) => !prev)}
                aria-expanded={historyOpen}
                aria-label="Search past meetings"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/90 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
                title="Search and jump to past meetings"
              >
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Search meetings</span>
                {meetings.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-200/75 text-slate-700 font-mono tabular-nums text-[10px]">
                    {meetings.length}
                  </span>
                )}
              </button>

              {/* Dropdown Panel (Always mounted in DOM so tests can query meeting buttons directly) */}
              <div
                className={`absolute right-0 mt-2 w-80 max-h-[420px] flex flex-col rounded-2xl bg-white border border-slate-200/90 shadow-xl z-50 overflow-hidden transition-all ${
                  historyOpen
                    ? 'opacity-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 -translate-y-1 pointer-events-none invisible'
                }`}
              >
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
                  <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500/80">
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Search past meetings..."
                      className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-hidden"
                      aria-label="Filter past meetings"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="text-[10px] text-slate-400 hover:text-slate-700 font-mono"
                        aria-label="Clear search"
                      >
                        ESC
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                  {loadingHistory ? (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-500 space-y-1.5 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
                      <span>Loading history...</span>
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="py-6 px-3 text-center text-slate-500 text-xs">
                      {searchQuery
                        ? 'No meetings match your search.'
                        : 'No recorded meetings yet.'}
                    </div>
                  ) : (
                    <>
                      {renderGroup('Today', grouped.today)}
                      {renderGroup('Yesterday', grouped.yesterday)}
                      {renderGroup('Previous 7 Days', grouped.pastWeek)}
                      {renderGroup('Older', grouped.older)}
                    </>
                  )}
                </div>

                <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        healthStatus.online ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                    />
                    {healthStatus.checking
                      ? 'Checking AI engine…'
                      : healthStatus.online
                        ? 'AI engine ready'
                        : 'AI engine offline'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(false);
                      onNavigate('meetings');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Full library →
                  </button>
                </div>
              </div>
            </div>

            {/* Start Processing Quick Action when file is selected */}
            {file && !result && !isProcessing && (
              <button
                type="button"
                onClick={onProcessAudio}
                disabled={
                  Boolean(uploadError) || isProcessing || isContentSaving
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all duration-150 ease-out cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Processing</span>
              </button>
            )}

            {/* Primary Action: + New Meeting (Hidden on Overview & Meeting Library where dedicated page toolbars have + New Meeting) */}
            {activePage !== 'overview' && activePage !== 'meetings' && (
              <button
                type="button"
                onClick={onNewMeeting}
                disabled={!canStartNew}
                aria-label="Start new meeting"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] active:scale-[0.98] disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all duration-150 ease-out cursor-pointer"
                title="Start a new meeting"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">New Meeting</span>
              </button>
            )}

            {/* User Profile Pill & Dropdown Menu (Redline Reference Style) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/75 border border-slate-200/90 text-slate-800 text-xs font-medium transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
              >
                <span className="w-7 h-7 rounded-full bg-[#303c63] text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {userInitial}
                </span>
                <span className="hidden md:inline max-w-[140px] truncate font-semibold text-slate-800">
                  {userDisplayName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-xl py-1.5 z-50"
                >
                  {/* Profile Header inside Dropdown */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#303c63] text-white font-semibold text-sm flex items-center justify-center shrink-0">
                      {userInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1 px-1.5 space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openAccountModal}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>Account</span>
                    </button>
                  </div>

                  {account && (
                    <div className="pt-1 mt-1 border-t border-slate-100 px-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout?.();
                        }}
                        disabled={signingOut}
                        aria-label={`Sign out ${account.name}`}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors text-left disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Secondary Horizontal Nav Bar */}
        <nav
          className="lg:hidden flex items-center gap-1 px-4 py-2 border-t border-slate-200/60 overflow-x-auto scrollbar-none bg-slate-50/60"
          aria-label="Mobile workspace navigation"
        >
          {NAV_ITEMS.map(([id, label, Icon]) => {
            const isCurrent = activePage === id;
            return (
              <a
                key={id}
                href={appPageHref(id)}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onNavigate(id);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'bg-[#e8ecfe] text-[#3c4999] font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </header>

      {/* Account Details & Change Password Modal */}
      {accountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-[#4854b8]" />
                <h2
                  id="account-modal-title"
                  className="text-sm font-semibold text-slate-900"
                >
                  Account Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                aria-label="Close account details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-5">
              {/* Profile Summary Banner */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="w-11 h-11 rounded-full bg-[#303c63] text-white font-semibold text-base flex items-center justify-center shrink-0">
                  {userInitial}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {userDisplayName}
                    </p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      <ShieldCheck className="w-3 h-3" />
                      {userProvider}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {userEmail}
                  </p>
                </div>
              </div>

              {accountModalError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium"
                >
                  {accountModalError}
                </div>
              )}

              {accountModalSuccess && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium"
                >
                  {accountModalSuccess}
                </div>
              )}

              {/* Display Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="account-display-name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Display name
                </label>
                <input
                  id="account-display-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl bg-slate-50/70 border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-hidden focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Change Password Section */}
              <div className="pt-3 border-t border-slate-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Change Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPasswords ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="account-current-password"
                    className="block text-xs font-medium text-slate-600"
                  >
                    Current password
                  </label>
                  <input
                    id="account-current-password"
                    name="current-password"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter current password to verify"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-hidden focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="account-new-password"
                    className="block text-xs font-medium text-slate-600"
                  >
                    New password (leave blank to keep current)
                  </label>
                  <input
                    id="account-new-password"
                    name="new-password"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={256}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-hidden focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-4 py-2 rounded-xl bg-[#303c63] hover:bg-[#40507b] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingAccount ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
