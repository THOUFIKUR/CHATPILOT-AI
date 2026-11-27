import React, { useEffect, useState } from 'react';
import { Bot, Radio } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(onComplete, 400);
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbf9f6] text-[#1b1c1a] transition-opacity duration-400 font-sans select-none ${
      fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {/* Brand Emblem */}
      <div className="relative flex flex-col items-center">
        <div className="w-16 h-16 rounded-3xl bg-[#1b1c1a] text-white flex items-center justify-center shadow-md mb-4 transform transition-transform animate-bounce duration-1000">
          <Bot className="w-8 h-8 text-[#ffb59d]" />
        </div>

        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#1b1c1a] leading-tight">
          ChatPilot AI
        </h1>
        <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] text-[#ac3400] font-bold tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-[#ac3400] animate-pulse"></span>
          <span>DISPATCH & OPERATOR TERMINAL</span>
        </div>
      </div>

      {/* Archival Edition Footer */}
      <div className="absolute bottom-10 font-mono text-[10px] text-[#76777c] font-bold uppercase tracking-wider">
        SYS.01 // SUPABASE AUTHENTICATED GATEWAY
      </div>
    </div>
  );
};
