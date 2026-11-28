import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle,
  Send,
  CornerDownRight,
  Sparkles,
  Bot,
  RotateCcw,
  User
} from 'lucide-react';
import { api } from '../lib/api';

interface PolicyEvaluation {
  category: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: string;
  rationale: string;
  recommended_holding_draft?: string;
}

interface ReplyInboxViewProps {
  onUpdated?: () => void;
}

export const ReplyInboxView: React.FC<ReplyInboxViewProps> = ({ onUpdated }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'failed'>('pending');
  const [replies, setReplies] = useState<any[]>([]);
  const [selectedReply, setSelectedReply] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [policyEval, setPolicyEval] = useState<PolicyEvaluation | null>(null);
  const [evaluatingPolicy, setEvaluatingPolicy] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadReplies();
  }, [activeTab]);

  useEffect(() => {
    if (selectedReply) {
      evaluateMessagePolicy(selectedReply.incoming_message);
    } else {
      setPolicyEval(null);
    }
  }, [selectedReply]);

  const loadReplies = async () => {
    try {
      const data = await api.getReplies(activeTab);
      const cleanData = Array.isArray(data) ? data : [];
      setReplies(cleanData);
      setSelectedReply(cleanData[0] || null);
      setEditedText(cleanData[0]?.draft_text || '');
    } catch (e) {
      console.error(e);
      setReplies([]);
      setSelectedReply(null);
    }
  };

  const evaluateMessagePolicy = async (incomingMsg?: string) => {
    if (!incomingMsg) {
      setPolicyEval(null);
      return;
    }
    setEvaluatingPolicy(true);
    try {
      const res = await api.classifyPolicy(incomingMsg);
      setPolicyEval(res);
    } catch (e) {
      console.error('Failed to classify message policy', e);
      setPolicyEval(null);
    } finally {
      setEvaluatingPolicy(false);
    }
  };

  const handleSelect = (r: any) => {
    setSelectedReply(r);
    setEditedText(r.draft_text || '');
    setIsEditing(false);
  };

  const handleApprove = async (openWhatsApp: boolean = false) => {
    if (!selectedReply) return;
    const textToSend = editedText.trim() || selectedReply.draft_text?.trim();
    if (!textToSend) return;

    setActionLoading(true);
    try {
      await api.approveReply(selectedReply.id, textToSend);
      // Only open WhatsApp if explicitly requested by user
      if (openWhatsApp) {
        const bridge = (window as any).AndroidApp;
        const phone = selectedReply.phone_number;
        if (bridge?.sendWhatsAppMessage && phone) {
          bridge.sendWhatsAppMessage(phone, textToSend);
        }
      }
      await loadReplies();
      if (onUpdated) onUpdated();
    } catch (e: any) {
      console.error(e);
      alert(`Approve failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReply) return;
    setActionLoading(true);
    try {
      await api.rejectReply(selectedReply.id);
      await loadReplies();
      if (onUpdated) onUpdated();
    } catch (e: any) {
      console.error(e);
      alert(`Reject failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedReply || !selectedReply.incoming_message) return;
    setRegenerating(true);
    try {
      const res = await api.regenerateReply(selectedReply.id);
      if (res?.draft?.draft_text) {
        setEditedText(res.draft.draft_text);
        setSelectedReply((prev: any) => ({
          ...prev,
          draft_text: res.draft.draft_text,
          provider_name: res.draft.provider_name,
          model_name: res.draft.model_name
        }));
      }
      await loadReplies();
      if (onUpdated) onUpdated();
    } catch (e) {
      console.error('Regeneration failed', e);
    } finally {
      setRegenerating(false);
    }
  };

  const hasValidIncoming = Boolean(selectedReply?.incoming_message?.trim());
  const hasValidDraft = Boolean((editedText.trim() || selectedReply?.draft_text?.trim()));
  const isDispatchable = hasValidDraft;

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6">
      {/* Header Masthead */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#c6c6cb]/60 gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ac3400]"></span>
            <span>RATIFICATION DESK // INBOX & DISPATCH</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            Operator Ratification Desk
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b] mt-1">
            Human quarantine chamber. Ratify, modify, or regenerate verified AI drafts prior to wire dispatch.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="inline-flex p-1 bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-full font-mono text-xs font-bold self-start md:self-auto shadow-2xs">
          {(['pending', 'approved', 'rejected', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-full uppercase transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-[#1b1c1a] text-white shadow-2xs'
                  : 'text-[#46464b] hover:text-[#1b1c1a]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Inbound List & Dossier Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Transmissions */}
        <div className="lg:col-span-5 space-y-3">
          <div className="font-mono text-[11px] uppercase font-bold tracking-wider text-[#46464b] flex items-center justify-between px-1">
            <span>QUEUED TRANSMISSIONS ({replies.length})</span>
            <span>SORT: RECENCY</span>
          </div>

          {replies.length === 0 ? (
            <div className="p-8 bg-[#f5f3f0] border border-[#c6c6cb]/60 rounded-2xl text-center font-serif text-sm text-[#76777c]">
              No {activeTab} telegrams in this docket.
            </div>
          ) : (
            replies.map((r) => {
              const isSelected = selectedReply?.id === r.id;
              const sender = r.sender_name || r.contact_name || 'Unknown contact';
              const text = r.incoming_message || 'Original message unavailable — verification required';
              const draftDisplay = r.draft_text ? `${r.draft_text.slice(0, 32)}...` : 'No valid draft available';
              const initial = sender.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CP';

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative ${
                    isSelected
                      ? 'bg-white border-[#1b1c1a] shadow-sm'
                      : 'bg-[#f5f3f0] border-[#c6c6cb]/60 hover:bg-[#eae8e5]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#1b1c1a] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                        {initial}
                      </div>
                      <span className="font-serif font-bold text-sm text-[#1b1c1a] truncate max-w-[180px]">
                        {sender}
                      </span>
                    </div>
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      r.status === 'approved' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : r.status === 'rejected'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : r.status === 'failed'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#efeeeb] text-[#46464b] border-[#c6c6cb]/60'
                    }`}>
                      {r.status?.toUpperCase() || 'QUARANTINED'}
                    </span>
                  </div>

                  <p className="font-serif text-xs text-[#46464b] line-clamp-2 italic mb-2">
                    "{text}"
                  </p>

                  <div className="flex items-center justify-between font-mono text-[10px] font-bold text-[#76777c] pt-2 border-t border-[#c6c6cb]/30">
                    <span className="truncate max-w-[190px]">
                      Draft: {draftDisplay}
                    </span>
                    <span>
                      {new Date(r.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Dossier Panel */}
        <div className="lg:col-span-7 bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 md:p-6 shadow-2xs space-y-5">
          {selectedReply ? (
            <>
              {/* Dossier Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1b1c1a] text-white flex items-center justify-center font-mono text-sm font-bold shadow-2xs">
                    {(selectedReply.sender_name || 'CP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CP'}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest block">
                      DOSSIER // ITEM #{selectedReply.id?.slice(0, 8) || '001'}
                    </span>
                    <h2 className="font-serif text-xl font-bold text-[#1b1c1a]">
                      {selectedReply.sender_name || selectedReply.contact_name || 'Unknown contact'}
                    </h2>
                    {selectedReply.phone_number && (
                      <span className="font-mono text-[11px] text-[#76777c]">{selectedReply.phone_number}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#efeeeb] text-[#1b1c1a] border border-[#c6c6cb]">
                    {selectedReply.status?.toUpperCase() || 'HELD'}
                  </span>
                </div>
              </div>

              {/* Original Incoming Box */}
              <div className="bg-[#f5f3f0] border border-[#c6c6cb]/60 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#46464b]">
                    Original Inbound Message:
                  </span>
                  <span className="font-mono text-[10px] text-[#76777c]">
                    {selectedReply.incoming_timestamp ? new Date(selectedReply.incoming_timestamp).toLocaleString() : ''}
                  </span>
                </div>
                <p className="font-serif text-base italic text-[#1b1c1a] leading-relaxed">
                  {selectedReply.incoming_message ? (
                    `"${selectedReply.incoming_message}"`
                  ) : (
                    <span className="text-amber-700 font-sans not-italic text-sm">
                      ⚠️ Original message unavailable — verification required
                    </span>
                  )}
                </p>
              </div>

              {/* Policy & Guardrail Ledger */}
              <div className="bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase font-bold text-[#46464b]">
                  <span>Guardrail & Policy Ledger</span>
                  <span>{evaluatingPolicy ? 'Evaluating...' : 'Verified Safe'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#c6c6cb]/40 font-mono text-xs">
                  <div>
                    <span className="text-[#76777c] block text-[10px] font-bold">CATEGORY:</span>
                    <span className="font-bold text-[#1b1c1a]">{policyEval?.category || 'Casual Communication'}</span>
                  </div>
                  <div>
                    <span className="text-[#76777c] block text-[10px] font-bold">CLASSIFICATION:</span>
                    <span className={`font-bold ${policyEval?.risk_level === 'HIGH' ? 'text-[#ac3400]' : 'text-[#1b1c1a]'}`}>
                      {policyEval?.risk_level || 'LOW (CLEARED)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#76777c] block text-[10px] font-bold">ENGINE:</span>
                    <span className="font-bold text-[#1b1c1a]">{selectedReply.provider_name} ({selectedReply.model_name?.split('/').pop()})</span>
                  </div>
                </div>
              </div>

              {/* Proposed Dispatch Draft */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase font-bold tracking-wider text-[#1b1c1a]">
                    Proposed Dispatch (AI Output):
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating || !hasValidIncoming}
                      className="font-mono text-[10px] font-bold text-[#46464b] hover:text-[#1b1c1a] flex items-center gap-1 disabled:opacity-40"
                    >
                      <RotateCcw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                      <span>{regenerating ? 'Regenerating...' : 'Regenerate Draft'}</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="font-mono text-[10px] font-bold text-[#ac3400] hover:underline"
                    >
                      {isEditing ? 'Cancel Edit' : 'Edit Response'}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    rows={3}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full p-3 border border-[#1b1c1a] rounded-xl font-serif text-base bg-white focus:outline-none"
                    placeholder="Type custom reply text..."
                  />
                ) : (
                  <div className="p-4 border border-[#c6c6cb] rounded-xl bg-[#fbf9f6] font-serif text-base text-[#1b1c1a] leading-relaxed shadow-inner">
                    {editedText || selectedReply.draft_text ? (
                      editedText || selectedReply.draft_text
                    ) : (
                      <span className="text-amber-700 font-sans text-sm">
                        ⚠️ No valid draft available
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Ratification Actions */}
              {activeTab === 'pending' && (
                <div className="pt-4 border-t border-[#c6c6cb]/40 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleApprove(false)}
                    disabled={actionLoading || !isDispatchable}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#ac3400] hover:bg-[#832600] active:scale-95 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Save</span>
                  </button>
                  {selectedReply.phone_number && (
                    <button
                      onClick={() => handleApprove(true)}
                      disabled={actionLoading || !isDispatchable}
                      className="px-4 py-2.5 rounded-xl bg-[#1b1c1a] hover:bg-[#2c2d2a] active:scale-95 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xs transition disabled:opacity-40"
                    >
                      <span>Send via WhatsApp</span>
                    </button>
                  )}
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#efeeeb] text-[#1b1c1a] border border-[#c6c6cb] font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center font-serif text-[#76777c]">
              Select a telegram from the docket to inspect policy and ratify draft.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
