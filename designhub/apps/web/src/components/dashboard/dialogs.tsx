import { useState, type FormEvent } from 'react';
import type { FolderSummary } from '@designhub/shared';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Einzeiliges Eingabe-Dialog (Umbenennen, Ordner anlegen). */
export function PromptDialog({ open, onClose, title, label, initial = '', confirmLabel, onSubmit, busy }: {
  open: boolean; onClose(): void; title: string; label: string; initial?: string; confirmLabel: string; onSubmit(value: string): void; busy?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const submit = (e: FormEvent) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); };
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="prompt-value" className="text-sm font-medium">{label}</label>
          <Input id="prompt-value" autoFocus value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" disabled={!value.trim() || busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onClose, title, message, confirmLabel, onConfirm, busy }: {
  open: boolean; onClose(): void; title: string; message: string; confirmLabel: string; onConfirm(): void; busy?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button className="bg-red-600 bg-none hover:bg-red-700" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

export function MoveDialog({ open, onClose, folders, current, onMove }: {
  open: boolean; onClose(): void; folders: FolderSummary[]; current: string | null; onMove(folderId: string | null): void;
}) {
  const [target, setTarget] = useState<string>(current ?? '');
  return (
    <Dialog open={open} onClose={onClose} title="In Ordner verschieben">
      <form onSubmit={(e) => { e.preventDefault(); onMove(target || null); }} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="move-target" className="text-sm font-medium">Ziel</label>
          <select id="move-target" value={target} onChange={(e) => setTarget(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <option value="">Kein Ordner (Hauptbereich)</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button type="submit">Verschieben</Button>
        </div>
      </form>
    </Dialog>
  );
}
