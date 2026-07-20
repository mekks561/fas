import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { ThemeMode, ThemeConfig, getThemeByMode, applyTheme, darkTheme, lightTheme } from './themeConfig';

const THEME_KEY = 'fighter-game-theme';

const getSavedThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light' || saved === 'system') {
    return saved;
  }
  return 'system';
};

let currentThemeMode: ThemeMode = getSavedThemeMode();
let currentTheme: ThemeConfig = getThemeByMode(currentThemeMode);
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => ({
  mode: currentThemeMode,
  theme: currentTheme,
});

export const useTheme = () => {
  const { mode, theme } = useSyncExternalStore(subscribe, getSnapshot);
  const [isInitializing, setIsInitializing] = useState(true);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    currentThemeMode = newMode;
    currentTheme = getThemeByMode(newMode);
    localStorage.setItem(THEME_KEY, newMode);
    applyTheme(currentTheme);
    notifyListeners();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    applyTheme(theme);
    const initTimer = setTimeout(() => setIsInitializing(false), 0);

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        currentTheme = getThemeByMode('system');
        applyTheme(currentTheme);
        notifyListeners();
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => {
          clearTimeout(initTimer);
          mediaQuery.removeEventListener('change', handleChange);
        };
      } else {
        mediaQuery.addListener(handleChange);
        return () => {
          clearTimeout(initTimer);
          mediaQuery.removeListener(handleChange);
        };
      }
    }

    return () => clearTimeout(initTimer);
  }, [mode, theme]);

  const toggleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['dark', 'light', 'system'];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setThemeMode(nextMode);
  }, [mode, setThemeMode]);

  return {
    mode,
    theme,
    isInitializing,
    setThemeMode,
    toggleTheme,
    availableThemes: [
      { mode: 'dark' as ThemeMode, label: 'Dark', theme: darkTheme },
      { mode: 'light' as ThemeMode, label: 'Light', theme: lightTheme },
      { mode: 'system' as ThemeMode, label: 'System', theme: getThemeByMode('system') },
    ],
  };
};
