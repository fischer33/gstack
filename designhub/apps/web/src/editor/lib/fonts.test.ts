import { describe, expect, it } from 'vitest';
import { isSafePathData } from '@designhub/shared';
import { FONTS, fontInfo, googleFontsUrl } from './fonts';
import { ICONS, STICKERS } from './icons';

describe('Schriften', () => {
  it('mindestens 30 eindeutige Schriften', () => {
    expect(FONTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(FONTS.map((f) => f.family)).size).toBe(FONTS.length);
  });
  it('Google-Fonts-URL: Leerzeichen als +, Schnitte nur wenn vorhanden', () => {
    expect(googleFontsUrl('Open Sans')).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
    expect(googleFontsUrl('Bebas Neue', false)).toBe('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
    expect(googleFontsUrl('Roboto Mono')).toContain('Roboto+Mono');
  });
  it('fontInfo kennt Einschnitt-Schriften', () => {
    expect(fontInfo('Bebas Neue')?.bold).toBe(false);
    expect(fontInfo('Inter')?.bold).toBe(true);
    expect(fontInfo('Comic Sans')).toBeUndefined();
  });
  it('Kategorien sind gesetzt', () => {
    expect(new Set(FONTS.map((f) => f.category))).toEqual(new Set(['Sans', 'Serif', 'Handschrift', 'Display', 'Mono']));
  });
});

describe('Icons und Sticker', () => {
  it('alle Icon-Pfade sind sicher und die Namen eindeutig', () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(20);
    expect(ICONS.every((i) => isSafePathData(i.path))).toBe(true);
    expect(new Set(ICONS.map((i) => i.name)).size).toBe(ICONS.length);
  });
  it('jeder Icon-Pfad beginnt mit einem Move-Befehl und ist geschlossen oder endet sauber', () => {
    for (const i of ICONS) expect(i.path.trim()).toMatch(/^[Mm]/);
  });
  it('Sticker sind eindeutig', () => expect(new Set(STICKERS).size).toBe(STICKERS.length));
});
