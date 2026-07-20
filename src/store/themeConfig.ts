export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeConfig {
  name: string;
  mode: ThemeMode;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    ring: string;
  };
}

export const darkTheme: ThemeConfig = {
  name: 'dark',
  mode: 'dark',
  colors: {
    background: '#0a0a1a',
    foreground: '#ffffff',
    card: 'rgba(31, 41, 55, 0.8)',
    cardForeground: '#ffffff',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#374151',
    secondaryForeground: '#d1d5db',
    accent: '#8b5cf6',
    accentForeground: '#ffffff',
    destructive: '#dc2626',
    destructiveForeground: '#ffffff',
    muted: '#1f2937',
    mutedForeground: '#6b7280',
    border: '#374151',
    ring: '#3b82f6',
  },
};

export const lightTheme: ThemeConfig = {
  name: 'light',
  mode: 'light',
  colors: {
    background: '#f8fafc',
    foreground: '#1e293b',
    card: 'rgba(255, 255, 255, 0.9)',
    cardForeground: '#1e293b',
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    secondary: '#e2e8f0',
    secondaryForeground: '#1e293b',
    accent: '#7c3aed',
    accentForeground: '#ffffff',
    destructive: '#dc2626',
    destructiveForeground: '#ffffff',
    muted: '#f1f5f9',
    mutedForeground: '#64748b',
    border: '#e2e8f0',
    ring: '#2563eb',
  },
};

export const getThemeByMode = (mode: ThemeMode): ThemeConfig => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme;
  }
  return mode === 'dark' ? darkTheme : lightTheme;
};

export const applyTheme = (theme: ThemeConfig): void => {
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
  root.classList.toggle('dark', theme.mode === 'dark');
};
