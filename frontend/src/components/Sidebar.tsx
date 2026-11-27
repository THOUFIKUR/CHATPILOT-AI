import React from 'react';
import { SecretIndicator } from './SecretIndicator';
import { 
  LayoutDashboard, 
  Bot, 
  Inbox, 
  Users, 
  Sliders, 
  Clock, 
  Database,
  Settings, 
  UploadCloud,
  X,
  Radio,
  Sparkles,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingCount: number;
  onOpenImporter: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingCount,
  onOpenImporter,
  isOpenMobile = false,
  onCloseMobile,
  onLogout
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'assistant', label: 'Ask ChatPilot', icon: Bot, isNew: true },
    { id: 'reply-inbox', label: 'Reply Inbox', icon: Inbox, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'chats', label: 'Contacts & Ledger', icon: Users },
    { id: 'groups', label: 'WhatsApp Groups', icon: Radio },
    { id: 'ai-providers', label: 'AI Providers', icon: Sliders },
    { id: 'activity', label: 'Activity Logs', icon: Clock },
    { id: 'dataset-audit', label: 'Dataset Audit', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const storedUser = (() => {
    try {
      const u = localStorage.getItem('chatpilot_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();

  const displayName = storedUser?.name || storedUser?.email?.split('@')[0] || 'Thoufikur Rahman';
  const initials = displayName.substring(0, 2).toUpperCase();

  const sidebarBody = (
    <div className="flex flex-col justify-between h-full bg-[#fbf9f6] border-r border-[#c6c6cb]/60 select-none text-[#1b1c1a] font-sans">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Clean Modern Header */}
        <div className="p-4 border-b border-[#c6c6cb]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1b1c1a] text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5 text-[#ffb59d]" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight text-[#1b1c1a] leading-none">
                ChatPilot
              </h1>
              <span className="font-mono text-[10px] text-[#76777c] font-medium">
                Personal AI Companion
              </span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#46464b] hover:bg-black/5 active:scale-95 transition"
              title="Close Navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clean Minimal Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-xs active:scale-[0.98] ${
                  isActive
                    ? 'bg-[#1b1c1a] text-white font-bold shadow-xs'
                    : 'text-[#46464b] hover:bg-[#efeeeb] hover:text-[#1b1c1a] font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#76777c]'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 bg-[#ac3400] text-white font-mono text-[9px] font-bold rounded-full shadow-2xs">
                      {item.badge}
                    </span>
                  )}
                  {item.isNew && (
                    <span className="px-1.5 py-0.2 bg-[#ffdbd0] text-[#ac3400] font-mono text-[9px] font-bold rounded-md">
                      AI
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Action: Import Corpus */}
        <div className="p-3 border-t border-[#c6c6cb]/40">
          <button
            onClick={() => {
              onOpenImporter();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white hover:bg-[#efeeeb] text-[#1b1c1a] border border-[#c6c6cb] shadow-2xs active:scale-98 transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#76777c]" />
            Import Corpus (.TXT)
          </button>
        </div>
      </div>

      {/* Modern Profile Bar with Quick Sign Out */}
      <div className="p-3 border-t border-[#c6c6cb]/50 bg-[#f5f3f0] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1b1c1a] text-white flex items-center justify-center font-serif text-xs font-bold shadow-2xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1b1c1a] truncate leading-tight">{displayName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ac3400] animate-pulse"></span>
              <span className="font-mono text-[9px] text-[#76777c] font-bold">Online</span>
              <SecretIndicator compact={true} className="ml-1" />
            </div>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-[#76777c] hover:text-[#ba1a1a] hover:bg-black/5 active:scale-95 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-[240px] h-screen shrink-0 sticky top-0">
        {sidebarBody}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-[280px] max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
};
