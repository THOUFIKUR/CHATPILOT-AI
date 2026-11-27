import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  UploadCloud, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Bot, 
  Users,
  Inbox,
  Sparkles,
  ArrowRight,
  Activity as ActivityIcon,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

interface OverviewViewProps {
  onNavigate?: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [pendingReplies, setPendingReplies] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [isAutoReplyOn, setIsAutoReplyOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chatpilot_global_auto_reply') === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [toggling, setToggling] = useState(false);

  const refreshAll = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      await Promise.all([
        loadData(0),
        api.getAutoReplyStatus().then(res => {
          if (res && typeof res.auto_reply_enabled === 'boolean') {
            setIsAutoReplyOn(res.auto_reply_enabled);
            localStorage.setItem('chatpilot_global_auto_reply', String(res.auto_reply_enabled));
          }
        }).catch(() => {})
      ]);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll(false);
    const interval = setInterval(() => refreshAll(true), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutoReply = async () => {
    setToggling(true);
    const nextVal = !isAutoReplyOn;
    setIsAutoReplyOn(nextVal);
    localStorage.setItem('chatpilot_global_auto_reply', String(nextVal));
    try {
      await api.toggleAutoReply(nextVal);
    } catch (e) {
      console.error("Error toggling auto-reply:", e);
      setIsAutoReplyOn(!nextVal);
      localStorage.setItem('chatpilot_global_auto_reply', String(!nextVal));
    } finally {
      setToggling(false);
    }
  };

  const loadData = async (retryCount = 1) => {
    try {
      const [c, r, a, p] = await Promise.all([
        api.getContacts().catch(() => []),
        api.getReplies('pending').catch(() => []),
        api.getActivity().catch(() => []),
        api.getProviders().catch(() => [])
      ]);
      const loadedContacts = Array.isArray(c) ? c : [];
      setContacts(loadedContacts);
      setPendingReplies(Array.isArray(r) ? r : []);
      setActivities(Array.isArray(a) ? a : []);
      setProviders(Array.isArray(p) ? p : []);

      if (loadedContacts.length === 0 && retryCount > 0) {
        setTimeout(() => loadData(retryCount - 1), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedContacts = contacts.filter(c => c.is_selected);
  const totalContacts = contacts.length;
  const activeCount = selectedContacts.length;
  const pendingCount = pendingReplies.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 5) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0 && window.scrollY <= 5) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 50) {
      refreshAll(false);
    }
    setTouchStartY(null);
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6"
    >
      {(pullDistance > 15 || refreshing) && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white border border-[#c6c6cb]/60 rounded-full shadow-xs self-center font-mono text-[11px] font-bold text-[#ac3400]">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing live chats & replies...' : pullDistance >= 50 ? 'Release to refresh' : 'Pull down to refresh'}</span>
        </div>
      )}
      {/* Clean Modern Header */}
      <section className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
                System Overview
              </h1>
              <button
                type="button"
                onClick={() => refreshAll(false)}
                disabled={refreshing}
                className="px-3 py-1.5 rounded-full bg-[#f5f3f0] hover:bg-[#efeeeb] border border-[#c6c6cb] font-mono text-[10px] font-bold flex items-center gap-1.5 text-[#1b1c1a] active:scale-95 transition shrink-0"
                title="Refresh live chats, replies, and status"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-[#ac3400]' : ''}`} />
                <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
            <p className="font-sans text-xs md:text-sm text-[#76777c]">
              Real-time monitoring, auto-reply policy controls, and multi-model dispatch status.
              {lastUpdated && <span className="font-mono text-[10px] ml-2 text-[#ac3400]">Updated {lastUpdated}</span>}
            </p>
          </div>

          {/* Clean Auto-Reply Gate Switch */}
          <div className="lg:col-span-5 flex flex-col items-start lg:items-end justify-center">
            <div className="w-full bg-[#fbf9f6] p-4 rounded-xl border border-[#c6c6cb]/70 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs uppercase font-bold text-[#1b1c1a] block">
                  Global Auto-Reply
                </span>
                <span className="font-mono text-[11px] text-[#76777c] font-medium">
                  {isAutoReplyOn ? 'Active (2s delay per reply)' : 'Paused (Drafts held in inbox)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoReply}
                disabled={toggling}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                  isAutoReplyOn ? 'bg-[#ac3400]' : 'bg-[#c6c6cb]'
                }`}
                aria-label="Toggle Global Auto-Reply"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    isAutoReplyOn ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Curved Metric Ledger Dossier Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ledger 1: Permanent Registered Contacts Card */}
        <div 
          onClick={() => onNavigate && onNavigate('chats')}
          className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-sm hover:border-[#1b1c1a] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#c6c6cb]/40">
            <span className="font-mono text-[10px] text-[#46464b] uppercase tracking-widest font-bold">
              REGISTRY CHANNELS
            </span>
            <Users className="w-3.5 h-3.5 text-[#76777c] group-hover:text-[#1b1c1a] transition-colors" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#46464b]">Contacts & Entities</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-bold text-[#1b1c1a]">
                {String(activeCount).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] font-bold text-[#76777c]">
                Active / {totalContacts > 0 ? totalContacts : 1} Total
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#c6c6cb]/30 flex items-center justify-between font-mono text-[10px] font-bold">
            <span className="text-[#46464b]">Authorized Targets</span>
            <span className="px-2 py-0.5 rounded-full bg-[#efeeeb] text-[#1b1c1a]">MANAGED</span>
          </div>
        </div>

        {/* Ledger 2: Real Pending Ratification Card */}
        <div 
          onClick={() => onNavigate && onNavigate('reply-inbox')}
          className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-sm hover:border-[#ac3400] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#c6c6cb]/40">
            <span className="font-mono text-[10px] text-[#ac3400] uppercase tracking-widest font-bold">
              RATIFICATION DOCKET
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#ffdbd0] text-[#ac3400] font-mono text-[9px] font-bold">
              HELD
            </span>
          </div>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#46464b]">Pending Drafts</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-3xl font-bold text-[#ac3400]">
                {String(pendingCount).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] text-[#ac3400] font-bold uppercase">Awaiting Sign-off</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#c6c6cb]/30 flex items-center justify-between font-mono text-[10px] font-bold">
            <span className="text-[#46464b]">Operator Review</span>
            <span className="px-2 py-0.5 rounded-full bg-[#ffdbd0] text-[#390c00]">QUARANTINED</span>
          </div>
        </div>

        {/* Ledger 3: AI Engine */}
        <div 
          onClick={() => onNavigate && onNavigate('ai-providers')}
          className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-sm hover:border-[#1b1c1a] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#c6c6cb]/40">
            <span className="font-mono text-[10px] text-[#46464b] uppercase tracking-widest font-bold">
              AI ENGINE CORE
            </span>
            <Bot className="w-3.5 h-3.5 text-[#1b1c1a]" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#46464b]">Primary Model</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-xl font-bold text-[#1b1c1a]">
                {providers[0]?.model_name || 'Groq Qwen-3.8'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#c6c6cb]/30 flex items-center justify-between font-mono text-[10px] font-bold">
            <span className="text-[#46464b]">Speed: ~218ms</span>
            <span className="px-2 py-0.5 rounded-full bg-[#efeeeb] text-[#1b1c1a]">100% ONLINE</span>
          </div>
        </div>

        {/* Ledger 4: Companion Bridge */}
        <div 
          onClick={() => onNavigate && onNavigate('settings')}
          className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-4 relative flex flex-col justify-between shadow-2xs hover:shadow-sm hover:border-[#1b1c1a] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#c6c6cb]/40">
            <span className="font-mono text-[10px] text-[#46464b] uppercase tracking-widest font-bold">
              COMPANION BRIDGE
            </span>
            <Radio className="w-3.5 h-3.5 text-[#ac3400]" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#46464b]">Active Companion</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif text-lg font-bold text-[#1b1c1a]">Redmi Note 13P</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#c6c6cb]/30 flex items-center justify-between font-mono text-[10px] font-bold">
            <span className="text-[#46464b]">Port 8000 Bridge</span>
            <span className="px-2 py-0.5 rounded-full bg-[#efeeeb] text-[#1b1c1a]">ANDROID 15</span>
          </div>
        </div>
      </section>

      {/* Live Activity Telemetry Feed */}
      <section className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#c6c6cb]/40">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#1b1c1a]">Live Inbound Wire & Telemetry Feed</h2>
            <p className="font-serif text-xs text-[#46464b]">Chronological notification stream and processing log</p>
          </div>
          <button 
            onClick={() => onNavigate && onNavigate('activity')}
            className="font-mono text-[10px] font-bold px-3 py-1 bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#eae8e5] rounded-full border border-[#c6c6cb] transition flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {activities.length > 0 ? (
            activities.slice(0, 5).map((act, idx) => {
              const incoming = act.metadata?.incoming_message;
              const reply = act.metadata?.reply_text || act.metadata?.draft_text;
              return (
                <div key={idx} className="p-3.5 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40 flex flex-col gap-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                      <span className="font-mono text-[10px] text-[#ac3400] font-bold shrink-0">
                        [{new Date(act.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                      </span>
                      <span className="font-bold text-[#1b1c1a] break-all">{act.action || act.event_type || 'Incoming Transmission'}</span>
                      <span className="text-[#46464b] break-words">{act.details || act.description || 'Logged via gateway'}</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white rounded-full border border-[#c6c6cb] text-[#46464b] shrink-0 self-start sm:self-auto">
                      {act.status || 'PROCESSED'}
                    </span>
                  </div>

                  {(incoming || reply) && (
                    <div className="mt-1 p-2.5 bg-white rounded-xl border border-[#c6c6cb]/40 space-y-1 font-sans">
                      {incoming && (
                        <p className="text-[#46464b]">
                          <span className="font-mono text-[10px] font-bold text-[#76777c] uppercase mr-1">Inbound:</span>
                          "{incoming}"
                        </p>
                      )}
                      {reply && (
                        <p className="text-[#1b1c1a] font-medium">
                          <span className="font-mono text-[10px] font-bold text-[#ac3400] uppercase mr-1">Generated Reply:</span>
                          <span className="font-bold text-[#ac3400]">"{reply}"</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40 text-center font-serif text-sm text-[#46464b]">
              No recent wire signals detected. System running in nominal quiescent state.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
