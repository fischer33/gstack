import { describe, expect, it } from 'vitest';
import { parsePref, resolveTheme } from './theme';

describe('theme', () => {
  it('system folgt dem OS, explizite Wahl gewinnt', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('ungültige gespeicherte Werte fallen auf system zurück', () => {
    expect(parsePref('dark')).toBe('dark');
    expect(parsePref('blau')).toBe('system');
    expect(parsePref(null)).toBe('system');
  });
});
