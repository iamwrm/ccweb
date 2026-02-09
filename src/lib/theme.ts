import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';

export const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('ccweb-theme');
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem('ccweb-theme', theme);
  } catch {
    // localStorage may be unavailable
  }
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
}
