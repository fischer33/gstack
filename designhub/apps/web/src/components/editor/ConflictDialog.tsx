import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { overwriteSave, unloadGuard, useSaveStore } from '@/editor/save/saveStore';

/** Erscheint, wenn das Design inzwischen anderswo (anderer Tab, anderes Gerät, Link-Bearbeiter) gespeichert wurde. */
export function ConflictDialog() {
  const status = useSaveStore((s) => s.status);
  return (
    <Dialog open={status === 'conflict'} onClose={() => undefined} title="Design wurde anderswo geändert">
      <div className="space-y-4 text-sm" data-testid="conflict-dialog">
        <p>Dieses Design wurde in der Zwischenzeit in einem anderen Tab oder von jemand anderem gespeichert. Damit nichts unbemerkt verloren geht, hat DesignHub dein Speichern angehalten.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Meine Version behalten</b> ersetzt die gespeicherte Fassung durch das, was du hier siehst.</li>
          <li><b className="text-foreground">Neu laden</b> verwirft deine Änderungen seit dem letzten Speichern und zeigt die gespeicherte Fassung.</li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => { unloadGuard.skip = true; window.location.reload(); }} data-testid="conflict-reload">Neu laden</Button>
          <Button onClick={() => void overwriteSave()} data-testid="conflict-overwrite">Meine Version behalten</Button>
        </div>
      </div>
    </Dialog>
  );
}
