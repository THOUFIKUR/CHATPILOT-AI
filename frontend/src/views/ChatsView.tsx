import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Phone, 
  Sliders, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  Languages, 
  Trash2, 
  Plus, 
  Save, 
  Check, 
  X,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Settings2
} from 'lucide-react';
import { api } from '../lib/api';

export const ChatsView: React.FC = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'selected' | 'automatic' | 'approval'>('all');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Section expansion state in drawer
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    basic: true,
    reply: true,
    style: false,
    memory: false,
    safety: false
  });

  // Editable contact state
  const [phoneE164, setPhoneE164] = useState('');
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [replyMode, setReplyMode] = useState('approval');
  const [replyDelay, setReplyDelay] = useState(2);
  const [language, setLanguage] = useState('Auto');
  const [customInstructions, setCustomInstructions] = useState('');
  const [safetyStatus, setSafetyStatus] = useState('nominal');
  const [memoryList, setMemoryList] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);

  useEffect(() => {
    loadContacts(1);
  }, []);

  const loadContacts = async (retriesLeft = 1) => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await api.getContacts();
      const list = Array.isArray(data) ? data : [];
      setContacts(list);
      if (list.length > 0 && !selectedContact) {
        const parveen = list.find((c: any) => c.display_name?.toLowerCase().includes('parveen')) || list[0];
        selectContactForEditing(parveen, false);
      }
    } catch (e: any) {
      console.error('Failed to load contacts', e);
      if (retriesLeft > 0) {
        setTimeout(() => loadContacts(retriesLeft - 1), 1500);
      } else {
        setFetchError(e.message || 'Unable to sync correspondents registry. Please verify backend connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectContactForEditing = async (c: any, openDrawer = true) => {
    if (!c) return;
    setSelectedContact(c);
    setPhoneE164(c.phone_e164 || '');
    setPhoneWarning(null);
    setIsSelected(Boolean(c.is_selected));
    setAutoReplyEnabled(Boolean(c.auto_reply_enabled));
    setReplyMode(c.reply_mode || 'approval');
    setReplyDelay(c.reply_delay !== undefined ? c.reply_delay : 2);
    setLanguage(c.preferred_language || 'Auto');
    setCustomInstructions(c.custom_instructions || '');
    setSafetyStatus(c.safety_status || 'nominal');

    // Fetch contact memory from API
    try {
      const memRes = await api.getMemory(c.id);
      const mData = Array.isArray(memRes) ? memRes : [];
      setMemoryList(mData.map((m: any) => ({
        id: m.id,
        key: m.memory_key || 'Fact',
        value: m.memory_value || ''
      })));
    } catch {
      setMemoryList([]);
    }

    if (openDrawer) {
      setDrawerOpen(true);
    }
  };

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleToggleSelected = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !c.is_selected;
    setContacts(prev => prev.map(item => item.id === c.id ? { ...item, is_selected: nextVal } : item));
    if (selectedContact?.id === c.id) {
      setIsSelected(nextVal);
    }
    try {
      await api.updateContact(c.id, { is_selected: nextVal });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutoReply = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !c.auto_reply_enabled;
    setContacts(prev => prev.map(item => item.id === c.id ? { ...item, auto_reply_enabled: nextVal } : item));
    if (selectedContact?.id === c.id) {
      setAutoReplyEnabled(nextVal);
    }
    try {
      await api.updateContact(c.id, { auto_reply_enabled: nextVal });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDrawer = async () => {
    if (!selectedContact) return;
    const cleanPhone = phoneE164.trim();
    if (replyMode === 'automatic' && !cleanPhone) {
      setPhoneWarning('Add a WhatsApp phone number (e.g. +919876543210) so Automatic mode can open and send replies reliably.');
    } else {
      setPhoneWarning(null);
    }
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateContact(selectedContact.id, {
        phone_e164: cleanPhone || null,
        is_selected: isSelected,
        auto_reply_enabled: autoReplyEnabled,
        reply_mode: replyMode,
        reply_delay: replyDelay,
        preferred_language: language,
        custom_instructions: customInstructions,
        safety_status: safetyStatus
      });

      const updatedFields = {
        phone_e164: cleanPhone || null,
        is_selected: isSelected,
        auto_reply_enabled: autoReplyEnabled,
        reply_mode: replyMode,
        reply_delay: replyDelay,
        preferred_language: language,
        custom_instructions: customInstructions,
        safety_status: safetyStatus
      };

      setSelectedContact((prev: any) => prev ? { ...prev, ...updatedFields } : prev);

      // Update in local list
      setContacts(prev => prev.map(c => c.id === selectedContact.id ? {
        ...c,
        ...updatedFields
      } : c));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save contact', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemory = async () => {
    if (!newKey.trim() || !newVal.trim() || !selectedContact) return;
    try {
      const res = await api.createMemory({
        contact_id: selectedContact.id,
        memory_key: newKey.trim(),
        memory_value: newVal.trim()
      });
      setMemoryList(prev => [...prev, {
        id: res.id || Math.random().toString(),
        key: newKey.trim(),
        value: newVal.trim()
      }]);
      setNewKey('');
      setNewVal('');
      setIsAddingMemory(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    try {
      await api.deleteMemory(memId);
      setMemoryList(prev => prev.filter(m => m.id !== memId));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = (c.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (c.phone_e164 || '').includes(search);
    if (!matchesSearch) return false;
    if (activeFilter === 'selected') return Boolean(c.is_selected);
    if (activeFilter === 'automatic') return c.reply_mode === 'automatic';
    if (activeFilter === 'approval') return c.reply_mode === 'approval';
    return true;
  });

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#c6c6cb]/60 gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ac3400]"></span>
            <span>CONTACTS & GOVERNANCE</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            Correspondents Directory
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b] mt-1">
            Manage authorized contacts, auto-reply permissions, custom response cadence, and cognitive memories.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-full font-mono text-xs font-bold self-start md:self-auto shadow-2xs">
          {(['all', 'selected', 'automatic', 'approval'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3.5 py-1.5 rounded-full uppercase transition-all duration-200 ${
                activeFilter === filter
                  ? 'bg-[#1b1c1a] text-white shadow-2xs'
                  : 'text-[#46464b] hover:text-[#1b1c1a]'
              }`}
            >
              {filter === 'all' ? `All (${contacts.length})` : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white border border-[#c6c6cb]/60 rounded-2xl px-4 py-2.5 shadow-2xs">
        <Search className="w-4 h-4 text-[#76777c]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search correspondents by name or telephone number..."
          className="bg-transparent border-none outline-none w-full font-serif text-sm text-[#1b1c1a] placeholder:text-[#76777c]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-[#76777c] hover:text-[#1b1c1a]">
            Clear
          </button>
        )}
      </div>

      {/* Simplified Clean Contact Cards List */}
      <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#c6c6cb]/40 bg-[#f5f3f0] flex items-center justify-between font-mono text-[11px] font-bold text-[#46464b] uppercase tracking-wider">
          <span>Correspondent ({filteredContacts.length})</span>
          <div className="flex items-center gap-8 mr-4 hidden sm:flex">
            <span>Selected</span>
            <span>Auto-Reply</span>
            <span>Mode</span>
            <span>Settings</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center font-serif text-sm text-[#76777c]">
            Loading correspondents registry...
          </div>
        ) : fetchError ? (
          <div className="p-12 text-center font-serif text-sm space-y-3">
            <p className="text-rose-600 font-semibold">{fetchError}</p>
            <button
              onClick={() => loadContacts(1)}
              className="px-4 py-2 rounded-xl bg-[#1b1c1a] text-white font-mono text-xs font-bold hover:bg-[#2c2d2a] transition"
            >
              Retry Sync
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center font-serif text-sm text-[#76777c]">
            No correspondents match your search criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#c6c6cb]/30">
            {filteredContacts.map((c) => {
              const initial = (c.display_name || 'U').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CP';
              const isItemActive = selectedContact?.id === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => selectContactForEditing(c, true)}
                  className={`p-4 hover:bg-[#f5f3f0]/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                    isItemActive && drawerOpen ? 'bg-[#efeeeb]/60' : ''
                  }`}
                >
                  {/* Left: Avatar & Name */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#1b1c1a] text-white flex items-center justify-center font-mono text-xs font-bold shadow-2xs shrink-0">
                      {initial}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-sm text-[#1b1c1a] flex items-center gap-2">
                        {c.display_name}
                        {c.is_selected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ac3400]"></span>
                        )}
                      </h3>
                      <p className="font-mono text-[11px] text-[#76777c]">
                        {c.phone_e164 || 'No phone recorded'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Essential Controls */}
                  <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    {/* Selected Toggle */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelected(c, e)}
                        className={`w-9 h-5 rounded-full transition-colors relative shadow-inner ${
                          c.is_selected ? 'bg-[#ac3400]' : 'bg-[#c6c6cb]'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-[3px] left-[3px] shadow-sm ${
                            c.is_selected ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-Reply Toggle */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleToggleAutoReply(c, e)}
                        className={`w-9 h-5 rounded-full transition-colors relative shadow-inner ${
                          c.auto_reply_enabled ? 'bg-[#1b1c1a]' : 'bg-[#c6c6cb]'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-[3px] left-[3px] shadow-sm ${
                            c.auto_reply_enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Reply Mode Badge (Green only when automatic AND phone number is saved) */}
                    <span
                      title={
                        c.reply_mode === 'automatic' && !c.phone_e164?.trim()
                          ? 'Phone number missing — add number to auto-send reliably'
                          : undefined
                      }
                      className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                        c.reply_mode === 'automatic'
                          ? c.phone_e164?.trim()
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                          : c.reply_mode === 'disabled'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-[#efeeeb] text-[#46464b] border-[#c6c6cb]/60'
                      }`}
                    >
                      {c.reply_mode === 'automatic' && !c.phone_e164?.trim()
                        ? 'automatic · no number'
                        : c.reply_mode || 'approval'}
                    </span>

                    {/* More Settings Action */}
                    <button
                      type="button"
                      onClick={() => selectContactForEditing(c, true)}
                      className="p-1.5 rounded-xl hover:bg-[#efeeeb] text-[#46464b] hover:text-[#1b1c1a] border border-[#c6c6cb]/40 transition"
                      title="Open Contact Settings"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dedicated Contact Detail Drawer */}
      {drawerOpen && selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-[#c6c6cb]">
            {/* Drawer Header */}
            <div>
              <div className="p-6 border-b border-[#c6c6cb]/60 flex items-center justify-between bg-[#fbf9f6]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#1b1c1a] text-white flex items-center justify-center font-mono text-base font-bold shadow-2xs">
                    {(selectedContact.display_name || 'U').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CP'}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest block">
                      CORRESPONDENT DOSSIER
                    </span>
                    <h2 className="font-serif text-xl font-bold text-[#1b1c1a]">
                      {selectedContact.display_name}
                    </h2>
                    <p className="font-mono text-xs text-[#76777c]">
                      {selectedContact.phone_e164 || 'No phone recorded'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-[#efeeeb] text-[#46464b] hover:text-[#1b1c1a] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sections Accordion */}
              <div className="p-6 space-y-4">
                {/* Section A: Basic */}
                <div className="border border-[#c6c6cb]/60 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => toggleSection('basic')}
                    className="w-full px-4 py-3 bg-[#f5f3f0] flex items-center justify-between font-mono text-xs font-bold text-[#1b1c1a] uppercase tracking-wider"
                  >
                    <span>Section A — Basic Information</span>
                    {openSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openSections.basic && (
                    <div className="p-4 bg-white space-y-3 font-sans text-xs">
                      <div>
                        <label className="font-mono text-[10px] uppercase font-bold text-[#46464b] block mb-1">
                          Display Name:
                        </label>
                        <input
                          type="text"
                          value={selectedContact.display_name || ''}
                          disabled
                          className="w-full p-2.5 bg-[#f5f3f0] border border-[#c6c6cb]/40 rounded-xl font-serif text-sm text-[#1b1c1a]"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase font-bold text-[#46464b]">
                            WhatsApp Phone Number (E.164):
                          </label>
                          <span
                            className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                              phoneE164.trim()
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            {phoneE164.trim() ? '✓ Auto-Send Ready' : '✕ Number Required'}
                          </span>
                        </div>
                        <input
                          type="tel"
                          value={phoneE164}
                          onChange={(e) => {
                            setPhoneE164(e.target.value);
                            if (e.target.value.trim()) setPhoneWarning(null);
                          }}
                          placeholder="+919876543210"
                          className="w-full p-2.5 bg-white border border-[#c6c6cb] rounded-xl font-mono text-xs text-[#1b1c1a] focus:outline-none focus:border-[#1b1c1a]"
                        />
                        {phoneWarning && (
                          <p className="mt-1.5 font-mono text-[10px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                            {phoneWarning}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <p className="font-serif font-bold text-sm text-[#1b1c1a]">Target Contact Selection</p>
                          <p className="font-serif text-xs text-[#76777c]">Include this contact in active processing targets</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSelected(!isSelected)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            isSelected ? 'bg-[#ac3400]' : 'bg-[#c6c6cb]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-[4px] left-[4px] ${
                              isSelected ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section B: Reply Behavior */}
                <div className="border border-[#c6c6cb]/60 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => toggleSection('reply')}
                    className="w-full px-4 py-3 bg-[#f5f3f0] flex items-center justify-between font-mono text-xs font-bold text-[#1b1c1a] uppercase tracking-wider"
                  >
                    <span>Section B — Reply Behavior</span>
                    {openSections.reply ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openSections.reply && (
                    <div className="p-4 bg-white space-y-4 font-sans text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-serif font-bold text-sm text-[#1b1c1a]">Auto-Reply Enabled</p>
                          <p className="font-serif text-xs text-[#76777c]">Authorize response generation for this sender</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${
                            autoReplyEnabled ? 'bg-[#1b1c1a]' : 'bg-[#c6c6cb]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-[4px] left-[4px] ${
                              autoReplyEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div>
                        <label className="font-mono text-[10px] uppercase font-bold text-[#46464b] block mb-1">
                          Reply Mode:
                        </label>
                        <select
                          value={replyMode}
                          onChange={(e) => setReplyMode(e.target.value)}
                          className="w-full p-2.5 bg-white border border-[#c6c6cb] rounded-xl font-mono text-xs font-bold text-[#1b1c1a]"
                        >
                          <option value="automatic">Automatic (Auto-Submit Clean Reply)</option>
                          <option value="approval">Manual Approval (Stage in Reply Inbox)</option>
                          <option value="disabled">Disabled (Do not reply)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-mono text-[10px] uppercase font-bold text-[#46464b] block mb-1">
                          Configured Dispatch Delay:
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setReplyDelay(s)}
                              className={`flex-1 py-1.5 rounded-xl font-mono text-xs font-bold border transition ${
                                replyDelay === s 
                                  ? 'bg-[#1b1c1a] text-white border-[#1b1c1a]' 
                                  : 'bg-white text-[#46464b] border-[#c6c6cb]'
                              }`}
                            >
                              {s}s
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section C: Language and Style */}
                <div className="border border-[#c6c6cb]/60 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => toggleSection('style')}
                    className="w-full px-4 py-3 bg-[#f5f3f0] flex items-center justify-between font-mono text-xs font-bold text-[#1b1c1a] uppercase tracking-wider"
                  >
                    <span>Section C — Language & Persona Style</span>
                    {openSections.style ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openSections.style && (
                    <div className="p-4 bg-white space-y-4 font-sans text-xs">
                      <div>
                        <label className="font-mono text-[10px] uppercase font-bold text-[#46464b] block mb-1">
                          Preferred Dialect / Language:
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full p-2.5 bg-white border border-[#c6c6cb] rounded-xl font-mono text-xs font-bold text-[#1b1c1a]"
                        >
                          <option value="Auto">Auto-Detect Incoming</option>
                          <option value="Tanglish">Tanglish (Tamil in Latin Script)</option>
                          <option value="English">Natural English</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-mono text-[10px] uppercase font-bold text-[#46464b] block mb-1">
                          Custom Instructions For This Contact:
                        </label>
                        <textarea
                          rows={3}
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          placeholder="e.g. Always address as 'maa'. Keep reply under 7 words. Gentle filial respect."
                          className="w-full p-3 border border-[#c6c6cb] rounded-xl font-serif text-xs text-[#1b1c1a] bg-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section D: Memory Directives */}
                <div className="border border-[#c6c6cb]/60 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => toggleSection('memory')}
                    className="w-full px-4 py-3 bg-[#f5f3f0] flex items-center justify-between font-mono text-xs font-bold text-[#1b1c1a] uppercase tracking-wider"
                  >
                    <span>Section D — Cognitive Memory ({memoryList.length})</span>
                    {openSections.memory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openSections.memory && (
                    <div className="p-4 bg-white space-y-3 font-sans text-xs">
                      {memoryList.length === 0 ? (
                        <p className="font-serif text-xs text-[#76777c] italic">No custom facts recorded for this correspondent.</p>
                      ) : (
                        memoryList.map((m) => (
                          <div key={m.id} className="p-2.5 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40 flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-[10px] font-bold text-[#ac3400] uppercase block">
                                {m.key}:
                              </span>
                              <p className="font-serif text-xs text-[#1b1c1a]">{m.value}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemory(m.id)}
                              className="text-[#76777c] hover:text-rose-600 transition p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}

                      {isAddingMemory ? (
                        <div className="p-3 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl space-y-2">
                          <input
                            type="text"
                            placeholder="Key (e.g. Relationship, Nickname)"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            className="w-full p-2 border border-[#c6c6cb]/60 rounded-lg font-mono text-xs bg-white"
                          />
                          <input
                            type="text"
                            placeholder="Fact / Memory Value"
                            value={newVal}
                            onChange={(e) => setNewVal(e.target.value)}
                            className="w-full p-2 border border-[#c6c6cb]/60 rounded-lg font-serif text-xs bg-white"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setIsAddingMemory(false)}
                              className="px-3 py-1 font-mono text-[10px] rounded-lg border border-[#c6c6cb]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleAddMemory}
                              className="px-3 py-1 font-mono text-[10px] font-bold rounded-lg bg-[#1b1c1a] text-white"
                            >
                              Save Fact
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingMemory(true)}
                          className="w-full py-2 border border-dashed border-[#c6c6cb] rounded-xl font-mono text-[11px] font-bold text-[#46464b] hover:text-[#1b1c1a] hover:border-[#1b1c1a] flex items-center justify-center gap-1.5 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Memory Directive</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Section E: Safety & Eligibility */}
                <div className="border border-[#c6c6cb]/60 rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => toggleSection('safety')}
                    className="w-full px-4 py-3 bg-[#f5f3f0] flex items-center justify-between font-mono text-xs font-bold text-[#1b1c1a] uppercase tracking-wider"
                  >
                    <span>Section E — Safety & Eligibility</span>
                    {openSections.safety ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openSections.safety && (
                    <div className="p-4 bg-white space-y-3 font-sans text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-serif font-bold text-sm text-[#1b1c1a]">Account Safety Status</p>
                          <p className="font-serif text-xs text-[#76777c]">Active guardrail compliance status</p>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase">
                          {safetyStatus}
                        </span>
                      </div>
                      <div className="p-3 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/40 text-[#46464b] text-[11px] space-y-1">
                        <p>✓ Financial credentials, CVV & OTP disclosure blocked</p>
                        <p>✓ Rate limiting & duplicate burst cooldown enforced</p>
                        <p>✓ 1-to-1 conversation policy verified</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-[#c6c6cb]/60 bg-[#fbf9f6] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-[#c6c6cb] font-mono text-xs font-bold text-[#46464b] hover:text-[#1b1c1a] hover:bg-[#efeeeb] transition uppercase"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleSaveDrawer}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#ac3400] hover:bg-[#832600] active:scale-95 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-2xs transition disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved Successfully</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
