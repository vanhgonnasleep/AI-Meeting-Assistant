import { useState, useEffect } from 'react';
import { X, Copy, Check, Radio, ShieldCheck, Trash2, Loader2 } from 'lucide-react';

export default function ShareModal({ meetingId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let unmounted = false;
    async function initShare() {
      try {
        setLoading(true);
        const res = await fetch(`/api/meetings/${meetingId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: 24 })
        });
        if (!res.ok) throw new Error('Failed to generate LAN share link');
        const data = await res.json();
        if (!unmounted) setShareData(data);
      } catch (err) {
        if (!unmounted) setError(err.message);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    if (meetingId) initShare();
    return () => { unmounted = true; };
  }, [meetingId]);

  const handleCopy = () => {
    if (shareData?.share_url) {
      navigator.clipboard.writeText(shareData.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async () => {
    if (!shareData?.token) return;
    try {
      setRevoking(true);
      const res = await fetch(`/api/share/${shareData.token}`, { method: 'DELETE' });
      if (res.ok) {
        setShareData(null);
        onClose();
      }
    } catch {
      setError('Failed to revoke link');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Share to Local Network (LAN)</h3>
              <p className="text-xs text-slate-500">Wi-Fi & LAN Read-Only Portal</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Detecting local IP and generating token...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        ) : shareData ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">LAN Portal URL (Same Wi-Fi/LAN)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareData.share_url}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50/60 border border-slate-200/60 text-center space-y-2">
              <div className="w-36 h-36 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                <svg className="w-full h-full text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="8" height="8" rx="1" />
                  <rect x="14" y="2" width="8" height="8" rx="1" />
                  <rect x="2" y="14" width="8" height="8" rx="1" />
                  <rect x="5" y="5" width="2" height="2" fill="currentColor" />
                  <rect x="17" y="5" width="2" height="2" fill="currentColor" />
                  <rect x="5" y="17" width="2" height="2" fill="currentColor" />
                  <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z" fill="currentColor" />
                </svg>
              </div>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Scan with any phone or tablet on the same Wi-Fi to view read-only meeting notes in real time.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero-Cloud · 24h Expiry</span>
              </div>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{revoking ? 'Revoking…' : 'Revoke Link'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
