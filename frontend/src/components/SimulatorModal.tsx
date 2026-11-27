import React, { useState } from 'react';
import { X, Send, Sparkles, CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({ isOpen, onClose, onGenerated }) => {
  const [senderName, setSenderName] = useState('Rahul');
  const [message, setMessage] = useState('File send pannalama?');
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSimulating(true);
    setResult(null);

    try {
      const res = await api.simulateMessage({
        sender_name: senderName,
        message: message,
      });
      setResult(res);
      onGenerated();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[#16A34A]" />
            <h2 className="font-bold text-base text-[#172033]">Windows WhatsApp Simulator</h2>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#172033]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSimulate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Incoming Contact Name</label>
            <div className="flex gap-2">
              <select
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#172033]"
              >
                <option value="Rahul">Rahul</option>
                <option value="Karthik">Karthik</option>
                <option value="Team - College">Team - College</option>
                <option value="Akash">Akash</option>
              </select>
              <input
                type="text"
                placeholder="Or custom name"
                onChange={(e) => {
                  if (e.target.value) setSenderName(e.target.value);
                }}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#172033]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">Simulated Incoming Message</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Tomorrow meeting confirm ah bro?"
              className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#16A34A]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-btn text-xs font-medium hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={simulating}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-btn text-xs font-semibold shadow-2xs transition disabled:opacity-50"
            >
              {simulating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {simulating ? 'Processing AI Pipeline...' : 'Simulate Incoming Message'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#16A34A] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Reply Generated Successfully!
              </span>
              <span className="text-[11px] text-[#64748B]">
                {result.provider} ({result.latency_ms} ms)
              </span>
            </div>
            <div className="text-xs text-[#172033] bg-white p-2.5 rounded border border-[#E2E8F0] font-medium">
              "{result.draft_text}"
            </div>
            <p className="text-[11px] text-[#64748B]">
              This draft has been routed to your <strong>Reply Inbox</strong> for review or auto-send!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
