import React, { useState, useEffect } from 'react';
import { Search, Plus, Users, ShieldAlert, Lock, MessageSquare, Check, X, ShieldCheck, AtSign } from 'lucide-react';
import { api } from '../lib/api';

export const GroupsView: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await api.getGroups();
      if (!data || data.length === 0) {
        setGroups([
          { id: '1', group_name: 'College Core Team', members_count: 14, reply_mode: 'mentions_only', mention_only: true, is_selected: true, auto_reply_enabled: false },
          { id: '2', group_name: 'Family & Home', members_count: 8, reply_mode: 'manual_only', mention_only: false, is_selected: true, auto_reply_enabled: false },
          { id: '3', group_name: 'Project Dev Cohort', members_count: 22, reply_mode: 'mentions_only', mention_only: true, is_selected: false, auto_reply_enabled: false },
          { id: '4', group_name: 'Alumni Network', members_count: 65, reply_mode: 'disabled', mention_only: false, is_selected: false, auto_reply_enabled: false },
        ]);
      } else {
        setGroups(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = async (group: any) => {
    const updated = !group.is_selected;
    setGroups(groups.map(g => g.id === group.id ? { ...g, is_selected: updated } : g));
    if (group.id && !['1', '2', '3', '4'].includes(group.id)) {
      await api.updateGroup(group.id, { is_selected: updated });
    }
  };

  const handleToggleMention = async (group: any) => {
    const updated = !group.mention_only;
    setGroups(groups.map(g => g.id === group.id ? { ...g, mention_only: updated } : g));
    if (group.id && !['1', '2', '3', '4'].includes(group.id)) {
      await api.updateGroup(group.id, { trigger_mode: updated ? 'mention' : 'all' });
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const created = await api.createGroup({
        group_name: newGroupName,
        is_selected: true,
        auto_reply_enabled: false,
        reply_mode: 'mentions_only'
      });
      setGroups([created, ...groups]);
      setNewGroupName('');
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
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
            <span className="font-mono text-xs text-[#1b1c1a] font-bold">100% LOCKED</span>
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
            <h4 className="font-serif font-bold text-sm text-[#1b1c1a]">
              Group Auto-Reply Invariant: Permanent Lock
            </h4>
            <p className="font-serif text-xs text-[#46464b] mt-0.5">
              To prevent catastrophic broadcast loops, automatic AI dispatch is completely disabled in groups. All group messages require operator ratification or mention triggers.
            </p>
          </div>
        </div>
        <div className="px-3 py-1 bg-white border border-[#ac3400] rounded-full text-[#ac3400] font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
          POLICY ENFORCED
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#76777c]" />
          <input
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c6c6cb] rounded-xl font-serif text-xs focus:outline-none focus:border-[#1b1c1a] shadow-2xs"
          />
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add WhatsApp Group</span>
        </button>
      </div>

      {/* Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((g) => (
          <div
            key={g.id}
            className="p-5 bg-white rounded-2xl border border-[#c6c6cb]/70 shadow-sm space-y-4 hover:border-[#1b1c1a] transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#efeeeb] border border-[#c6c6cb] flex items-center justify-center font-serif font-bold text-sm text-[#1b1c1a]">
                  <Users className="w-5 h-5 text-[#ac3400]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-[#1b1c1a]">{g.group_name}</h3>
                  <span className="font-mono text-[11px] text-[#76777c]">
                    {g.members_count || 12} members · Monitored
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-[#efeeeb] text-[#46464b] font-mono text-[9px] font-bold uppercase">
                {g.reply_mode || 'Manual'}
              </span>
            </div>

            {/* Group Controls */}
            <div className="space-y-2 pt-2 border-t border-[#c6c6cb]/40 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#46464b] font-serif text-xs">Monitor Group</span>
                <button
                  onClick={() => handleToggleSelect(g)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-[#76777c]" />
                  <span className="text-[#46464b] font-serif text-xs">Mentions Only</span>
                </div>
                <button
                  onClick={() => handleToggleMention(g)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    g.mention_only ? 'bg-[#1b1c1a]' : 'bg-[#c6c6cb]'
                  }`}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-white transform transition-transform ${
                      g.mention_only ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Lock Badge */}
            <div className="p-2 rounded-lg bg-[#f5f3f0] flex items-center justify-between text-[10px] font-mono text-[#76777c]">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#ac3400]" />
                <span>Auto-Reply: Locked Off</span>
              </div>
              <span className="text-[#ac3400] font-bold">STRICT</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal to add group */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#c6c6cb] shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/60">
              <h3 className="font-serif font-bold text-lg text-[#1b1c1a]">Inscribe WhatsApp Group</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#76777c] hover:text-[#1b1c1a]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddGroup} className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-[#76777c] mb-1">
                  Group Moniker / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Delivery Core"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2.5 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-serif text-sm focus:outline-none focus:border-[#1b1c1a]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-mono text-xs text-[#76777c] hover:text-[#1b1c1a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1b1c1a] hover:bg-[#ac3400] text-white rounded-xl font-mono text-xs font-bold uppercase transition"
                >
                  Save Group
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
