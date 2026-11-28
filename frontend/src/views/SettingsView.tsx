import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Smartphone, 
  ShieldCheck, 
  Check, 
  Lock, 
  Unlock, 
  Radio, 
  AlertTriangle,
  RefreshCw,
  User,
  Key,
  LogOut,
  Monitor
} from 'lucide-react';
import { api } from '../lib/api';
import { supabase, getDeviceIdentifier } from '../lib/supabase';

interface SettingsViewProps {
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'companion'>('general');
  const [autoReply, setAutoReply] = useState(false);
  const [replyDelay, setReplyDelay] = useState(2);
  const [language, setLanguage] = useState('Tanglish / English');
  const [accountSafetyStatus, setAccountSafetyStatus] = useState('nominal');
  const [saved, setSaved] = useState(false);
  const [activeDevice, setActiveDevice] = useState<any>(null);
  const [androidDiag, setAndroidDiag] = useState<any>(null);
  const [safeTestResult, setSafeTestResult] = useState<string | null>(null);
  const [testingPipeline, setTestingPipeline] = useState(false);
  const [activeModel, setActiveModel] = useState<any>({ provider_name: 'groq', model_name: 'qwen/qwen3.8-27b' });
  const [modelSaving, setModelSaving] = useState(false);
  const [resettingListener, setResettingListener] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const AI_MODEL_OPTIONS = [
    { label: 'Groq: Qwen 3.8-27b', provider: 'groq', model: 'qwen/qwen3.8-27b', badge: 'Default Fast (0.8s)', desc: 'High-speed local dialect Tanglish & presence replies' },
    { label: 'Gemini: Flash Lite Latest', provider: 'gemini', model: 'gemini-flash-lite-latest', badge: '1M Context', desc: 'Google Cloud ultra-low latency & deep multimodal understanding' },
    { label: 'OpenRouter: DeepSeek Chat', provider: 'openrouter', model: 'deepseek/deepseek-chat', badge: 'Deep Reasoning', desc: 'Logical decision reasoning & complex query parsing' },
    { label: 'OpenRouter: Llama 3.3 70B', provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', badge: 'Flagship Open', desc: 'Versatile 70B open weight instruction tuned model' }
  ];

  const refreshAndroidDiag = () => {
    try {
      const bridge = (window as any).AndroidApp;
      if (bridge && typeof bridge.getNotificationDiagnostics === 'function') {
        const parsed = JSON.parse(bridge.getNotificationDiagnostics());
        setAndroidDiag(parsed);
      }
    } catch (e) {
      console.error('Android diagnostics read note:', e);
    }
  };

  const handleResetNotificationEngine = () => {
    setResettingListener(true);
    setResetSuccess(false);
    try {
      const bridge = (window as any).AndroidApp;
      if (bridge && typeof bridge.resetNotificationListener === 'function') {
        bridge.resetNotificationListener();
        setResetSuccess(true);
        setTimeout(() => setResetSuccess(false), 4000);
      } else {
        alert('Notification listener reset is only active inside the Android APK.');
      }
      setTimeout(() => refreshAndroidDiag(), 1200);
    } catch (e: any) {
      console.error('Reset listener error:', e);
      alert('Error triggering reset: ' + e?.message);
    } finally {
      setResettingListener(false);
    }
  };

  const handleSelectActiveModel = async (provider: string, model: string) => {
    setModelSaving(true);
    setActiveModel({ provider_name: provider, model_name: model });
    try {
      await api.setActiveModel({ provider_name: provider, model_name: model });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to set active model:', e);
    } finally {
      setModelSaving(false);
    }
  };

  const runSafePipelineTest = async () => {
    setTestingPipeline(true);
    setSafeTestResult(null);
    try {
      const res = await fetch(`${(await import('../lib/api')).API_BASE}/webhooks/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'Parveen',
          title: 'Parveen',
          message: 'Safe diagnostic ping',
          platform: 'android',
          source: 'android_diagnostics_safe_test',
          has_native_reply_action: true,
          test_mode: true
        })
      });
      const data = await res.json();
      setSafeTestResult(`HTTP ${res.status} — ${data.pipeline_status || data.status} (${data.reason || 'ok'})`);
      refreshAndroidDiag();
    } catch (e: any) {
      setSafeTestResult(`Test failed: ${e?.message || 'Network error'}`);
    } finally {
      setTestingPipeline(false);
    }
  };

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const device = getDeviceIdentifier();
  const storedUser = JSON.parse(localStorage.getItem('chatpilot_user') || '{"name": "Thoufikur Rahman", "email": "thoufikur@chatpilot.local"}');

  useEffect(() => {
    loadSettings();
    api.getActiveDevice().then(setActiveDevice).catch(() => {});
    refreshAndroidDiag();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await api.getSettings();
      if (s) {
        if (s.auto_reply !== undefined) setAutoReply(s.auto_reply);
        if (s.reply_delay_seconds !== undefined) setReplyDelay(s.reply_delay_seconds);
        if (s.default_language) setLanguage(s.default_language);
        if (s.account_safety_status) setAccountSafetyStatus(s.account_safety_status);
      }
      const st = await api.getAutoReplyStatus();
      if (st && typeof st.auto_reply_enabled === 'boolean') {
        setAutoReply(st.auto_reply_enabled);
      }
      try {
        const am = await api.getActiveModel();
        if (am && am.provider_name) setActiveModel(am);
      } catch {}
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAutoReply = async () => {
    const nextVal = !autoReply;
    setAutoReply(nextVal);
    try {
      await api.toggleAutoReply(nextVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setAutoReply(!nextVal);
    }
  };

  const handleSaveDelay = async (val: number) => {
    setReplyDelay(val);
    try {
      await api.updateSettings({
        auto_reply: autoReply,
        reply_delay_seconds: val,
        default_language: language,
        account_safety_status: accountSafetyStatus
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'New passwords do not match.', error: true });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: 'Password must be at least 6 characters.', error: true });
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword({
        email: storedUser.email,
        current_password: currentPassword,
        new_password: newPassword
      });
      setPwMsg({ text: 'Password successfully updated!', error: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({ text: err.message || 'Failed to update password.', error: true });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.logout({ device_identifier: device.id, user_id: storedUser.id });
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    localStorage.removeItem('chatpilot_access_token');
    localStorage.removeItem('chatpilot_user');
    sessionStorage.clear();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.startsWith('chatpilot_')) {
        localStorage.removeItem(key);
      }
    });
    if (onLogout) onLogout();
    else window.location.reload();
  };

  const handleEmergencyStop = async () => {
    try {
      await api.emergencyStopParveen();
      setAutoReply(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#fbf9f6] text-[#1b1c1a] p-4 md:p-8 space-y-6">
      {/* Masthead Header */}
      <div className="pb-4 border-b border-[#c6c6cb]/60 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#ac3400] uppercase font-bold tracking-widest mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ac3400]"></span>
            <span>SYSTEM // ACCOUNT & ACTIVE DEVICE POLICIES</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a]">
            Settings & Operator Profile
          </h1>
          <p className="font-serif text-xs md:text-sm text-[#46464b] mt-1">
            Manage single-device subscription access, global auto-reply pauses, and 2s dispatch delay.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="inline-flex p-1 bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-full font-mono text-xs font-bold shadow-2xs">
          {(['general', 'account', 'companion'] as const).map((tab) => (
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

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-6 space-y-5">
          {/* General Tab: Reply Behavior & Delay */}
          {activeTab === 'general' && (
            <>
              {/* Master Dispatch Switch */}
              <div className="bg-[#efeeeb] border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1b1c1a]">Master Auto-Reply Gate</h3>
                    <p className="font-serif text-xs text-[#46464b]">Failsafe gate for all devices (Android and Windows)</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoReply}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer shadow-inner ${
                      autoReply ? 'bg-[#ac3400]' : 'bg-[#181b24]'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        autoReply ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#c6c6cb] font-mono text-xs">
                  <span className="text-[#76777c] block text-[10px] font-bold uppercase">STATUS DIRECTIVE:</span>
                  <p className="text-[#1b1c1a] font-bold mt-0.5">
                    {autoReply 
                      ? "ARMED // ACTIVE: Evaluates authorized selected contacts. Rejects unselected contacts."
                      : "AUTO-REPLY PAUSED: Your contact preferences are saved, but automatic WhatsApp replies are currently paused. Enable Global Auto-Reply when you are ready."}
                  </p>
                </div>
              </div>

              {/* Reply Delay Card (Default: 2 seconds) */}
              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#c6c6cb]/40">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1b1c1a]">Authoritative Reply Delay</h3>
                    <p className="font-serif text-xs text-[#46464b]">Holding duration after safety clearance prior to transmission</p>
                  </div>
                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[#efeeeb] text-[#1b1c1a] border border-[#c6c6cb]">
                    {replyDelay}s DELAY
                  </span>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  {[1, 2, 3, 5].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleSaveDelay(sec)}
                      className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold uppercase border transition active:scale-95 ${
                        replyDelay === sec
                          ? 'bg-[#1b1c1a] text-white border-[#1b1c1a] shadow-xs'
                          : 'bg-[#f5f3f0] text-[#46464b] border-[#c6c6cb] hover:bg-[#eae8e5]'
                      }`}
                    >
                      {sec} SEC{sec === 2 ? ' (DEFAULT)' : ''}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-[10px] text-[#76777c]">
                  Synchronized automatically between Windows Desktop and Android companion.
                </p>
              </div>

              {/* Cap Removal & Safety Status */}
              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-2.5 font-mono text-xs">
                <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20 font-bold">
                  <span className="text-[#76777c]">APPLICATION DAILY CAP:</span>
                  <span className="text-[#ac3400]">REMOVED (UNLIMITED AUTHORIZED)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20 font-bold">
                  <span className="text-[#76777c]">ACCOUNT SAFETY STATUS:</span>
                  <span className="text-[#1b1c1a] uppercase">{accountSafetyStatus}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span className="text-[#76777c]">DUPLICATE REJECTION:</span>
                  <span className="text-[#1b1c1a]">90s HASH-LOCK ACTIVE</span>
                </div>
              </div>

              {/* AI Model Selection & Token Failover Card */}
              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1b1c1a]">Global Active AI Model</h3>
                    <p className="font-serif text-xs text-[#46464b]">Controls both conversational assistant chat and WhatsApp auto-replies</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#166534] font-mono text-[10px] font-bold uppercase tracking-wider">
                    AUTO FAILOVER ON
                  </span>
                </div>

                <div className="space-y-2.5">
                  {AI_MODEL_OPTIONS.map((opt) => {
                    const isSelected = activeModel.provider_name === opt.provider && activeModel.model_name === opt.model;
                    return (
                      <div
                        key={opt.model}
                        onClick={() => handleSelectActiveModel(opt.provider, opt.model)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start justify-between ${
                          isSelected
                            ? 'bg-[#fbf9f6] border-[#ac3400] ring-1 ring-[#ac3400]'
                            : 'bg-white border-[#c6c6cb]/60 hover:border-[#1b1c1a]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm text-[#1b1c1a]">{opt.label}</span>
                            <span className="px-2 py-0.5 rounded-full bg-[#efeeeb] text-[#46464b] font-mono text-[9px] font-bold">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="font-serif text-xs text-[#76777c]">{opt.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'border-[#ac3400] bg-[#ac3400]' : 'border-[#c6c6cb]'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-[#f5f3f0] rounded-xl font-mono text-[11px] text-[#46464b] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#1b1c1a]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>AUTOMATIC TOKEN & RATE LIMIT FAILOVER:</span>
                  </div>
                  <p>
                    If your chosen model reaches its token limit or encounters a rate limit (HTTP 429), ChatPilot will automatically switch to the next healthy provider without dropping messages.
                  </p>
                </div>
              </div>

              {/* Notification Listener Auto-Heal & Reset Card */}
              <div className="bg-[#fff9f7] border border-[#ffb59d] rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#ffb59d]/40">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#ac3400]" />
                    <h3 className="font-serif font-bold text-base text-[#1b1c1a]">Notification Engine Health</h3>
                  </div>
                  {resetSuccess ? (
                    <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#166534] font-mono text-[10px] font-bold animate-pulse">
                      RECONNECTED & BOUND
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-[#efeeeb] text-[#46464b] font-mono text-[10px] font-bold">
                      HYPEROS AUTO-HEAL
                    </span>
                  )}
                </div>

                <p className="font-serif text-xs text-[#46464b]">
                  If Android battery management puts the background notification reader to sleep, tap below to instantly force-cycle and rebind the service. You never have to manually toggle permissions in Android settings again.
                </p>

                <button
                  type="button"
                  onClick={handleResetNotificationEngine}
                  disabled={resettingListener}
                  className="w-full py-2.5 bg-[#ac3400] hover:bg-[#8f2b00] text-white rounded-xl font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resettingListener ? 'animate-spin' : ''}`} />
                  <span>{resettingListener ? 'Rebinding Service...' : 'Auto-Heal & Reset Notification Engine'}</span>
                </button>
              </div>
            </>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <>
              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-[#c6c6cb]/40">
                  <div className="w-10 h-10 rounded-2xl bg-[#1b1c1a] text-white flex items-center justify-center font-serif text-base font-bold shadow-2xs">
                    TR
                  </div>
                  <div>
                    <h2 className="font-serif font-bold text-base text-[#1b1c1a]">{storedUser.name || 'Thoufikur Rahman'}</h2>
                    <span className="font-mono text-xs text-[#76777c]">{storedUser.email}</span>
                  </div>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">STATUS:</span>
                    <span className="font-bold text-[#1b1c1a]">VERIFIED OPERATOR</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#76777c]">AUTH PROVIDER:</span>
                    <span className="font-bold text-[#1b1c1a]">Supabase Auth</span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full mt-2 py-2.5 bg-[#efeeeb] hover:bg-[#ffdad6] hover:text-[#93000a] text-[#1b1c1a] rounded-xl font-mono text-xs font-bold uppercase transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of ChatPilot AI</span>
                </button>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
                <h3 className="font-serif font-bold text-base text-[#1b1c1a] flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#ac3400]" />
                  Change Password
                </h3>

                {pwMsg && (
                  <div className={`p-2.5 rounded-xl font-mono text-xs font-bold ${
                    pwMsg.error ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#DCFCE7] text-[#15803D]'
                  }`}>
                    {pwMsg.text}
                  </div>
                )}

                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-[#46464b] block mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-[#46464b] block mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-[#46464b] block mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#fbf9f6] border border-[#c6c6cb] rounded-xl font-mono text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full py-2.5 bg-[#1b1c1a] text-white rounded-xl font-mono text-xs font-bold uppercase active:scale-98 transition"
                >
                  {pwLoading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {/* Companion Tab */}
          {activeTab === 'companion' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-[#ac3400]" />
                    <h2 className="font-serif font-bold text-base text-[#1b1c1a]">Android Notification Diagnostics</h2>
                  </div>
                  <button
                    type="button"
                    onClick={refreshAndroidDiag}
                    className="px-2.5 py-1 rounded-full bg-[#f5f3f0] hover:bg-[#efeeeb] border border-[#c6c6cb] font-mono text-[10px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">NOTIFICATION ACCESS:</span>
                    <span className={`font-bold ${androidDiag?.notification_access_enabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {androidDiag ? (androidDiag.notification_access_enabled ? 'ON' : 'OFF') : 'N/A (Web)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">APP NOTIFICATIONS:</span>
                    <span className={`font-bold ${androidDiag?.post_notifications_enabled ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {androidDiag ? (androidDiag.post_notifications_enabled ? 'ON' : 'OFF') : 'N/A (Web)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">LISTENER SERVICE:</span>
                    <span className={`font-bold ${androidDiag?.listener_connected ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {androidDiag ? (androidDiag.listener_connected ? 'CONNECTED' : 'DISCONNECTED') : 'N/A (Web)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">GLOBAL AUTO-REPLY:</span>
                    <span className={`font-bold ${autoReply ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {autoReply ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">LAST WHATSAPP EVENT:</span>
                    <span className="font-bold text-[#1b1c1a]">
                      {androidDiag?.last_notification_time
                        ? `${new Date(androidDiag.last_notification_time).toLocaleTimeString()} (${androidDiag.last_sender_masked || '-'})`
                        : 'None yet'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">LAST BACKEND / HTTP:</span>
                    <span className="font-bold text-[#1b1c1a]">
                      {androidDiag?.last_backend_status ? `${androidDiag.last_backend_status} (${androidDiag.last_http_code || '-'})` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">LAST AI STATUS:</span>
                    <span className="font-bold text-[#1b1c1a]">{androidDiag?.last_ai_status || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#c6c6cb]/20">
                    <span className="text-[#76777c]">LAST REPLY ACTION:</span>
                    <span className="font-bold text-[#1b1c1a]">{androidDiag?.last_reply_action_status || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#76777c]">PENDING RETRY QUEUE:</span>
                    <span className="font-bold text-[#1b1c1a]">{androidDiag?.pending_retry_count ?? 0}</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (window as any).AndroidApp?.openNotificationAccessSettings?.()}
                    className="flex-1 py-2 px-3 bg-[#1b1c1a] text-white rounded-xl font-mono text-[10px] font-bold uppercase active:scale-95 transition"
                  >
                    Open Notification Access
                  </button>
                  <button
                    type="button"
                    onClick={() => (window as any).AndroidApp?.openAppNotificationSettings?.()}
                    className="flex-1 py-2 px-3 bg-[#f5f3f0] border border-[#c6c6cb] text-[#1b1c1a] rounded-xl font-mono text-[10px] font-bold uppercase active:scale-95 transition"
                  >
                    App Notification Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => (window as any).AndroidApp?.openBatteryOptimizationSettings?.()}
                    className="w-full py-2 px-3 bg-[#f5f3f0] border border-[#c6c6cb] text-[#1b1c1a] hover:bg-[#eae8e5] rounded-xl font-mono text-[10px] font-bold uppercase active:scale-95 transition"
                  >
                    Battery Saver: Set to "No restrictions"
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={runSafePipelineTest}
                    disabled={testingPipeline}
                    className="w-full py-2 px-3 bg-[#ac3400] hover:bg-[#832600] text-white rounded-xl font-mono text-[10px] font-bold uppercase active:scale-95 transition"
                  >
                    {testingPipeline ? 'Testing Cloud Pipeline...' : 'Run Safe Pipeline Test (No WhatsApp Send)'}
                  </button>
                  {safeTestResult && (
                    <p className="mt-2 p-2 rounded-lg bg-[#f5f3f0] border border-[#c6c6cb] font-mono text-[10px] text-[#1b1c1a]">
                      {safeTestResult}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-2">
                <h3 className="font-serif font-bold text-sm text-[#1b1c1a]">Redmi / HyperOS Background Checklist</h3>
                <ul className="font-sans text-xs text-[#46464b] space-y-1 list-disc pl-4">
                  <li><strong>Notification Access:</strong> Settings → Apps → Special app access → Notification access → Enable <em>ChatPilot AI Notification Service</em>.</li>
                  <li><strong>App Notifications:</strong> App Info → Notifications → Allow notifications (for Android 13+ permission).</li>
                  <li><strong>Autostart & Battery Saver:</strong> App Info → enable <em>Autostart</em> and set Battery Saver to <em>No restrictions</em> so HyperOS does not suspend the listener.</li>
                  <li><strong>WhatsApp Previews:</strong> Keep WhatsApp notifications unmuted and message previews visible.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Single Active Device Registry & Safety Stop */}
        <div className="lg:col-span-6 space-y-5">
          {/* Active Device Session Dossier */}
          <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#c6c6cb]/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#ac3400]" />
                <h3 className="font-serif font-bold text-base text-[#1b1c1a]">Single Active Device Session</h3>
              </div>
              <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#ffdbd0] text-[#ac3400]">
                ONE-DEVICE LOCK
              </span>
            </div>

            <p className="font-serif text-xs text-[#46464b] leading-relaxed">
              In accordance with subscription security directives, one user account may maintain only one active device session. Logging in from another device immediately prompts to sign out the existing session.
            </p>

            <div className="p-3.5 bg-[#f5f3f0] rounded-xl border border-[#c6c6cb]/60 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#76777c]">CURRENT ACTIVE DEVICE:</span>
                <span className="font-bold text-[#1b1c1a]">{activeDevice?.device_name || device.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777c]">PLATFORM:</span>
                <span className="font-bold uppercase text-[#1b1c1a]">{activeDevice?.device_type || device.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777c]">STATUS:</span>
                <span className="font-bold text-[#ac3400]">EXCLUSIVE ACTIVE SESSION</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777c]">LAST PING:</span>
                <span className="font-bold text-[#1b1c1a]">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Emergency Safety Stop */}
          <div className="bg-white border border-[#c6c6cb]/60 rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="font-serif font-bold text-base text-[#1b1c1a] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
              Failsafe Emergency Stop
            </h3>
            <p className="font-serif text-xs text-[#46464b]">
              Instantly halts all automated processing across both Windows and Android devices without altering your configured contact preferences.
            </p>
            <button
              onClick={handleEmergencyStop}
              className="w-full py-2.5 px-4 bg-[#ba1a1a] hover:bg-[#93000a] text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xl flex items-center justify-center gap-2 active:scale-98 transition shadow-xs"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Emergency Halt Automation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
