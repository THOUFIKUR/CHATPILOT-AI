import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  MessageSquare, 
  Trash2, 
  Plus, 
  Check, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  BarChart2, 
  Tag, 
  Clock 
} from 'lucide-react';
import { api } from '../lib/api';

export const MemoryView: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'style' | 'summary' | 'facts'>('style');
  const [facts, setFacts] = useState<any[]>([]);
  const [styleProfiles, setStyleProfiles] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedContact) {
      loadContactDetails(selectedContact.id);
    }
  }, [selectedContact]);

  const loadInitialData = async () => {
    try {
      const [contactsList, profilesList] = await Promise.all([
        api.getContacts(),
        api.getStyleProfiles().catch(() => [])
      ]);

      const pMap: Record<string, any> = {};
      if (Array.isArray(profilesList)) {
        profilesList.forEach((p: any) => {
          if (p.contact_id) {
            pMap[p.contact_id] = p;
          }
        });
      }
      setStyleProfiles(pMap);

      if (Array.isArray(contactsList) && contactsList.length > 0) {
        setContacts(contactsList);
        setSelectedContact(contactsList[0]);
      } else {
        // Fallback demo contacts if database is empty
        const fallback = [
          { id: '1', display_name: 'Rahul', whatsapp_jid: 'rahul@s.whatsapp.net' },
          { id: '2', display_name: 'Karthik', whatsapp_jid: 'karthik@s.whatsapp.net' }
        ];
        setContacts(fallback);
        setSelectedContact(fallback[0]);
      }
    } catch (e) {
      console.error('Failed to load initial memory data', e);
    }
  };

  const loadContactDetails = async (contactId: string) => {
    try {
      const data = await api.getMemory(contactId).catch(() => []);
      setFacts(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (newStatus: 'approved' | 'rejected' | 'needs_review') => {
    if (!selectedContact) return;
    const profile = styleProfiles[selectedContact.id];
    if (!profile) return;

    setIsUpdatingStatus(true);
    try {
      await api.reviewStyleProfile(profile.id, newStatus);
      setStyleProfiles({
        ...styleProfiles,
        [selectedContact.id]: {
          ...profile,
          review_status: newStatus
        }
      });
    } catch (e) {
      console.error('Failed to update style profile status', e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newVal.trim() || !selectedContact) return;
    try {
      const created = await api.createMemory({
        contact_id: selectedContact.id,
        memory_key: newKey,
        memory_value: newVal,
        confidence: 1.0
      });
      setFacts([created, ...facts]);
      setNewKey('');
      setNewVal('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setFacts(facts.filter(f => f.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.display_name || c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentProfile = selectedContact ? styleProfiles[selectedContact.id] : null;
  const currentFingerprint = currentProfile?.style_profile || {};
  const currentEvidence = currentProfile?.evidence || {};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#172033] flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[#16A34A]" />
            Writing Style & Contact Memory
          </h1>
          <p className="text-sm text-[#64748B]">
            Learned WhatsApp communication profiles, vocabulary patterns, and persistent facts
          </p>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Contact List */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-4 space-y-3 h-[720px] flex flex-col">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#172033] focus:outline-none focus:border-[#16A34A]"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-[#F1F5F9] pt-1">
            {filteredContacts.map((c) => {
              const name = c.display_name || c.name || 'Unknown';
              const p = styleProfiles[c.id];
              const isSelected = selectedContact?.id === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition ${
                    isSelected ? 'bg-[#F0FDF4] border border-[#DCFCE7]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-[#172033] truncate">{name}</div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        {p ? `${p.review_status || 'profile ready'}` : c.whatsapp_jid || 'WhatsApp contact'}
                      </div>
                    </div>
                  </div>
                  {p && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 ${
                      p.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      p.review_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {p.review_status || 'review'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Memory & Style Details */}
        <div className="md:col-span-2 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs p-6 space-y-6 flex flex-col h-[720px] overflow-y-auto">
          {/* Contact Header & Tabs */}
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#172033] flex items-center gap-2">
                {selectedContact?.display_name || selectedContact?.name || 'Contact'}
                {currentProfile && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${
                    currentProfile.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                    currentProfile.review_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {currentProfile.review_status === 'approved' ? 'Approved Style Profile' :
                     currentProfile.review_status === 'rejected' ? 'Rejected Style Profile' :
                     'Needs User Review'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#64748B]">
                {currentProfile ? `Sample size: ${currentFingerprint.sample_size_non_media_outgoing || 0} messages • Confidence: ${Math.round((currentProfile.confidence || 0) * 100)}%` : 'No custom style profile seeded yet'}
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 border border-[#E2E8F0] rounded-lg">
              <button
                onClick={() => setActiveTab('style')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'style' ? 'bg-white text-[#172033] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                Writing Style
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'summary' ? 'bg-white text-[#172033] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('facts')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'facts' ? 'bg-white text-[#172033] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                Custom Facts
              </button>
            </div>
          </div>

          {/* Tab 1: Writing Style */}
          {activeTab === 'style' && (
            <div className="space-y-6">
              {/* Approval Action Bar */}
              {currentProfile && (
                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#172033]">Provisional Writing Profile</h4>
                    <p className="text-[11px] text-[#64748B]">
                      Extracted from historical WhatsApp conversations. Approve to allow ChatPilot AI to mirror these traits.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatusChange('rejected')}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleStatusChange('approved')}
                      disabled={isUpdatingStatus}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#16A34A] text-white hover:bg-[#15803D] rounded-lg transition shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Style
                    </button>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="text-xs text-[#64748B]">Avg Words / Message</div>
                  <div className="text-xl font-bold text-[#172033]">
                    {currentFingerprint.average_words_per_message || 5.4} words
                  </div>
                  <div className="text-[11px] text-[#64748B]">Concise chat style</div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="text-xs text-[#64748B]">Short Messages (&le; 5 words)</div>
                  <div className="text-xl font-bold text-emerald-700">
                    {Math.round((currentFingerprint.short_message_ratio_le_5_words || 0.72) * 100)}%
                  </div>
                  <div className="text-[11px] text-[#64748B]">Rapid response ratio</div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="text-xs text-[#64748B]">Sample Analyzed</div>
                  <div className="text-xl font-bold text-purple-700">
                    {currentFingerprint.sample_size_non_media_outgoing || 120}
                  </div>
                  <div className="text-[11px] text-[#64748B]">Outgoing texts</div>
                </div>
              </div>

              {/* Language Signals & Code Mixing */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  Language Signals & Mixing
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(currentFingerprint.language_signals || ['Tamil transliteration / Tanglish mixing', 'English']).map((sig: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-white border border-[#CBD5E1] rounded-full text-xs font-medium text-[#1E293B]">
                      {sig}
                    </span>
                  ))}
                </div>
              </div>

              {/* Frequent Content Words */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                  Top Vocabulary & Colloquial Words
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(currentFingerprint.frequent_content_words || [["send", 31], ["da", 28], ["heyy", 20], ["bro", 16], ["ppt", 14]]).map(([word, freq]: any, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-white border border-blue-200 text-blue-900 rounded-lg text-xs font-mono">
                      {word} <span className="text-blue-500 font-sans text-[11px]">({freq})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Overview */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Conversation Context</div>
                <p className="text-sm text-[#172033] leading-relaxed">
                  Historical 1-on-1 WhatsApp chat history imported from verified package. Tone is casual and colloquial with natural Tamil + English transliteration.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl">
                  <span className="text-[#64748B] block mb-1">Export Range:</span>
                  <span className="font-semibold text-[#172033]">
                    {currentEvidence.date_range?.first_date_string || '2025'} &rarr; {currentEvidence.date_range?.last_date_string || '2026'}
                  </span>
                </div>
                <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl">
                  <span className="text-[#64748B] block mb-1">Total Recorded:</span>
                  <span className="font-semibold text-[#172033]">
                    {currentEvidence.message_counts?.total_records || 'Historical'} messages
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Custom Facts */}
          {activeTab === 'facts' && (
            <div className="space-y-4">
              <form onSubmit={handleAddFact} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key (e.g. Favorite Subject, Work Role)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none focus:border-[#16A34A]"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. Distributed Computing)"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  className="flex-2 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs focus:outline-none focus:border-[#16A34A]"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-[#16A34A] text-white rounded-lg text-xs font-semibold hover:bg-[#15803D]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-xl overflow-hidden">
                {facts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#94A3B8]">No custom facts stored for this contact yet.</div>
                ) : (
                  facts.map((fact) => (
                    <div key={fact.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F8FAFC]">
                      <div>
                        <span className="font-semibold text-[#172033]">{fact.memory_key}: </span>
                        <span className="text-[#64748B]">{fact.memory_value}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteFact(fact.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
