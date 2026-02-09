import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, setStoredTheme } from '../lib/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = '';
});

describe('getStoredTheme', () => {
  it('returns dark by default', () => {
    expect(getStoredTheme()).toBe('dark');
  });

  it('returns light when stored', () => {
    localStorage.setItem('ccweb-theme', 'light');
    expect(getStoredTheme()).toBe('light');
  });

  it('returns dark for unknown values', () => {
    localStorage.setItem('ccweb-theme', 'invalid');
    expect(getStoredTheme()).toBe('dark');
  });
});

describe('setStoredTheme', () => {
  it('persists to localStorage', () => {
    setStoredTheme('light');
    expect(localStorage.getItem('ccweb-theme')).toBe('light');
  });

  it('sets data-theme attribute for light', () => {
    setStoredTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('clears data-theme attribute for dark', () => {
    setStoredTheme('light');
    setStoredTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('');
  });
});
