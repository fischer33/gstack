import { describe, expect, it } from 'vitest';
import { daysUntilPurge, formatSize, relativeTime } from './format';

const now = new Date('2026-10-12T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('relativeTime', () => {
  it('kurze Abstände', () => {
    expect(relativeTime(ago(10_000), now)).toBe('gerade eben');
    expect(relativeTime(ago(5 * 60_000), now)).toMatch(/5 Min/);
  });
  it('Stunden und Tage', () => {
    expect(relativeTime(ago(3 * 3_600_000), now)).toMatch(/3 Std/);
    expect(relativeTime(ago(86_400_000), now)).toBe('gestern');
    expect(relativeTime(ago(3 * 86_400_000), now)).toMatch(/3 Tagen/);
  });
  it('ab einer Woche als Datum', () => {
    expect(relativeTime(ago(30 * 86_400_000), now)).toMatch(/2026/);
  });
});

describe('daysUntilPurge', () => {
  it('zählt runter und fällt nicht unter 0', () => {
    expect(daysUntilPurge(ago(0), 30, now)).toBe(30);
    expect(daysUntilPurge(ago(10 * 86_400_000), 30, now)).toBe(20);
    expect(daysUntilPurge(ago(40 * 86_400_000), 30, now)).toBe(0);
  });
});

it('formatSize', () => expect(formatSize(1080, 1920)).toBe('1080 × 1920 px'));
