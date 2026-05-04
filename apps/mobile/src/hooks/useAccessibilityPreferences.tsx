import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';

export type AccessibilityPreferences = {
  theme: Theme;
  accessibleMode: boolean;
  fontScale: FontScale;
};

type AccessibilityContextValue = AccessibilityPreferences & {
  setTheme: (theme: Theme) => void;
  setAccessibleMode: (enabled: boolean) => void;
  setFontScale: (scale: FontScale) => void;
};

const STORAGE_KEY = 'tdp.accessibility.v1';

const DEFAULT_PREFS: AccessibilityPreferences = {
  theme: 'dark',
  accessibleMode: false,
  fontScale: 'md',
};

const FONT_SCALE_VALUES: Record<FontScale, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
};

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';
const isFontScale = (value: unknown): value is FontScale =>
  value === 'sm' || value === 'md' || value === 'lg' || value === 'xl';

function loadPreferences(): AccessibilityPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_PREFS.theme,
      accessibleMode: typeof parsed.accessibleMode === 'boolean' ? parsed.accessibleMode : DEFAULT_PREFS.accessibleMode,
      fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULT_PREFS.fontScale,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function persistPreferences(prefs: AccessibilityPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable (private mode, quota): non-blocking.
  }
}

function applyPreferencesToDom(prefs: AccessibilityPreferences): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.theme = prefs.theme;
  html.dataset.accessibleMode = prefs.accessibleMode ? 'on' : 'off';
  html.dataset.fontScale = prefs.fontScale;
  html.style.fontSize = FONT_SCALE_VALUES[prefs.fontScale];
  html.style.colorScheme = prefs.theme;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(() => loadPreferences());

  useEffect(() => {
    applyPreferencesToDom(prefs);
    persistPreferences(prefs);
  }, [prefs]);

  const setTheme = useCallback((theme: Theme) => {
    setPrefs((prev) => (prev.theme === theme ? prev : { ...prev, theme }));
  }, []);

  const setAccessibleMode = useCallback((enabled: boolean) => {
    setPrefs((prev) => (prev.accessibleMode === enabled ? prev : { ...prev, accessibleMode: enabled }));
  }, []);

  const setFontScale = useCallback((scale: FontScale) => {
    setPrefs((prev) => (prev.fontScale === scale ? prev : { ...prev, fontScale: scale }));
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({ ...prefs, setTheme, setAccessibleMode, setFontScale }),
    [prefs, setTheme, setAccessibleMode, setFontScale],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibilityPreferences(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibilityPreferences must be used inside AccessibilityProvider');
  }
  return ctx;
}
