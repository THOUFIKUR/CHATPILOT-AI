import React, { useState, useEffect } from 'react';
import { Search, Plus, Users, ShieldAlert, Lock, Trash2, AtSign, Check, X, ShieldCheck, Radio } from 'lucide-react';
import { api } from '../lib/api';

interface GroupData {
  id: string;
  group_name: string;
  whatsapp_jid?: string;
  is_selected: boolean;
  auto_reply_enabled: boolean;
  reply_mode: 'approval' | 'automatic';
  trigger_mode: 'mention_only' | 'all_messages';
  members_count?: number;
  created_at?: string;
}

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formJid, setFormJid] = useState('');
  const [formTriggerMode, setFormTriggerMode] = useState<'mention_only' | 'all_messages'>('mention_only');
  const [formReplyMode, setFormReplyMode] = useState<'approval' | 'automatic'>('approval');
  const [formIsSelected, setFormIsSelected] = useState(true);
  const [formAutoReply, setFormAutoReply] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      if (Array.isArray(data)) {
        setGroups(data);
      } else {
        setGroups([]);
      }
    } catch (e: any) {
      console.error('Failed to load groups:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = async (group: GroupData) => {
    const updated = !group.is_selected;
    setGroups(groups.map(g => g.id === group.id ? { ...g, is_selected: updated } : g));
    try {
      await api.updateGroup(group.id, { is_selected: updated });
    } catch (err: any) {
      console.error('Failed to update group selection:', err);
      loadGroups();
    }
  };

  const handleToggleTriggerMode = async (group: GroupData) => {
    const nextMode: 'mention_only' | 'all_messages' = 
      group.trigger_mode === 'mention_only' ? 'all_messages' : 'mention_only';
    setGroups(groups.map(g => g.id === group.id ? { ...g, trigger_mode: nextMode } : g));
    try {
      await api.updateGroup(group.id, { trigger_mode: nextMode });
    } catch (err: any) {
      console.error('Failed to update trigger mode:', err);
      loadGroups();
    }
  };

  const handleToggleAutoReply = async (group: GroupData) => {
    const nextAuto = !group.auto_reply_enabled;
    const nextReplyMode: 'approval' | 'automatic' = nextAuto ? 'automatic' : 'approval';
    setGroups(groups.map(g => g.id === group.id ? { ...g, auto_reply_enabled: nextAuto, reply_mode: nextReplyMode } : g));
    try {
      await api.updateGroup(group.id, { 
        auto_reply_enabled: nextAuto,
        reply_mode: nextReplyMode
      });
    } catch (err: any) {
      console.error('Failed to update auto reply:', err);
      loadGroups();
    }
  };

  const handleDeleteGroup = async (group: GroupData) => {
    if (!window.confirm(`Delete WhatsApp group "${group.group_name}" from monitoring?`)) return;
    try {
      await api.deleteGroup(group.id);
      setGroups(groups.filter(g => g.id !== group.id));
    } catch (err: any) {
      console.error('Failed to delete group:', err);
      alert(`Error deleting group: ${err.message}`);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        group_name: formName.trim(),
        whatsapp_jid: formJid.trim() || undefined,
        trigger_mode: formTriggerMode,
        reply_mode: formReplyMode,
        is_selected: formIsSelected,
        auto_reply_enabled: formAutoReply
      };

      const created = await api.createGroup(payload);
      setGroups([created, ...groups.filter(g => g.id !== created.id)]);
      // Reset form
      setFormName('');
      setFormJid('');
      setFormTriggerMode('mention_only');
      setFormReplyMode('approval');
      setFormIsSelected(true);
      setFormAutoReply(false);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create group:', err);
      setErrorMsg(err.message || 'Failed to create group. Check constraints.');
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = groups.filter(g =>
    (g.group_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (g.whatsapp_jid || '').toLowerCase().includes(search.toLowerCase())
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
              WHATSAPP GOVERNANCE
            </span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            WhatsApp Groups
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b]">
            Manage monitored group chats, mention trigger policies, and automatic response containment.
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
            <span className="font-mono text-[9px] text-[#76777c] uppercase font-bold">Auto-Active</span>
            <span className="font-mono text-xs text-[#0284c7] font-bold">
              {groups.filter(g => g.auto_reply_enabled).length} GROUPS
            </span>
          </div>
        </div>
      </div>

      {/* Policy Banner */}
      <div className="rounded-2xl bg-[#ffdbd0]/60 border border-[#ffb59d] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ac3400] text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1b1c1a]">
              Group Trigger & Containment Control
            </h4>
            <p className="font-serif text-xs text-[#46464b] mt-0.5">
              Set groups to <strong>Mention Only</strong> (@thoufikur) to prevent spamming, or <strong>All Messages</strong> if you want every message monitored. Group replies require operator ratification unless explicitly set to Automatic.
            </p>
          </div>
        </div>
        <div className="px-3 py-1 bg-white border border-[#ac3400] rounded-full text-[#ac3400] font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
          PROTECTION ON
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#76777c]" />
          <input
            type="text"
            placeholder="Search groups by name or JID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c6c6cb] rounded-xl font-serif text-xs focus:outline-none focus:border-[#1b1c1a] shadow-2xs"
          />
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add WhatsApp Group</span>
        </button>
      </div>

      {/* Group Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#76777c] font-mono text-xs">Loading groups...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-[#c6c6cb] space-y-2">
          <Users className="w-8 h-8 text-[#76777c] mx-auto" />
          <p className="font-serif text-sm font-bold text-[#1b1c1a]">No WhatsApp groups enrolled yet</p>
          <p className="font-serif text-xs text-[#76777c]">Click "Add WhatsApp Group" above to enroll your first group chat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              className="p-5 bg-white rounded-2xl border border-[#c6c6cb]/70 shadow-sm space-y-4 hover:border-[#1b1c1a] transition relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#efeeeb] border border-[#c6c6cb] flex items-center justify-center font-serif font-bold text-sm text-[#1b1c1a]">
                    <Users className="w-5 h-5 text-[#ac3400]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1b1c1a]">{g.group_name}</h3>
                    <span className="font-mono text-[11px] text-[#76777c] block truncate max-w-[180px]">
                      {g.whatsapp_jid || 'group@g.us'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase ${
                    g.reply_mode === 'automatic' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#efeeeb] text-[#46464b]'
                  }`}>
                    {g.reply_mode}
                  </span>
                  <button
                    onClick={() => handleDeleteGroup(g)}
                    title="Delete Group"
                    className="p-1.5 text-[#76777c] hover:text-[#dc2626] rounded-lg hover:bg-[#fee2e2] transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Group Controls */}
              <div className="space-y-3 pt-2 border-t border-[#c6c6cb]/40 font-mono text-xs">
                {/* Monitor Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[#1b1c1a] font-serif text-xs font-medium block">Monitor Group</span>
                    <span className="text-[10px] text-[#76777c]">Catch incoming notifications</span>
                  </div>
                  <button
                    onClick={() => handleToggleSelect(g)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      g.is_selected ? 'bg-[#ac3400]' : 'bg-[#c6c6cb]'
                    }`}
                  >
                    <span
                      className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${
                        g.is_selected ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Trigger Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[#1b1c1a] font-serif text-xs font-medium block">
                      {g.trigger_mode === 'mention_only' ? 'Mention Only' : 'All Messages'}
                    </span>
                    <span className="text-[10px] text-[#76777c]">
                      {g.trigger_mode === 'mention_only' ? 'Triggers only on @thoufikur' : 'Triggers on every message'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleTriggerMode(g)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                      g.trigger_mode === 'mention_only' 
                        ? 'bg-[#efeeeb] text-[#1b1c1a] hover:bg-[#e4e2dd]' 
                        : 'bg-[#1b1c1a] text-white hover:bg-[#ac3400]'
                    }`}
                  >
                    {g.trigger_mode === 'mention_only' ? '@ Mention' : 'All Msgs'}
                  </button>
                </div>

                {/* Auto Reply Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[#1b1c1a] font-serif text-xs font-medium block">Auto-Reply Dispatch</span>
                    <span className="text-[10px] text-[#76777c]">
                      {g.auto_reply_enabled ? 'Autonomous reply permitted' : 'Requires Operator Ratification'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleAutoReply(g)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      g.auto_reply_enabled ? 'bg-[#0284c7]' : 'bg-[#c6c6cb]'
                    }`}
                  >
                    <span
                      className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${
                        g.auto_reply_enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Status Footer */}
              <div className="p-2 rounded-lg bg-[#f5f3f0] flex items-center justify-between text-[10px] font-mono text-[#76777c]">
                <div className="flex items-center gap-1.5">
                  {g.auto_reply_enabled ? (
                    <Radio className="w-3.5 h-3.5 text-[#0284c7]" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-[#ac3400]" />
                  )}
                  <span>Status: {g.auto_reply_enabled ? 'Auto Active' : 'Draft / Approval Only'}</span>
                </div>
                <span className="text-[#1b1c1a] font-bold">{g.is_selected ? 'ACTIVE' : 'MUTED'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal to add group */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#c6c6cb] shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/60">
              <h3 className="font-serif font-bold text-lg text-[#1b1c1a]">Enroll WhatsApp Group</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-[#76777c] hover:text-[#1b1c1a] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#ffdbd0] text-[#ba1a1a] font-mono text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddGroup} className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  Group Name / Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SVCE 2026-2030 Students"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-sm focus:outline-none focus:border-[#1b1c1a]"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  WhatsApp JID / Identifier (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 120363028123456789@g.us"
                  value={formJid}
                  onChange={(e) => setFormJid(e.target.value)}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none focus:border-[#1b1c1a]"
                />
                <span className="text-[10px] text-[#76777c] mt-1 block">
                  Leave blank to auto-generate from group name.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase text-[#76777c] mb-1">
                    Trigger Mode
                  </label>
                  <select
                    value={formTriggerMode}
                    onChange={(e) => setFormTriggerMode(e.target.value as any)}
                    className="w-full p-2 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none"
                  >
                    <option value="mention_only">Mention Only (@)</option>
                    <option value="all_messages">All Messages</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase text-[#76777c] mb-1">
                    Reply Mode
                  </label>
                  <select
                    value={formReplyMode}
                    onChange={(e) => setFormReplyMode(e.target.value as any)}
                    className="w-full p-2 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none"
                  >
                    <option value="approval">Approval (Draft)</option>
                    <option value="automatic">Automatic (Auto-Send)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#f5f3f0] rounded-xl">
                <span className="font-mono text-xs text-[#1b1c1a]">Monitor this group immediately</span>
                <input
                  type="checkbox"
                  checked={formIsSelected}
                  onChange={(e) => setFormIsSelected(e.target.checked)}
                  className="w-4 h-4 rounded text-[#ac3400]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#c6c6cb]/40">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-mono text-xs text-[#76777c] hover:text-[#1b1c1a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Group'}
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
