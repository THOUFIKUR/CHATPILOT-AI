import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  Bot, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  RefreshCw,
  Mail,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { SecretIndicator } from '../components/SecretIndicator';
import { api } from '../lib/api';
import { supabase, getDeviceIdentifier } from '../lib/supabase';

interface MobileWelcomeViewProps {
  onOpenBrowserLogin: () => void;
  onAuthenticated: (user: any) => void;
  isWaitingForCallback?: boolean;
}

export const MobileWelcomeView: React.FC<MobileWelcomeViewProps> = ({
  onOpenBrowserLogin,
  onAuthenticated,
  isWaitingForCallback = false,
}) => {
  const [opening, setOpening] = useState(false);
  const [showInAppLogin, setShowInAppLogin] = useState(false);

  // In-app direct login state
  const [email, setEmail] = useState('thoufikurrahaman@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const device = getDeviceIdentifier();

  const handleInAppLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login({
        email,
        password,
        device_name: device.name,
        device_type: device.type,
        device_identifier: device.id,
      });

      if (res.conflict) {
        // Auto force-switch device
        const forceRes = await api.forceLogin({
          email,
          password,
          device_name: device.name,
          device_type: device.type,
          device_identifier: device.id,
        });
        if (forceRes.status === 'success') {
          localStorage.setItem('chatpilot_access_token', forceRes.session?.access_token || '');
          localStorage.setItem('chatpilot_user', JSON.stringify(forceRes.user));
          onAuthenticated(forceRes.user);
          return;
        }
      }

      if (res.status === 'success') {
        localStorage.setItem('chatpilot_access_token', res.session?.access_token || '');
        localStorage.setItem('chatpilot_user', JSON.stringify(res.user));
        onAuthenticated(res.user);
        return;
      }
    } catch (err: any) {
      console.warn('[MobileWelcomeView] api.login failed, trying direct Supabase fallback:', err.message);
      try {
        const { data: supaData, error: supaErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (supaErr) throw supaErr;
        if (supaData?.user && supaData?.session) {
          const directUser = {
            id: supaData.user.id,
            email: supaData.user.email,
            name:
              supaData.user.user_metadata?.full_name ||
              supaData.user.user_metadata?.name ||
              supaData.user.email?.split('@')[0] ||
              'Thoufikur',
          };
          localStorage.setItem('chatpilot_access_token', supaData.session.access_token);
          if (supaData.session.refresh_token) {
            localStorage.setItem('chatpilot_refresh_token', supaData.session.refresh_token);
          }
          localStorage.setItem('chatpilot_user', JSON.stringify(directUser));
          onAuthenticated(directUser);
          return;
        }
      } catch (directErr: any) {
        setError(directErr.message || err.message || 'Login failed. Please check your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserClick = () => {
    setOpening(true);
    onOpenBrowserLogin();
    setTimeout(() => setOpening(false), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-[#fbf9f6] text-[#1b1c1a] flex flex-col justify-between p-6 relative overflow-hidden select-none">
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#ac3400]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[#1b1c1a]/5 blur-3xl pointer-events-none" />

      {/* Top Bar with Discreet Health Dots */}
      <div className="flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#1b1c1a] text-white flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-[#ffb59d]" />
          </div>
          <span className="font-serif font-bold text-sm tracking-tight text-[#1b1c1a]">
            ChatPilot AI
          </span>
        </div>
        <SecretIndicator compact />
      </div>

      {/* Center Hero & Branding or In-App Form */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-auto z-10 py-6 w-full">
        {/* Animated Brand Emblem */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#1b1c1a] via-[#2c2320] to-[#ac3400] text-white flex items-center justify-center shadow-xl shadow-[#ac3400]/15 ring-1 ring-white/40">
            <Sparkles className="w-8 h-8 text-[#ffd5c8] animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#fbf9f6] flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#1b1c1a] mb-1 leading-tight">
          Welcome to <span className="text-[#ac3400]">ChatPilot AI</span>
        </h1>
        <p className="font-serif text-xs text-[#46464b] leading-relaxed mb-6 px-2">
          Personal AI Companion for WhatsApp & Autonomous Intelligence.
        </p>

        {showInAppLogin ? (
          /* Direct In-App Login Form */
          <form onSubmit={handleInAppLogin} className="w-full space-y-3 text-left animate-in fade-in duration-200">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 text-center font-sans">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-mono text-[10px] text-[#76777c] uppercase font-bold tracking-wider">
                Account Email
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#76777c] absolute left-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="thoufikurrahaman@gmail.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#c6c6cb] rounded-xl text-xs text-[#1b1c1a] focus:outline-none focus:border-[#ac3400]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] text-[#76777c] uppercase font-bold tracking-wider">
                Master Password
              </label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-[#76777c] absolute left-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#c6c6cb] rounded-xl text-xs text-[#1b1c1a] focus:outline-none focus:border-[#ac3400]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#76777c] hover:text-[#1b1c1a]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#ac3400] hover:bg-[#8f2b00] active:scale-[0.98] text-white font-serif text-sm font-bold shadow-md flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowInAppLogin(false)}
              className="w-full py-2 text-center font-mono text-[11px] text-[#76777c] hover:text-[#1b1c1a]"
            >
              ← Back to Overview
            </button>
          </form>
        ) : (
          /* Primary Welcome Options */
          <div className="w-full space-y-3">
            {/* Direct In-App Sign In (No external URLs needed!) */}
            <button
              onClick={() => setShowInAppLogin(true)}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#1b1c1a] hover:bg-[#2c2d2a] active:scale-[0.98] text-white font-serif text-sm font-bold shadow-md flex items-center justify-center gap-2 transition group"
            >
              <span>Sign In with Email & Password</span>
              <ArrowRight className="w-4 h-4 text-[#ffd5c8] group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Browser Authentication Option */}
            <button
              onClick={handleBrowserClick}
              disabled={opening}
              className="w-full py-3 px-5 rounded-2xl bg-white border border-[#c6c6cb] hover:bg-[#f5f3f0] active:scale-[0.98] text-[#1b1c1a] font-serif text-xs font-semibold shadow-2xs flex items-center justify-center gap-2 transition"
            >
              {opening ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#ac3400]" />
                  <span>Opening System Browser...</span>
                </>
              ) : isWaitingForCallback ? (
                <>
                  <ExternalLink className="w-4 h-4 text-[#ac3400]" />
                  <span>Re-open Browser Sign-In</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 text-[#ac3400]" />
                  <span>Continue with Browser (Google / GitHub)</span>
                </>
              )}
            </button>

            {isWaitingForCallback && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-mono animate-in fade-in duration-300">
                <p className="flex items-center justify-center gap-1.5 font-bold mb-0.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  Awaiting browser authentication...
                </p>
                <p className="text-[10px] text-amber-700/90">
                  Complete sign-in in Chrome and you will automatically return here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer & Security Message */}
      <div className="text-center z-10 space-y-2 pb-1 max-w-xs mx-auto">
        <p className="font-mono text-[10px] text-[#76777c] flex items-center justify-center gap-1.5 leading-normal">
          <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Connected to Supabase Cloud & Render Backend.</span>
        </p>
      </div>
    </div>
  );
};
