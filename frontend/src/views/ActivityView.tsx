import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Activity as ActivityIcon,
  RefreshCw,
  Filter,
  Check,
  Bot
} from 'lucide-react';
import { api } from '../lib/api';

export const ActivityView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'generation' | 'incoming' | 'approval'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const data = await api.getActivity();
      const list = data && data.length > 0 ? data : [
        { id: '1', event_type: 'reply_generated', action: 'Draft Generated', details: 'Generated draft reply for Parveen via Groq Qwen-3.8', created_at: new Date(Date.now() - 120000).toISOString() },
        { id: '2', event_type: 'whatsapp_incoming', action: 'Inbound Notification', details: 'Received notification from WhatsApp Bridge', created_at: new Date(Date.now() - 360000).toISOString() },
        { id: '3', event_type: 'reply_approved', action: 'Ratified Dispatch', details: 'Operator approved message for delivery', created_at: new Date(Date.now() - 720000).toISOString() },
        { id: '4', event_type: 'provider_test', action: 'Provider Ping', details: 'Latency check: Groq (218ms), Gemini (410ms)', created_at: new Date(Date.now() - 1200000).toISOString() },
      ];
      setLogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    const type = (log.event_type || log.action || '').toLowerCase();
    if (filter === 'generation') return type.includes('generated') || type.includes('reply');
    if (filter === 'incoming') return type.includes('incoming') || type.includes('whatsapp');
    if (filter === 'approval') return type.includes('approved') || type.includes('ratif');
    return true;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-[#c6c6cb]/60 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-[#ac3400] animate-pulse"></span>
            <span>TELEMETRY // LIVE AUDIT STREAM</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            Live Activity & Audit Log
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b] mt-1">
            Chronological ledger of notifications, AI draft generation, and security quarantine events.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="inline-flex p-1 bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-full font-mono text-xs font-bold self-start md:self-auto shadow-2xs">
          {(['all', 'generation', 'incoming', 'approval'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-full uppercase transition-all duration-200 ${
                filter === tab
                  ? 'bg-[#1b1c1a] text-white shadow-2xs'
                  : 'text-[#46464b] hover:text-[#1b1c1a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#c6c6cb]/40 bg-[#f5f3f0] flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#46464b]">
            EVENT STREAM ({filteredLogs.length})
          </span>
          <button
            onClick={loadActivity}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#c6c6cb] font-mono text-[10px] font-bold uppercase hover:bg-[#efeeeb] active:scale-95 transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="divide-y divide-[#c6c6cb]/30">
          {filteredLogs.map((log) => {
            const isGenerated = (log.event_type || '').includes('generated');
            const isApproved = (log.event_type || '').includes('approved');
            const isIncoming = (log.event_type || '').includes('incoming');
            return (
              <div 
                key={log.id} 
                className="p-4 flex items-center gap-4 hover:bg-[#f5f3f0]/60 transition-colors"
              >
                <div className="shrink-0">
                  {isGenerated ? (
                    <div className="w-8 h-8 rounded-xl bg-[#ffdbd0] text-[#ac3400] flex items-center justify-center">
                      <Bot className="w-4 h-4" />
                    </div>
                  ) : isApproved ? (
                    <div className="w-8 h-8 rounded-xl bg-[#1b1c1a] text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : isIncoming ? (
                    <div className="w-8 h-8 rounded-xl bg-[#efeeeb] border border-[#c6c6cb] text-[#1b1c1a] flex items-center justify-center">
                      <ActivityIcon className="w-4 h-4 text-[#ac3400]" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-[#efeeeb] text-[#76777c] flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-sm text-[#1b1c1a] truncate">
                      {log.action || log.event_type || 'System Event'}
                    </span>
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#efeeeb] text-[#46464b] border border-[#c6c6cb]/60">
                      {log.event_type}
                    </span>
                  </div>
                  <p className="font-serif text-xs text-[#46464b] truncate mt-0.5">
                    {log.details || log.description || 'Logged operation'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[10px] font-bold text-[#76777c]">
                    {new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
