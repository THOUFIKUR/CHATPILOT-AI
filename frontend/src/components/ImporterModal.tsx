import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface ImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImporterModal: React.FC<ImporterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [userSender, setUserSender] = useState('');
  const [contactName, setContactName] = useState('');
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setLoading(true);
    setPreview(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selected);

    try {
      const data = await api.previewImport(formData);
      setPreview(data);
      const senders = Object.keys(data.senders || {});
      if (senders.length > 0) {
        setUserSender(senders[0]);
        setContactName(senders[1] || senders[0]);
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!preview || !userSender || !contactName) return;
    setImporting(true);
    try {
      const res = await api.executeImport({
        messages: preview.parsed_messages,
        user_sender_name: userSender,
        contact_display_name: contactName,
      });
      setResult(res);
      onSuccess();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card max-w-xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-base text-[#172033]">Import WhatsApp Chat History (.txt)</h2>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#172033]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preview && !result && (
          <div className="border-2 border-dashed border-[#CBD5E1] rounded-xl p-8 text-center space-y-3 bg-[#F8FAFC]">
            <FileText className="w-10 h-10 text-[#64748B] mx-auto" />
            <div>
              <p className="text-sm font-semibold text-[#172033]">Upload Exported WhatsApp Chat</p>
              <p className="text-xs text-[#64748B] mt-0.5">Export chat without media from WhatsApp as a .txt file</p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-btn text-xs font-semibold cursor-pointer transition">
              <UploadCloud className="w-4 h-4" />
              Browse File
              <input type="file" accept=".txt" onChange={handleFileChange} className="hidden" />
            </label>
            {loading && <p className="text-xs text-blue-600 animate-pulse">Analyzing chat messages...</p>}
          </div>
        )}

        {preview && !result && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
              <span>Parsed <strong>{preview.total_messages}</strong> messages successfully</span>
              <span>{Object.keys(preview.senders || {}).length} Senders detected</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">Which sender is YOU?</label>
                <select
                  value={userSender}
                  onChange={(e) => setUserSender(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#172033]"
                >
                  {Object.entries(preview.senders || {}).map(([s, count]) => (
                    <option key={s} value={s}>{s} ({count as number} msgs)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">Contact Display Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#172033]"
                />
              </div>
            </div>

            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs space-y-1">
              <div className="font-semibold text-[#64748B]">Message Sample Preview:</div>
              <div className="max-h-32 overflow-y-auto space-y-1 text-[#172033]">
                {preview.sample_messages?.slice(0, 4).map((m: any, i: number) => (
                  <div key={i} className="truncate">
                    <strong>{m.sender}:</strong> {m.body}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] rounded-btn text-xs font-medium hover:bg-[#F8FAFC]"
              >
                Back
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={importing}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-btn text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              >
                {importing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {importing ? 'Importing & Learning...' : 'Confirm & Import Chat'}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto" />
            <h3 className="text-base font-bold text-[#172033]">Import Completed Successfully!</h3>
            <p className="text-xs text-[#64748B]">
              Imported {result.messages_imported} messages and extracted {result.writing_samples_stored} writing samples for {contactName}.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#16A34A] text-white rounded-btn text-xs font-semibold hover:bg-[#15803D]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
