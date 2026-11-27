import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { AssistantChatView } from './views/AssistantChatView';
import { DatasetAuditView } from './views/DatasetAuditView';
import { ChatsView } from './views/ChatsView';
import { GroupsView } from './views/GroupsView';
import { AiProvidersView } from './views/AiProvidersView';
import { ReplyInboxView } from './views/ReplyInboxView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { AuthView } from './views/AuthView';
import { SplashScreen } from './components/SplashScreen';
import { ImporterModal } from './components/ImporterModal';
import { SecretIndicator } from './components/SecretIndicator';
import { api } from './lib/api';
import { supabase, getDeviceIdentifier } from './lib/supabase';
import { Menu, Sparkles, Radio, LogOut } from 'lucide-react';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('chatpilot_user');
      const token = localStorage.getItem('chatpilot_access_token');
      return (stored && token) ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [revocationMessage, setRevocationMessage] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState('overview');
  const [pendingCount, setPendingCount] = useState(0);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Handle single-device revocation event from api.ts
  useEffect(() => {
    // Check if returning from Supabase OAuth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0]
        };
        localStorage.setItem('chatpilot_access_token', session.access_token);
        localStorage.setItem('chatpilot_user', JSON.stringify(u));
        setUser(u);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const u = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0]
        };
        localStorage.setItem('chatpilot_access_token', session.access_token);
        localStorage.setItem('chatpilot_user', JSON.stringify(u));
        setUser(u);
      }
    });

    const handleRevoked = (e: any) => {
      localStorage.removeItem('chatpilot_access_token');
      localStorage.removeItem('chatpilot_user');
      setUser(null);
      setRevocationMessage(
        e.detail?.message || "Your account was signed in on another device. Please log in again to continue."
      );
    };

    window.addEventListener('chatpilot:session_revoked', handleRevoked);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('chatpilot:session_revoked', handleRevoked);
    };
  }, []);

  // Periodic heartbeat session validator (every 30 seconds)
  useEffect(() => {
    if (!user) return;

    const validateActiveSession = async () => {
      try {
        const dev = getDeviceIdentifier();
        const res = await api.validateSession({ 
          device_identifier: dev.id,
          user_id: user?.id 
        });
        if (res && res.active === false) {
          localStorage.removeItem('chatpilot_access_token');
          localStorage.removeItem('chatpilot_user');
          setUser(null);
          setRevocationMessage("Your account was signed in on another device. Please log in again to continue.");
        }
      } catch (err: any) {
        // If 401, api.ts handles dispatch
      }
    };

    const interval = setInterval(validateActiveSession, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) {
      checkPending();
      const interval = setInterval(checkPending, 8000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkPending = async () => {
    try {
      const data = await api.getReplies('pending');
      if (Array.isArray(data)) {
        setPendingCount(data.length);
      }
    } catch {
      // keep fallback
    }
  };

  const handleAuthenticated = (authedUser: any) => {
    setUser(authedUser);
    setRevocationMessage(null);
  };

  const handleLogout = async () => {
    try {
      const dev = getDeviceIdentifier();
      await api.logout({ device_identifier: dev.id });
    } catch {
      // ignore
    }
    localStorage.removeItem('chatpilot_access_token');
    localStorage.removeItem('chatpilot_user');
    setUser(null);
  };

  // 1. Splash Screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // 2. Authentication Gate (Login / Register / OTP / Device Switch Modal)
  if (!user) {
    return (
      <AuthView
        onAuthenticated={handleAuthenticated}
        initialRevocationMessage={revocationMessage}
      />
    );
  }

  // 3. Authenticated Dashboard Views
  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'assistant':
        return <AssistantChatView />;
      case 'reply-inbox':
        return <ReplyInboxView onUpdated={checkPending} />;
      case 'chats':
      case 'memory':
        return <ChatsView />;
      case 'groups':
        return <GroupsView />;
      case 'ai-providers':
        return <AiProvidersView />;
      case 'activity':
        return <ActivityView />;
      case 'dataset-audit':
        return <DatasetAuditView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#fbf9f6] text-[#1b1c1a] overflow-hidden font-sans">
      {/* Mobile Top App Bar (Curved, Stylish Safe Area Header) */}
      <header className="md:hidden flex flex-col justify-between px-4 pt-[max(env(safe-area-inset-top,0px),1.85rem)] pb-3 bg-[#fbf9f6]/95 backdrop-blur-md border-b border-[#c6c6cb]/50 shrink-0 z-20 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 rounded-xl border border-[#c6c6cb]/80 bg-white text-[#1b1c1a] hover:bg-[#efeeeb] active:scale-95 transition shadow-2xs"
              aria-label="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-lg font-bold tracking-tight text-[#1b1c1a]">ChatPilot</span>
                <span className="font-mono text-[10px] text-[#76777c] font-bold uppercase tracking-wider">// DISPATCH</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ac3400] animate-pulse"></span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#46464b]">
                  Redmi Bridge · Online
                </span>
                <SecretIndicator compact={true} className="ml-1" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => setCurrentTab('reply-inbox')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ac3400] text-white text-[11px] font-mono font-bold uppercase shadow-sm active:scale-95 transition animate-pulse"
              >
                <span>Held:</span>
                <span className="bg-white text-[#ac3400] px-1.5 py-0.2 rounded-full text-[10px]">
                  {pendingCount}
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="w-8 h-8 rounded-full bg-[#1b1c1a] text-white flex items-center justify-center font-serif text-xs font-bold shadow-2xs hover:bg-[#ac3400] transition active:scale-95"
            >
              TR
            </button>
          </div>
        </div>
      </header>

      {/* Curved Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={pendingCount}
        onOpenImporter={() => setIsImporterOpen(true)}
        isOpenMobile={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Responsive Workspace */}
      <main className="flex-1 overflow-y-auto bg-[#fbf9f6] relative">
        {renderContent()}
      </main>

      <ImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={() => checkPending()}
      />
    </div>
  );
}

export default App;
