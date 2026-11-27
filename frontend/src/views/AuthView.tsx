import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  Phone,
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Smartphone, 
  Monitor, 
  LogOut,
  Sparkles,
  Zap,
  Layers,
  LayoutGrid,
  KeyRound,
  Check,
  Menu
} from 'lucide-react';
import { api } from '../lib/api';
import { supabase, getDeviceIdentifier } from '../lib/supabase';

interface AuthViewProps {
  onAuthenticated: (user: any) => void;
  initialRevocationMessage?: string | null;
}

export const AuthView: React.FC<AuthViewProps> = ({ 
  onAuthenticated, 
  initialRevocationMessage 
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'link-sent' | 'create-new-password' | 'recovery-success'>('login');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  // New Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialRevocationMessage || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Device Conflict Dialog state
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    activeDevice: { device_name: string; device_type: string; last_active_at?: string };
    credentials: { email: string; password: string };
  } | null>(null);

  // OAuth Blocked / Setup Required Modal
  const [oauthBlockedModal, setOauthBlockedModal] = useState<{
    provider: string;
    errorMsg: string;
    callbackUrl: string;
  } | null>(null);

  const device = getDeviceIdentifier();

  // Cooldown timer for reset link resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Supabase Password Reset Link Recovery Listener
  useEffect(() => {
    // 1. Detect returning from Supabase password reset link (via URL hash)
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || (hash.includes('access_token=') && hash.includes('type=recovery')))) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const token = params.get('access_token');
      if (token) {
        setRecoveryToken(token);
        setMode('create-new-password');
      }
    }

    // 2. Listen for Supabase PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.access_token) {
          setRecoveryToken(session.access_token);
        }
        setMode('create-new-password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({
        email,
        password,
        device_name: device.name,
        device_type: device.type,
        device_identifier: device.id,
      });

      if (res.conflict) {
        setConflictModal({
          isOpen: true,
          activeDevice: res.active_device || { device_name: 'Other Device', device_type: 'desktop' },
          credentials: { email, password }
        });
        setLoading(false);
        return;
      }

      if (res.status === 'success') {
        localStorage.setItem('chatpilot_access_token', res.session?.access_token || '');
        localStorage.setItem('chatpilot_user', JSON.stringify(res.user));
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    if (!conflictModal) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.forceLogin({
        email: conflictModal.credentials.email,
        password: conflictModal.credentials.password,
        device_name: device.name,
        device_type: device.type,
        device_identifier: device.id,
      });

      if (res.status === 'success') {
        localStorage.setItem('chatpilot_access_token', res.session?.access_token || '');
        localStorage.setItem('chatpilot_user', JSON.stringify(res.user));
        setConflictModal(null);
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Force sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        email,
        password,
        full_name: fullName,
        phone,
        device_name: device.name,
        device_type: device.type,
        device_identifier: device.id,
      });

      if (res.status === 'success') {
        localStorage.setItem('chatpilot_access_token', res.session?.access_token || '');
        localStorage.setItem('chatpilot_user', JSON.stringify(res.user));
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Screen 1: Send Password Reset Link Email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = window.location.origin;
      await api.forgotPassword({ email, redirect_to: redirectUrl });
      setSuccessMsg(null);
      setResendCooldown(60);
      setMode('link-sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset link.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Reset Link
  const handleResendLink = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const redirectUrl = window.location.origin;
      await api.forgotPassword({ email, redirect_to: redirectUrl });
      setSuccessMsg(`New reset link sent to ${email}`);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend reset link.');
    } finally {
      setLoading(false);
    }
  };

  // Screen 3: Create New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({
        email,
        new_password: newPassword,
        access_token: recoveryToken && recoveryToken !== 'verified' ? recoveryToken : undefined,
      });

      if (res.status === 'success') {
        setSuccessMsg(null);
        setMode('recovery-success');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  // Social Login with Provider Blocked Check & Deep Linking
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setError(null);
    setSocialLoading(provider);

    // Platform-aware redirect URL
    let redirectUrl = window.location.origin;
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      // In Tauri Windows/Android desktop, use deep link or web origin
      redirectUrl = 'chatpilot://auth/callback';
    }

    try {
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false
        }
      });

      if (oauthErr) {
        throw oauthErr;
      }
    } catch (err: any) {
      const msg = err.message || '';
      logger_check: {
        // If provider not enabled in Supabase, show the setup instructions
        setOauthBlockedModal({
          provider: provider.charAt(0).toUpperCase() + provider.slice(1),
          errorMsg: msg.includes('not enabled') || msg.includes('validation_failed') || msg.includes('400')
            ? `${provider.toUpperCase()} provider is not enabled in your Supabase Auth project dashboard.`
            : msg,
          callbackUrl: 'https://bxtqwqarxddrnkshwezg.supabase.co/auth/v1/callback'
        });
      }
      setSocialLoading(null);
    }
  };

  // Reusable Form Content for both Desktop and Mobile
  const renderFormContent = (isMobile: boolean = false) => (
    <div className="w-full space-y-5">
      {/* Form Header */}
      <div>
        <h2 className={`font-serif ${isMobile ? 'text-2xl sm:text-3xl' : 'text-3xl md:text-4xl'} font-bold tracking-tight text-[#1b1c1a]`}>
          {mode === 'login' ? 'Welcome back' 
            : mode === 'register' ? 'Create Account' 
            : mode === 'forgot' ? 'Forgot your password?' 
            : mode === 'link-sent' ? 'Reset Link Sent' 
            : mode === 'create-new-password' ? 'Create New Password' 
            : 'Password Updated'}
        </h2>
        <p className="text-xs md:text-sm text-[#76777c] mt-1 font-sans">
          {mode === 'login' ? 'Your personal AI companion is ready.' 
            : mode === 'register' ? 'Join ChatPilot AI to automate and assist.' 
            : mode === 'forgot' ? 'Enter your registered email address to receive a password reset link.' 
            : mode === 'link-sent' ? `We sent a reset link to ${email || 'your email'}. Tap the link to change your password.` 
            : mode === 'create-new-password' ? 'Set a strong new password for your account.' 
            : 'Your credentials have been securely updated.'}
        </p>
      </div>

      {/* Error or Success Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form Body */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Address */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-11 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-[#8a8b90] hover:text-[#1b1c1a] transition p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="hidden"
              />
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                rememberMe ? 'bg-[#c84b1a] border-[#c84b1a] text-white' : 'border-[#c6c6cb] bg-white'
              }`}>
                {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="text-[#46464b] font-medium">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null); }}
              className="text-[#c84b1a] hover:underline font-semibold"
            >
              Forgot password?
            </button>
          </div>

          {/* Sign In Primary Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c84b1a] to-[#a3370b] hover:from-[#b94415] hover:to-[#923008] active:scale-[0.99] text-white font-serif text-base font-bold tracking-wide shadow-md shadow-[#c84b1a]/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
            />
          </div>

          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
            />
          </div>

          <div className="relative flex items-center">
            <Phone className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp phone number"
              className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
            />
          </div>

          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
            />
          </div>

          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c84b1a] to-[#a3370b] hover:from-[#b94415] hover:to-[#923008] text-white font-serif text-base font-bold tracking-wide shadow-md shadow-[#c84b1a]/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* SCREEN 1: FORGOT PASSWORD (EMAIL RESET LINK) */}
      {mode === 'forgot' && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered email address"
                className="w-full pl-10 pr-4 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c84b1a] to-[#a3370b] hover:from-[#b94415] hover:to-[#923008] text-white font-serif text-base font-bold tracking-wide shadow-md shadow-[#c84b1a]/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Sending link...' : 'Send Reset Link'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className="w-full text-center text-xs text-[#76777c] hover:text-[#1b1c1a] transition"
          >
            ← Back to Sign In
          </button>
        </form>
      )}

      {/* SCREEN 2: RESET LINK SENT CONFIRMATION */}
      {mode === 'link-sent' && (
        <div className="space-y-5 text-center py-2 animate-in fade-in">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-[#fff2ed] border border-[#fbd4c6] flex items-center justify-center shadow-xs">
            <Mail className="w-7 h-7 text-[#c84b1a]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1b1c1a]">
              Check your email inbox
            </h3>
            <p className="text-xs text-[#5e5f63] leading-relaxed max-w-sm mx-auto">
              We sent a password reset link to <strong className="text-[#1b1c1a] font-mono">{email}</strong>.
              Touch the link in your email to choose your new password.
            </p>
          </div>

          <div className="p-3 bg-[#fbf9f6] border border-[#ede5dc] rounded-2xl flex items-center justify-between text-xs text-[#5e5f63]">
            <span>Didn't receive the email?</span>
            {resendCooldown > 0 ? (
              <span className="font-mono text-[#c84b1a] font-bold">Resend in {resendCooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResendLink}
                disabled={loading}
                className="text-[#c84b1a] hover:underline font-bold"
              >
                Resend link
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className="w-full text-center text-xs text-[#76777c] hover:text-[#1b1c1a] transition pt-1"
          >
            ← Back to Sign In
          </button>
        </div>
      )}

      {/* SCREEN 3: CREATE NEW PASSWORD */}
      {mode === 'create-new-password' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="w-full pl-10 pr-11 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-[#8a8b90] hover:text-[#1b1c1a] transition p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#8a8b90] absolute left-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full pl-10 pr-11 py-3 bg-[#fbf9f6] border border-[#e3dad1] rounded-xl text-sm text-[#1b1c1a] placeholder:text-[#9c9da2] focus:outline-none focus:border-[#c84b1a] focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#c84b1a] to-[#a3370b] hover:from-[#b94415] hover:to-[#923008] text-white font-serif text-base font-bold tracking-wide shadow-md shadow-[#c84b1a]/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Updating password...' : 'Update Password'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* SCREEN 4: SUCCESS */}
      {mode === 'recovery-success' && (
        <div className="space-y-5 text-center py-3">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-md shadow-emerald-500/10 animate-in zoom-in-95">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1b1c1a]">
              Password updated successfully
            </h3>
            <p className="text-xs text-[#76777c] mt-1.5 max-w-xs mx-auto">
              Your password has been changed securely. You can now sign in with your new credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMsg('Please sign in with your new password.');
            }}
            className="w-full py-3.5 rounded-xl bg-[#1b1c1a] hover:bg-[#2c2d2a] text-white font-serif text-base font-bold tracking-wide shadow-md transition"
          >
            Return to Login
          </button>
        </div>
      )}

      {/* Social Logins (Google & GitHub only) */}
      {(mode === 'login' || mode === 'register') && (
        <div className="space-y-4 pt-1">
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#ede5dc] w-full" />
            <span className="bg-white px-3 text-[10px] sm:text-[11px] font-sans text-[#8a8b90] uppercase tracking-wider relative whitespace-nowrap">
              or continue with
            </span>
          </div>

          {isMobile ? (
            /* Mobile 2-column Pill Buttons (Exact Match to Mobile Reference) */
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={Boolean(socialLoading)}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#faf7f4] border border-[#e3dad1] rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-[#1b1c1a] shadow-2xs transition active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                disabled={Boolean(socialLoading)}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#faf7f4] border border-[#e3dad1] rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-[#1b1c1a] shadow-2xs transition active:scale-[0.98]"
              >
                <svg className="w-4 h-4 fill-current text-[#1b1c1a] shrink-0" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </button>
            </div>
          ) : (
            /* Desktop Full-width Rows */
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={Boolean(socialLoading)}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#faf7f4] border border-[#e3dad1] rounded-xl flex items-center justify-center gap-3 text-xs font-semibold text-[#1b1c1a] shadow-2xs transition active:scale-[0.99]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('github')}
                disabled={Boolean(socialLoading)}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#faf7f4] border border-[#e3dad1] rounded-xl flex items-center justify-center gap-3 text-xs font-semibold text-[#1b1c1a] shadow-2xs transition active:scale-[0.99]"
              >
                <svg className="w-4 h-4 fill-current text-[#1b1c1a] shrink-0" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <span>Continue with GitHub</span>
              </button>
            </div>
          )}

          {/* Footer Switcher */}
          <div className="pt-2 text-center text-xs text-[#76777c]">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null); }}
                  className="text-[#c84b1a] font-bold hover:underline"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-[#c84b1a] font-bold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#fbf7f2] flex flex-col items-center justify-center p-3 sm:p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-[#ac3400] selection:text-white">
      {/* Background Soft Organic Waves (matching image palette) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -bottom-24 -left-20 w-[600px] h-[350px] bg-gradient-to-tr from-[#f3d9c3] via-[#f9e9dc] to-transparent rounded-[100%] opacity-70 blur-xl" />
        <div className="absolute -top-32 -right-20 w-[550px] h-[350px] bg-gradient-to-bl from-[#f7e3d2] via-[#faefe5] to-transparent rounded-[100%] opacity-60 blur-xl" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#f6decb]/40 to-transparent" />
      </div>

      {/* ========================================================================= */}
      {/* 1. MOBILE LAYOUT (lg:hidden) - EXACT MATCH TO REFERENCE IMAGE              */}
      {/* ========================================================================= */}
      <div className="w-full max-w-md mx-auto space-y-4 relative z-10 lg:hidden pt-7 pb-4">
        
        {/* Mobile Header: Logo on left, Hamburger Menu on right */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1b1c1a] text-[#f8a88b] flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-[#f8a88b]" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-tight text-[#1b1c1a] leading-tight">
                ChatPilot AI
              </h1>
              <p className="text-[10px] text-[#76777c] font-sans">
                Personal AI Companion
              </p>
            </div>
          </div>

          <button 
            type="button"
            className="p-2 text-[#1b1c1a] hover:bg-[#ede5dc]/60 rounded-xl transition"
            aria-label="Navigation Menu"
          >
            <Menu className="w-6 h-6 stroke-[2]" />
          </button>
        </div>

        {/* Mobile Hero Split: Left text, Right cute 3D mascot on peach circular glow */}
        <div className="relative pt-2 pb-1 px-1">
          <div className="grid grid-cols-12 gap-2 items-center">
            
            {/* Left Headline & Subtitle */}
            <div className="col-span-7 pr-1">
              <h2 className="font-serif text-[22px] sm:text-2xl font-bold text-[#1b1c1a] tracking-tight leading-[1.2]">
                Your AI Assistant for <span className="text-[#c84b1a]">WhatsApp</span> and More
              </h2>
              <p className="text-[11px] text-[#5e5f63] leading-relaxed mt-2 font-sans">
                Automate replies, manage contacts, and get intelligent assistance — all in one place.
              </p>
            </div>

            {/* Right Cute 3D Orange Mascot in Peach Circle with 3 floating pills */}
            <div className="col-span-5 flex items-center justify-center relative">
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Soft Peach circular halo */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#f8dcd0] via-[#faeae0] to-[#fff3ed] shadow-inner" />
                
                {/* 3D Cute Robot */}
                <div className="relative z-10 flex flex-col items-center">
                  {/* Speech bubble */}
                  <div className="mb-0.5 ml-8 bg-white border border-[#ebd6c7] px-2 py-0.5 rounded-xl shadow-xs flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#c84b1a]"></span>
                    <span className="w-1 h-1 rounded-full bg-[#c84b1a]"></span>
                    <span className="w-1 h-1 rounded-full bg-[#c84b1a]"></span>
                  </div>

                  {/* Robot Head */}
                  <div className="relative">
                    {/* Antennas */}
                    <div className="absolute -top-3 left-2 w-1 h-4 bg-[#d7784f] rounded-full transform -rotate-12 flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-[#f1956c] -mt-0.5 shadow-xs" />
                    </div>
                    <div className="absolute -top-3 right-2 w-1 h-4 bg-[#d7784f] rounded-full transform rotate-12 flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-[#f1956c] -mt-0.5 shadow-xs" />
                    </div>

                    {/* Head */}
                    <div className="w-20 h-16 bg-gradient-to-b from-[#f29f79] via-[#e57f52] to-[#c85e33] rounded-2xl shadow-lg border-2 border-white/70 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0.5 left-2 right-2 h-3 bg-white/30 rounded-full blur-[0.5px]" />
                      <div className="flex gap-4 items-center">
                        <div className="w-2 h-4 bg-[#1b1c1a] rounded-full" />
                        <div className="w-2 h-4 bg-[#1b1c1a] rounded-full" />
                      </div>
                    </div>

                    {/* Blush */}
                    <div className="absolute bottom-2.5 left-1.5 w-2.5 h-1 rounded-full bg-[#ff7474]/50" />
                    <div className="absolute bottom-2.5 right-1.5 w-2.5 h-1 rounded-full bg-[#ff7474]/50" />
                  </div>
                </div>

                {/* Floating App Badge: WhatsApp (Green, top left) */}
                <div className="absolute -top-0.5 -left-1.5 w-7 h-7 rounded-xl bg-white shadow-md border border-[#c6e9cf] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.78 14.07c-.24.68-1.4 1.34-1.95 1.42-.51.08-1.18.12-3.41-.8-2.85-1.18-4.67-4.08-4.81-4.27-.14-.19-1.16-1.55-1.16-2.95 0-1.41.73-2.1 1-2.39.24-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4.06.62.59.24.57.81 1.98.88 2.12.07.14.12.31.02.49-.09.19-.14.31-.29.47-.14.17-.3.37-.43.5-.14.14-.29.3-.12.59.17.29.74 1.22 1.6 1.98 1.1 0.98 2.03 1.28 2.32 1.43.29.14.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.14.26.1 1.66.78 1.95.93.29.14.48.22.55.33.07.12.07.7-.17 1.38z"/>
                  </svg>
                </div>

                {/* Floating App Badge: Gmail (Envelope, top right) */}
                <div className="absolute -top-0.5 -right-1.5 w-7 h-7 rounded-xl bg-white shadow-md border border-[#fbd4c6] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#c84b1a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>

                {/* Floating App Badge: Google Drive (Triangle, bottom right) */}
                <div className="absolute -bottom-1 -right-0.5 w-7 h-7 rounded-xl bg-white shadow-md border border-[#d2e3fc] flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M8.2 2.5L2.3 12.8l4.4 7.7 5.9-10.3z"/>
                    <path fill="#0F9D58" d="M15.8 2.5H8.2l5.9 10.3h7.6z"/>
                    <path fill="#FFBA00" d="M21.7 12.8H14.1L8.2 23h7.6z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile 3 Feature Badges Row */}
        <div className="grid grid-cols-3 gap-2 px-1">
          <div className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-white/80 border border-[#ede5dc] shadow-2xs">
            <Zap className="w-4 h-4 text-[#c84b1a] mb-1" />
            <span className="font-serif text-[11px] font-bold text-[#1b1c1a]">Auto Reply</span>
          </div>
          <div className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-white/80 border border-[#ede5dc] shadow-2xs">
            <Layers className="w-4 h-4 text-[#c84b1a] mb-1" />
            <span className="font-serif text-[11px] font-bold text-[#1b1c1a]">Multi-Model AI</span>
          </div>
          <div className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-white/80 border border-[#ede5dc] shadow-2xs">
            <LayoutGrid className="w-4 h-4 text-[#c84b1a] mb-1" />
            <span className="font-serif text-[11px] font-bold text-[#1b1c1a]">App Integrations</span>
          </div>
        </div>

        {/* Mobile Form White Card Container */}
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-[#ede5dc]/80">
          {renderFormContent(true)}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP LAYOUT (hidden lg:grid) - 2-COLUMN SPLIT APPROVED SYSTEM       */}
      {/* ========================================================================= */}
      <div className="w-full max-w-5xl bg-[#fdfaf6]/90 backdrop-blur-md border border-[#ede5dc] rounded-[2.5rem] shadow-xl overflow-hidden relative z-10 hidden lg:grid grid-cols-12 min-h-[640px]">
        
        {/* Left Hero Panel */}
        <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between relative border-r border-[#ede5dc]/60">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1b1c1a] text-[#f8a88b] flex items-center justify-center shadow-md shadow-[#1b1c1a]/10">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="14" x="3" y="6" rx="3"/>
                <path d="M12 2v4"/>
                <circle cx="8.5" cy="12.5" r="1.5" fill="currentColor"/>
                <circle cx="15.5" cy="12.5" r="1.5" fill="currentColor"/>
                <path d="M9 16h6"/>
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight text-[#1b1c1a] leading-tight">
                ChatPilot AI
              </h1>
              <p className="text-[11px] text-[#76777c] font-sans">
                Personal AI Companion
              </p>
            </div>
          </div>

          {/* Center 3D Cute Robot Character with Floating Icons */}
          <div className="my-8 flex flex-col items-center justify-center relative">
            <div className="relative w-64 h-56 flex items-center justify-center">
              <div className="absolute bottom-2 w-52 h-14 rounded-[100%] border border-[#e8cbb6] opacity-60" />
              <div className="absolute bottom-0 w-64 h-18 rounded-[100%] border border-[#eed7c7] opacity-40" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="mb-1 ml-14 bg-white border border-[#ebd6c7] px-3 py-1 rounded-2xl shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c84b1a]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c84b1a]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c84b1a]"></span>
                </div>

                <div className="relative">
                  <div className="absolute -top-4 left-3 w-1.5 h-5 bg-[#d7784f] rounded-full transform -rotate-12 flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f1956c] -mt-1 shadow-xs" />
                  </div>
                  <div className="absolute -top-4 right-3 w-1.5 h-5 bg-[#d7784f] rounded-full transform rotate-12 flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f1956c] -mt-1 shadow-xs" />
                  </div>

                  <div className="w-28 h-24 bg-gradient-to-b from-[#f29f79] via-[#e57f52] to-[#c85e33] rounded-[2rem] shadow-xl border-2 border-white/60 flex items-center justify-center p-3 relative overflow-hidden">
                    <div className="absolute top-1 left-3 right-3 h-5 bg-white/30 rounded-full blur-[1px]" />
                    <div className="flex gap-6 items-center">
                      <div className="w-2.5 h-5 bg-[#1b1c1a] rounded-full" />
                      <div className="w-2.5 h-5 bg-[#1b1c1a] rounded-full" />
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-2 w-3 h-1.5 rounded-full bg-[#ff7474]/50 blur-[0.5px]" />
                  <div className="absolute bottom-4 right-2 w-3 h-1.5 rounded-full bg-[#ff7474]/50 blur-[0.5px]" />
                </div>
              </div>

              {/* Floating App Badge: WhatsApp */}
              <div className="absolute left-2 top-14 w-9 h-9 rounded-2xl bg-white shadow-md border border-[#c6e9cf] flex items-center justify-center animate-bounce duration-1000">
                <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.78 14.07c-.24.68-1.4 1.34-1.95 1.42-.51.08-1.18.12-3.41-.8-2.85-1.18-4.67-4.08-4.81-4.27-.14-.19-1.16-1.55-1.16-2.95 0-1.41.73-2.1 1-2.39.24-.26.54-.33.72-.33.18 0 .36 0 .52.01.17.01.4.06.62.59.24.57.81 1.98.88 2.12.07.14.12.31.02.49-.09.19-.14.31-.29.47-.14.17-.3.37-.43.5-.14.14-.29.3-.12.59.17.29.74 1.22 1.6 1.98 1.1 0.98 2.03 1.28 2.32 1.43.29.14.46.12.63-.07.17-.19.73-.85.92-1.14.19-.29.39-.24.65-.14.26.1 1.66.78 1.95.93.29.14.48.22.55.33.07.12.07.7-.17 1.38z"/>
                </svg>
              </div>

              {/* Floating App Badge: Gmail */}
              <div className="absolute right-3 top-10 w-9 h-9 rounded-2xl bg-white shadow-md border border-[#fbd4c6] flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 text-[#c84b1a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>

              {/* Floating App Badge: Google Drive */}
              <div className="absolute right-5 bottom-8 w-9 h-9 rounded-2xl bg-white shadow-md border border-[#d2e3fc] flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M8.2 2.5L2.3 12.8l4.4 7.7 5.9-10.3z"/>
                  <path fill="#0F9D58" d="M15.8 2.5H8.2l5.9 10.3h7.6z"/>
                  <path fill="#FFBA00" d="M21.7 12.8H14.1L8.2 23h7.6z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="space-y-3">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#1b1c1a] tracking-tight leading-[1.2]">
              Your AI assistant <br />
              for <span className="text-[#c84b1a]">WhatsApp</span> and more
            </h2>
            <p className="text-sm text-[#5e5f63] leading-relaxed max-w-md">
              Automate replies, manage contacts, and get intelligent assistance — all in one place.
            </p>
          </div>

          {/* Feature Badges Footer */}
          <div className="pt-6 grid grid-cols-3 gap-2 border-t border-[#ede5dc]/60">
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 border border-[#ede5dc]/60 shadow-2xs">
              <Zap className="w-4 h-4 text-[#c84b1a] mb-1" />
              <span className="font-serif text-xs font-bold text-[#1b1c1a]">Auto Reply</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 border border-[#ede5dc]/60 shadow-2xs">
              <Layers className="w-4 h-4 text-[#c84b1a] mb-1" />
              <span className="font-serif text-xs font-bold text-[#1b1c1a]">Multi-Model AI</span>
            </div>
            <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 border border-[#ede5dc]/60 shadow-2xs">
              <LayoutGrid className="w-4 h-4 text-[#c84b1a] mb-1" />
              <span className="font-serif text-xs font-bold text-[#1b1c1a]">App Integrations</span>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="lg:col-span-6 p-6 sm:p-10 md:p-12 flex flex-col justify-center bg-white/95">
          <div className="max-w-md w-full mx-auto">
            {renderFormContent(false)}
          </div>
        </div>
      </div>

      {/* ==================== OAUTH BLOCKED / CONFIGURATION REQUIRED MODAL ==================== */}
      {oauthBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#c6c6cb] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#ede5dc]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1b1c1a]">
                    {oauthBlockedModal.provider} Login Blocked
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                    BLOCKED — SETUP REQUIRED
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOauthBlockedModal(null)}
                className="text-[#76777c] hover:text-[#1b1c1a] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#46464b] leading-relaxed">
              Real OAuth requires registered client credentials. Supabase reported:
            </p>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl font-mono text-xs text-rose-800">
              {oauthBlockedModal.errorMsg}
            </div>

            <div className="space-y-3 pt-1 text-xs text-[#46464b]">
              <div className="font-semibold text-[#1b1c1a]">Required Provider Setup Steps:</div>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-[#5e5f63]">
                <li>Open your <strong>Supabase Dashboard</strong> ➔ <em>Authentication</em> ➔ <em>Providers</em>.</li>
                <li>Find <strong>{oauthBlockedModal.provider}</strong> and toggle it <strong>ON</strong>.</li>
                <li>Enter your Client ID and Client Secret from your {oauthBlockedModal.provider} Developer Console.</li>
                <li>Set the authorized OAuth Redirect URI to the address below:</li>
              </ol>

              <div className="p-3 bg-[#fbf9f6] border border-[#ede5dc] rounded-xl flex items-center justify-between gap-2 font-mono text-[11px] text-[#1b1c1a]">
                <span className="truncate">{oauthBlockedModal.callbackUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(oauthBlockedModal.callbackUrl);
                    setSuccessMsg('Callback URL copied to clipboard!');
                    setTimeout(() => setSuccessMsg(null), 3000);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-[#ede5dc] border border-[#c6c6cb] rounded-lg text-xs font-sans font-semibold transition shrink-0"
                >
                  Copy URL
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setOauthBlockedModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#1b1c1a] hover:bg-[#2c2d2a] text-white text-xs font-serif font-bold transition"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
      {conflictModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#c6c6cb] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1b1c1a]">Active Session Detected</h3>
                <p className="text-xs text-[#76777c] font-sans">Single-device policy enforcement</p>
              </div>
            </div>

            <p className="text-xs text-[#46464b] leading-relaxed">
              Your account is currently active on <strong className="text-[#1b1c1a]">{conflictModal.activeDevice.device_name}</strong> ({conflictModal.activeDevice.device_type}).
              To protect your private WhatsApp messages, ChatPilot only allows one active device at a time.
            </p>

            <div className="p-3 bg-[#fbf9f6] rounded-xl border border-[#ede5dc] text-xs text-[#76777c] space-y-1 font-mono">
              <div>DEVICE: {conflictModal.activeDevice.device_name}</div>
              <div>TYPE: {conflictModal.activeDevice.device_type.toUpperCase()}</div>
              <div>STATUS: ACTIVE SESSION</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#c6c6cb] text-xs font-semibold text-[#46464b] hover:bg-[#f5f3f0] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceLogin}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#c84b1a] hover:bg-[#a3370b] text-white text-xs font-serif font-bold shadow-md transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign In Here (Switch)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
