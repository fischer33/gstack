import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TRASH_RETENTION_DAYS, type DesignSummary } from '@designhub/shared';
import { useDeleteForever, useDesigns, useEmptyTrash, useRestoreDesign } from '@/api/hooks';
import { EmptyState, Grid, Skeletons, TrashCard } from '@/components/dashboard/cards';
import { ConfirmDialog } from '@/components/dashboard/dialogs';
import { Button } from '@/components/ui/button';

export function Trash() {
  const { data, isLoading } = useDesigns({ trash: true });
  const restore = useRestoreDesign();
  const forever = useDeleteForever();
  const empty = useEmptyTrash();
  const [target, setTarget] = useState<DesignSummary | null>(null);
  const [emptying, setEmptying] = useState(false);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Papierkorb</h1>
          <p className="text-sm text-muted-foreground">Designs werden nach {TRASH_RETENTION_DAYS} Tagen endgültig gelöscht.</p>
        </div>
        {!!data?.length && <Button variant="outline" onClick={() => setEmptying(true)}><Trash2 className="h-4 w-4" /> Papierkorb leeren</Button>}
      </div>

      {isLoading ? <Skeletons /> : data?.length ? (
        <Grid>{data.map((d) => <TrashCard key={d.id} design={d} onRestore={() => restore.mutate(d.id)} onDelete={() => setTarget(d)} />)}</Grid>
      ) : <EmptyState title="Der Papierkorb ist leer" text="Gelöschte Designs erscheinen hier und lassen sich wiederherstellen." />}

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} title="Endgültig löschen?" confirmLabel="Endgültig löschen" busy={forever.isPending}
        message={`„${target?.title}“ wird dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`}
        onConfirm={() => forever.mutate(target!.id, { onSuccess: () => setTarget(null) })} />
      <ConfirmDialog open={emptying} onClose={() => setEmptying(false)} title="Papierkorb leeren?" confirmLabel="Alles löschen" busy={empty.isPending}
        message={`Alle ${data?.length ?? 0} Designs im Papierkorb werden dauerhaft gelöscht.`}
        onConfirm={() => empty.mutate(undefined, { onSuccess: () => setEmptying(false) })} />
    </div>
  );
}
