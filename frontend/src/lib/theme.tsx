import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'emerald' | 'teal' | 'indigo' | 'blue' | 'amber' | 'slate';

interface AccentConfig {
  name: string;
  primary: string;
  hover: string;
  subtleLight: string;
  subtleDark: string;
  ring: string;
}

export const ACCENTS: Record<AccentColor, AccentConfig> = {
  emerald: {
    name: 'Emerald Green',
    primary: '#16A34A',
    hover: '#15803D',
    subtleLight: '#F0FDF4',
    subtleDark: 'rgba(22, 163, 74, 0.15)',
    ring: '#86EFAC',
  },
  teal: {
    name: 'Teal',
    primary: '#0D9488',
    hover: '#0F766E',
    subtleLight: '#F0FDFA',
    subtleDark: 'rgba(13, 148, 136, 0.15)',
    ring: '#5EEAD4',
  },
  indigo: {
    name: 'Violet Indigo',
    primary: '#6366F1',
    hover: '#4F46E5',
    subtleLight: '#EEF2FF',
    subtleDark: 'rgba(99, 102, 241, 0.15)',
    ring: '#A5B4FC',
  },
  blue: {
    name: 'Sapphire Blue',
    primary: '#0284C7',
    hover: '#0369A1',
    subtleLight: '#F0F9FF',
    subtleDark: 'rgba(2, 132, 199, 0.15)',
    ring: '#7DD3FC',
  },
  amber: {
    name: 'Warm Amber',
    primary: '#D97706',
    hover: '#B45309',
    subtleLight: '#FFFBEB',
    subtleDark: 'rgba(217, 119, 6, 0.15)',
    ring: '#FCD34D',
  },
  slate: {
    name: 'Monochrome Slate',
    primary: '#334155',
    hover: '#1E293B',
    subtleLight: '#F8FAFC',
    subtleDark: 'rgba(51, 65, 85, 0.25)',
    ring: '#94A3B8',
  },
};

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  isDark: boolean;
  accentConfig: AccentConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('chatpilot_theme_mode') as ThemeMode) || 'light';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('chatpilot_accent_color') as AccentColor) || 'emerald';
  });

  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const updateDark = () => {
      let dark = false;
      if (mode === 'dark') {
        dark = true;
      } else if (mode === 'system') {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      setIsDark(dark);

      const root = document.documentElement;
      if (dark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const acc = ACCENTS[accent] || ACCENTS.emerald;
      root.style.setProperty('--accent-primary', acc.primary);
      root.style.setProperty('--accent-hover', acc.hover);
      root.style.setProperty('--accent-subtle', dark ? acc.subtleDark : acc.subtleLight);
      root.style.setProperty('--accent-ring', acc.ring);
    };

    updateDark();

    if (mode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateDark();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [mode, accent]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('chatpilot_theme_mode', newMode);
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    localStorage.setItem('chatpilot_accent_color', newAccent);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        accent,
        setAccent,
        isDark,
        accentConfig: ACCENTS[accent] || ACCENTS.emerald,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
