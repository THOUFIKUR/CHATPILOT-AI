import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  Bot, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { SecretIndicator } from '../components/SecretIndicator';

interface MobileWelcomeViewProps {
  onOpenBrowserLogin: () => void;
  onDirectLoginFallback: () => void;
  isWaitingForCallback?: boolean;
}

export const MobileWelcomeView: React.FC<MobileWelcomeViewProps> = ({
  onOpenBrowserLogin,
  onDirectLoginFallback,
  isWaitingForCallback = false,
}) => {
  const [opening, setOpening] = useState(false);

  const handleLoginClick = () => {
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

      {/* Center Hero & Branding */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-auto z-10 py-8">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#1b1c1a] via-[#2c2320] to-[#ac3400] text-white flex items-center justify-center shadow-xl shadow-[#ac3400]/15 ring-1 ring-white/40">
            <Sparkles className="w-9 h-9 text-[#ffd5c8] animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#fbf9f6] flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Title & Tagline */}
        <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[#1b1c1a] mb-2 leading-tight">
          Welcome to <br />
          <span className="text-[#ac3400]">ChatPilot AI</span>
        </h1>
        <p className="font-serif text-sm text-[#46464b] leading-relaxed mb-6 px-2">
          Your personal executive AI companion. Secure cognitive memory, multi-provider intelligence, and real-time WhatsApp co-piloting.
        </p>

        {/* Highlight Badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 font-mono text-[11px] text-[#46464b]">
          <span className="px-3 py-1 rounded-full bg-white border border-[#c6c6cb]/60 shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-[#ac3400]" />
            Private Vault
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#c6c6cb]/60 shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-[#ac3400]" />
            OAuth 2.0 PKCE
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#c6c6cb]/60 shadow-2xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-[#ac3400]" />
            Multi-Device Sync
          </span>
        </div>

        {/* Primary Action Button (ChatGPT / Claude Style) */}
        <div className="w-full space-y-3">
          <button
            onClick={handleLoginClick}
            disabled={opening}
            className="w-full py-4 px-6 rounded-2xl bg-[#1b1c1a] hover:bg-[#2c2d2a] active:scale-[0.98] text-white font-serif text-base font-bold shadow-lg shadow-black/10 flex items-center justify-center gap-2.5 transition-all duration-200 group"
          >
            {opening ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin text-[#ffd5c8]" />
                <span>Launching Browser...</span>
              </>
            ) : isWaitingForCallback ? (
              <>
                <ExternalLink className="w-5 h-5 text-[#ffd5c8]" />
                <span>Re-open Browser Login</span>
              </>
            ) : (
              <>
                <span>Continue to Sign In</span>
                <ArrowRight className="w-4 h-4 text-[#ffd5c8] group-hover:translate-x-1 transition-transform" />
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
                Complete sign-in in your browser and you will automatically return here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer & Security Message */}
      <div className="text-center z-10 space-y-3 pb-2 max-w-xs mx-auto">
        <p className="font-mono text-[10px] text-[#76777c] flex items-center justify-center gap-1.5 leading-normal">
          <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Authenticated securely via external browser with Supabase Auth & Google/GitHub.</span>
        </p>

        {/* Small fallback link for testing or offline recovery */}
        <button
          onClick={onDirectLoginFallback}
          className="font-mono text-[10px] text-[#76777c] hover:text-[#1b1c1a] underline transition tracking-tight"
        >
          Sign in with email and password directly on this device
        </button>
      </div>
    </div>
  );
};
