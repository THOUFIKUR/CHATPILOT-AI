import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Users, 
  ShieldAlert, 
  Lock, 
  Check, 
  X, 
  ShieldCheck, 
  AtSign, 
  Trash2, 
  Bot, 
  MessageSquare, 
  Settings2,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states for creating a new group
  const [groupName, setGroupName] = useState('');
  const [triggerMode, setTriggerMode] = useState<'mention_only' | 'all_messages'>('mention_only');
  const [replyMode, setReplyMode] = useState<'approval' | 'automatic'>('approval');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [isSelected, setIsSelected] = useState(true);
  const [detectionNotes, setDetectionNotes] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = async (group: any) => {
    const updated = !group.is_selected;
    setGroups(groups.map(g => g.id === group.id ? { ...g, is_selected: updated } : g));
    try {
      await api.updateGroup(group.id, { is_selected: updated });
    } catch (e) {
      console.error(e);
      loadGroups();
    }
  };

  const handleToggleAutoReply = async (group: any) => {
    const updated = !group.auto_reply_enabled;
    setGroups(groups.map(g => g.id === group.id ? { ...g, auto_reply_enabled: updated } : g));
    try {
      await api.updateGroup(group.id, { auto_reply_enabled: updated });
    } catch (e) {
      console.error(e);
      loadGroups();
    }
  };

  const handleToggleTrigger = async (group: any) => {
    const newMode = group.trigger_mode === 'all_messages' ? 'mention_only' : 'all_messages';
    setGroups(groups.map(g => g.id === group.id ? { ...g, trigger_mode: newMode } : g));
    try {
      await api.updateGroup(group.id, { trigger_mode: newMode });
    } catch (e) {
      console.error(e);
      loadGroups();
    }
  };

  const handleToggleReplyMode = async (group: any) => {
    const newMode = group.reply_mode === 'automatic' ? 'approval' : 'automatic';
    setGroups(groups.map(g => g.id === group.id ? { ...g, reply_mode: newMode } : g));
    try {
      await api.updateGroup(group.id, { reply_mode: newMode });
    } catch (e) {
      console.error(e);
      loadGroups();
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the group "${name}" from ChatPilot?`)) return;
    try {
      await api.deleteGroup(groupId);
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (e) {
      console.error(e);
      alert('Failed to delete group.');
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const created = await api.createGroup({
        group_name: groupName.trim(),
        is_selected: isSelected,
        auto_reply_enabled: autoReplyEnabled,
        reply_mode: replyMode,
        trigger_mode: triggerMode,
        notes: detectionNotes.trim() || undefined
      });
      setGroups([created, ...groups]);
      setGroupName('');
      setDetectionNotes('');
      setTriggerMode('mention_only');
      setReplyMode('approval');
      setAutoReplyEnabled(false);
      setIsSelected(true);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to create group. Please check settings.');
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = groups.filter(g =>
    (g.group_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6 font-sans">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#c6c6cb]/60">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest">
              SECTION 05 // GROUP CHANNELS
            </span>
            <span className="text-[#c6c6cb]">•</span>
            <span className="font-mono text-[10px] text-[#76777c] uppercase font-bold">
              DISPATCH GOVERNANCE
            </span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            WhatsApp Groups
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b]">
            Monitor group conversations, mention filters, and strict anti-spam containment boundaries.
          </p>
        </div>

        {/* Telemetry Stat Pill */}
        <div className="flex items-center gap-3 bg-[#f5f3f0] px-4 py-2.5 rounded-2xl border border-[#c6c6cb]/60 shadow-2xs">
          <div className="flex flex-col pr-3 border-r border-[#c6c6cb]/50">
            <span className="font-mono text-[9px] text-[#76777c] uppercase font-bold">Total Groups</span>
            <span className="font-mono text-sm text-[#1b1c1a] font-bold">{groups.length}</span>
          </div>
          <div className="flex flex-col px-3 border-r border-[#c6c6cb]/50">
            <span className="font-mono text-[9px] text-[#ac3400] uppercase font-bold">Monitored</span>
            <span className="font-mono text-sm text-[#ac3400] font-bold">
              {groups.filter(g => g.is_selected).length}
            </span>
          </div>
          <div className="flex flex-col pl-2">
            <span className="font-mono text-[9px] text-[#76777c] uppercase font-bold">Auto-Reply</span>
            <span className="font-mono text-xs text-[#1b1c1a] font-bold">
              {groups.filter(g => g.auto_reply_enabled).length} ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Safety Policy Alert Banner */}
      <div className="rounded-2xl bg-[#ffdbd0]/60 border border-[#ffb59d] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ac3400] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1b1c1a]">Group Auto-Reply Safeguard Active</h4>
            <p className="font-serif text-xs text-[#46464b] mt-0.5">
              By default, groups only respond when you are explicitly @mentioned to prevent accidental chat flood.
            </p>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#76777c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search enrolled groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#c6c6cb]/60 rounded-xl font-serif text-sm focus:outline-none focus:border-[#1b1c1a]"
          />
        </div>
        <button
          onClick={() => {
            setErrorMessage('');
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add WhatsApp Group</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((g) => (
          <div
            key={g.id}
            className={`bg-white rounded-2xl border p-5 space-y-4 shadow-2xs transition-all ${
              g.is_selected ? 'border-[#1b1c1a]/30' : 'border-[#c6c6cb]/40 opacity-75'
            }`}
          >
            {/* Group Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f5f3f0] text-[#1b1c1a] flex items-center justify-center font-bold font-serif border border-[#c6c6cb]/60">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1b1c1a] line-clamp-1">
                    {g.group_name}
                  </h3>
                  <span className="font-mono text-[10px] text-[#76777c]">
                    {g.whatsapp_jid || `${g.group_name.toLowerCase().replace(/\s+/g, '')}@g.us`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDeleteGroup(g.id, g.group_name)}
                className="p-1.5 text-[#8a8b90] hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                title="Remove group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Configured Details */}
            {g.notes && (
              <div className="p-2.5 rounded-xl bg-[#fbf9f6] border border-[#ede5dc] text-xs font-serif text-[#5e5f63]">
                <span className="font-mono text-[9px] uppercase font-bold text-[#ac3400] block mb-0.5">Rules</span>
                <p className="line-clamp-2">{g.notes}</p>
              </div>
            )}

            {/* Interactive Control Toggles */}
            <div className="pt-2 border-t border-[#c6c6cb]/40 space-y-2.5">
              {/* Monitored Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[#46464b] font-serif text-xs font-medium">Detect Messages</span>
                <button
                  onClick={() => handleToggleSelect(g)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    g.is_selected ? 'bg-[#1b1c1a]' : 'bg-[#c6c6cb]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                      g.is_selected ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Trigger Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-[#76777c]" />
                  <span className="text-[#46464b] font-serif text-xs font-medium">Trigger Mode</span>
                </div>
                <button
                  onClick={() => handleToggleTrigger(g)}
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase transition ${
                    g.trigger_mode === 'all_messages'
                      ? 'bg-[#c84b1a] text-white'
                      : 'bg-[#ede5dc] text-[#5e5f63]'
                  }`}
                >
                  {g.trigger_mode === 'all_messages' ? 'All Messages' : '@Mentions Only'}
                </button>
              </div>

              {/* Reply Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#76777c]" />
                  <span className="text-[#46464b] font-serif text-xs font-medium">Reply Mode</span>
                </div>
                <button
                  onClick={() => handleToggleReplyMode(g)}
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase transition ${
                    g.reply_mode === 'automatic'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-[#ede5dc] text-[#5e5f63]'
                  }`}
                >
                  {g.reply_mode === 'automatic' ? 'Direct Auto-Send' : 'Approval Draft'}
                </button>
              </div>

              {/* Auto-Reply Switch */}
              <div className="flex items-center justify-between pt-1 border-t border-[#ede5dc]/60">
                <span className="text-[#46464b] font-serif text-xs font-medium">Auto-Reply Enabled</span>
                <button
                  onClick={() => handleToggleAutoReply(g)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                    g.auto_reply_enabled ? 'bg-emerald-600' : 'bg-[#c6c6cb]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                      g.auto_reply_enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-[#c6c6cb] p-6 space-y-3">
            <Users className="w-8 h-8 text-[#8a8b90] mx-auto" />
            <h3 className="font-serif font-bold text-base text-[#1b1c1a]">No WhatsApp Groups Configured</h3>
            <p className="font-serif text-xs text-[#76777c] max-w-sm mx-auto">
              Add your university cohort, project team, or family groups to manage detection and custom reply rules.
            </p>
          </div>
        )}
      </div>

      {/* Modal to add group with full configuration options */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#c6c6cb] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/60">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#1b1c1a]">Register WhatsApp Group</h3>
                <p className="font-serif text-xs text-[#76777c]">Configure detection scope, reply behavior, and triggers once.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#76777c] hover:text-[#1b1c1a]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-sans">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddGroup} className="space-y-4">
              {/* Group Name */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  Group Moniker / Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SVCE 2026-2030 Students"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-sm focus:outline-none focus:border-[#1b1c1a]"
                  required
                />
              </div>

              {/* Trigger Mode */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  When Should ChatPilot Detect & Respond?
                </label>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setTriggerMode('mention_only')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      triggerMode === 'mention_only'
                        ? 'border-[#1b1c1a] bg-[#1b1c1a] text-white'
                        : 'border-[#c6c6cb] bg-[#fbf9f6] text-[#46464b] hover:bg-[#ede5dc]'
                    }`}
                  >
                    <span className="font-bold block">@Mentions Only</span>
                    <span className="text-[10px] opacity-80">Safe: Only triggers when someone mentions @Thoufikur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTriggerMode('all_messages')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      triggerMode === 'all_messages'
                        ? 'border-[#1b1c1a] bg-[#1b1c1a] text-white'
                        : 'border-[#c6c6cb] bg-[#fbf9f6] text-[#46464b] hover:bg-[#ede5dc]'
                    }`}
                  >
                    <span className="font-bold block">All Messages</span>
                    <span className="text-[10px] opacity-80">Triggers on every incoming message in the group</span>
                  </button>
                </div>
              </div>

              {/* Reply Mode */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  Reply Verification Mode
                </label>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setReplyMode('approval')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      replyMode === 'approval'
                        ? 'border-[#c84b1a] bg-[#c84b1a] text-white'
                        : 'border-[#c6c6cb] bg-[#fbf9f6] text-[#46464b] hover:bg-[#ede5dc]'
                    }`}
                  >
                    <span className="font-bold block">Approval (Ratification)</span>
                    <span className="text-[10px] opacity-80">Holds AI draft for you to review before dispatching</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplyMode('automatic')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      replyMode === 'automatic'
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-[#c6c6cb] bg-[#fbf9f6] text-[#46464b] hover:bg-[#ede5dc]'
                    }`}
                  >
                    <span className="font-bold block">Automatic Dispatch</span>
                    <span className="text-[10px] opacity-80">Directly dispatches AI reply via WhatsApp Bridge</span>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-[#ede5dc]">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-xs text-[#1b1c1a] font-medium">Activate Message Detection</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => setIsSelected(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1b1c1a]"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-serif text-xs text-[#1b1c1a] font-medium">Enable Automatic Replies</span>
                  <input
                    type="checkbox"
                    checked={autoReplyEnabled}
                    onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </div>
              </div>

              {/* Notes / Instructions */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  What Should ChatPilot Detect & Answer in this Group? (Optional)
                </label>
                <textarea
                  placeholder="e.g. Only answer questions regarding class assignments, PE notes, and schedule. Do not reply to casual banter."
                  value={detectionNotes}
                  onChange={(e) => setDetectionNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-xs focus:outline-none focus:border-[#1b1c1a]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#ede5dc]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-mono text-xs text-[#76777c] hover:text-[#1b1c1a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Inscribe Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsView;
