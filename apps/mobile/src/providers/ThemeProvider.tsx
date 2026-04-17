import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameState } from '../state/store';

export type ThemeSetting = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

type ThemeContextValue = {
  theme: ThemeSetting;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemeSetting) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { state, updateProfile } = useGameState();
  const theme: ThemeSetting = state.profile.theme ?? 'system';

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Track OS-level preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (t: ThemeSetting) => updateProfile({ theme: t }),
    [updateProfile]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
