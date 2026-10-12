/**
 * Autosave-Steuerung, unabhängig von React und Netzwerk (testbar mit Fake-Timern).
 *
 * Ablauf: Jede Änderung (steigende `revision`) startet einen Entprellzeitraum von `delayMs`; erst wenn so lange nichts
 * mehr passiert, wird gespeichert. Hält das Bearbeiten ununterbrochen an, wird spätestens nach `maxWaitMs` gespeichert.
 * Es läuft nie mehr als ein Speichervorgang gleichzeitig; Änderungen während des Speicherns lösen danach einen weiteren aus.
 * Fehler (offline, Server) werden mit wachsendem Abstand wiederholt, ein Versionskonflikt hält an, bis der Nutzer entscheidet.
 */
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export class ConflictError extends Error {
  constructor(public serverVersion: number) { super('conflict'); }
}

export interface AutosaveOptions<P> {
  /** Aktueller Zähler des Dokuments (steigt bei jeder Änderung). */
  getRevision(): number;
  /** Zustand, der gespeichert werden soll (wird erst beim Senden gelesen). */
  snapshot(): P;
  /** Sendet den Zustand mit der erwarteten Version; liefert die neue Version. Wirft `ConflictError` bei Konflikt. */
  send(payload: P, version: number): Promise<{ version: number }>;
  /** Version, die beim Laden vom Server kam. */
  version: number;
  onStatus?(status: SaveStatus, info: { error?: unknown; serverVersion?: number }): void;
  delayMs?: number;
  maxWaitMs?: number;
  retryMs?: number[];
}

export class Autosave<P> {
  status: SaveStatus = 'saved';
  private version: number;
  private savedRevision: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstDirtyAt = 0;
  private inFlight = false;
  private again = false;
  private failures = 0;
  private conflictVersion = 0;
  private disposed = false;
  private readonly delay: number;
  private readonly maxWait: number;
  private readonly retry: number[];

  constructor(private o: AutosaveOptions<P>) {
    this.version = o.version;
    this.savedRevision = o.getRevision();
    this.delay = o.delayMs ?? 5000;
    this.maxWait = o.maxWaitMs ?? 30_000;
    this.retry = o.retryMs ?? [5000, 10_000, 20_000, 60_000];
  }

  private set(status: SaveStatus, info: { error?: unknown; serverVersion?: number } = {}) {
    this.status = status;
    this.o.onStatus?.(status, info);
  }

  get dirty() { return this.o.getRevision() !== this.savedRevision; }
  get busy() { return this.inFlight; }

  private clear() { if (this.timer) clearTimeout(this.timer); this.timer = null; }

  private schedule(ms: number) {
    this.clear();
    this.timer = setTimeout(() => void this.run(), ms);
  }

  /** Nach jeder Änderung aufrufen (Store-Abo). */
  changed() {
    if (this.disposed || this.status === 'conflict') return;
    if (!this.dirty) { if (!this.inFlight && this.status !== 'error') this.set('saved'); return; }
    if (!this.firstDirtyAt) this.firstDirtyAt = Date.now();
    if (this.status === 'saved') this.set('dirty');
    if (this.inFlight) { this.again = true; return; }
    if (this.status === 'error') return; // der Wiederholungs-Timer läuft bereits
    this.schedule(Math.max(0, Math.min(this.delay, this.firstDirtyAt + this.maxWait - Date.now())));
  }

  /** Sofort speichern (Strg+S, Verlassen, Tab-Wechsel). Löst nach Abschluss auf. */
  async flush(): Promise<void> {
    if (this.disposed || this.status === 'conflict') return;
    this.clear();
    while (this.inFlight) await new Promise((r) => setTimeout(r, 25)); // laufenden Vorgang abwarten, dann ggf. neu
    if (this.dirty) await this.run();
  }

  private async run(): Promise<void> {
    this.clear();
    if (this.disposed || this.inFlight || !this.dirty) { if (!this.dirty && !this.inFlight && this.status !== 'conflict') this.set('saved'); return; }
    this.inFlight = true; this.again = false;
    const rev = this.o.getRevision();
    this.set('saving');
    try {
      const out = await this.o.send(this.o.snapshot(), this.version);
      this.version = out.version;
      this.savedRevision = rev;
      this.failures = 0;
      this.firstDirtyAt = 0;
      this.inFlight = false;
      if (this.dirty) { this.set('dirty'); this.firstDirtyAt = Date.now(); this.schedule(this.again ? this.delay : 1000); }
      else this.set('saved');
    } catch (err) {
      this.inFlight = false;
      if (err instanceof ConflictError) {
        this.conflictVersion = err.serverVersion;
        this.set('conflict', { serverVersion: err.serverVersion });
        return;
      }
      this.set('error', { error: err });
      this.schedule(this.retry[Math.min(this.failures++, this.retry.length - 1)]!);
    }
  }

  /** „Meine Version behalten“: Konflikt auflösen, indem mit der aktuellen Serverversion erneut gespeichert wird. */
  async overwrite() {
    if (this.status !== 'conflict') return;
    this.version = this.conflictVersion;
    this.status = 'dirty';
    this.o.onStatus?.('dirty', {});
    await this.run();
  }

  dispose() { this.disposed = true; this.clear(); }
}
