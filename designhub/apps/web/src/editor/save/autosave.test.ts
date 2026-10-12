import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave, ConflictError, type SaveStatus } from './autosave';

function setup(send?: (p: number, v: number) => Promise<{ version: number }>) {
  const state = { rev: 0, version: 1 };
  const statuses: SaveStatus[] = [];
  const calls: { payload: number; version: number }[] = [];
  const impl = send ?? (async () => ({ version: state.version + 1 }));
  const a = new Autosave<number>({
    getRevision: () => state.rev, snapshot: () => state.rev, version: 1,
    send: async (p, v) => { calls.push({ payload: p, version: v }); const r = await impl(p, v); state.version = r.version; return r; },
    onStatus: (s) => statuses.push(s),
  });
  const edit = () => { state.rev++; a.changed(); };
  return { a, state, statuses, calls, edit };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Autosave', () => {
  it('speichert erst 5 s nach der letzten Änderung (Entprellen), mit der erwarteten Version', async () => {
    const { a, calls, edit, statuses } = setup();
    edit(); await vi.advanceTimersByTimeAsync(4000); edit(); await vi.advanceTimersByTimeAsync(4000);
    expect(calls).toHaveLength(0);
    expect(a.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1100);
    expect(calls).toEqual([{ payload: 2, version: 1 }]);
    expect(a.status).toBe('saved');
    expect(statuses).toEqual(['dirty', 'saving', 'saved']);
  });

  it('speichert bei Dauerbearbeitung spätestens nach 30 s', async () => {
    const { calls, edit } = setup();
    for (let i = 0; i < 40; i++) { edit(); await vi.advanceTimersByTimeAsync(1000); }
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]!.payload).toBeLessThanOrEqual(31);
  });

  it('Änderungen während des Speicherns führen zu genau einem Folge-Speichern', async () => {
    let release!: () => void;
    const { a, calls, edit, state } = setup(() => new Promise((r) => { release = () => r({ version: state.version + 1 }); }));
    edit(); await vi.advanceTimersByTimeAsync(5100);
    expect(a.status).toBe('saving');
    edit(); edit();
    expect(calls).toHaveLength(1);
    release(); await vi.advanceTimersByTimeAsync(10);
    expect(a.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(5100);
    release(); await vi.advanceTimersByTimeAsync(10);
    expect(calls.map((c) => [c.payload, c.version])).toEqual([[1, 1], [3, 2]]);
    expect(a.status).toBe('saved');
  });

  it('Fehler werden mit wachsendem Abstand wiederholt und heilen von selbst', async () => {
    let fail = 3;
    const { a, calls, edit } = setup(async () => { if (fail-- > 0) throw new Error('offline'); return { version: 2 }; });
    edit(); await vi.advanceTimersByTimeAsync(5100);
    expect(a.status).toBe('error');
    await vi.advanceTimersByTimeAsync(5000); expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(10_000); expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(20_000); expect(calls).toHaveLength(4);
    expect(a.status).toBe('saved');
  });

  it('Konflikt hält an; „überschreiben“ speichert mit der Serverversion', async () => {
    let conflict = true;
    const { a, calls, edit } = setup(async (_p, v) => { if (conflict) throw new ConflictError(7); return { version: v + 1 }; });
    edit(); await vi.advanceTimersByTimeAsync(5100);
    expect(a.status).toBe('conflict');
    edit(); await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1); // kein Wiederholen, kein stilles Überschreiben
    conflict = false;
    await a.overwrite();
    expect(calls.at(-1)).toEqual({ payload: 2, version: 7 });
    expect(a.status).toBe('saved');
  });

  it('flush speichert sofort und wartet auf einen laufenden Vorgang', async () => {
    const { a, calls, edit } = setup();
    edit(); await a.flush();
    expect(calls).toHaveLength(1);
    expect(a.status).toBe('saved');
    await a.flush(); // nichts zu tun
    expect(calls).toHaveLength(1);
  });

  it('Rückkehr zum gespeicherten Stand (revision gleich) bleibt „gespeichert“', async () => {
    const { a, state, calls } = setup();
    state.rev = 0; a.changed();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(0);
    expect(a.status).toBe('saved');
  });

  it('nach dispose passiert nichts mehr', async () => {
    const { a, calls, edit } = setup();
    edit(); a.dispose(); await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(0);
  });
});
