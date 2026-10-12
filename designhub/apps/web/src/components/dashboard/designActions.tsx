import { useState } from 'react';
import type { DesignSummary } from '@designhub/shared';
import { useDuplicateDesign, useFolders, usePatchDesign, useTrashDesign } from '@/api/hooks';
import { DesignCard, EmptyState, Grid, Skeletons } from './cards';
import { MoveDialog, PromptDialog } from './dialogs';

/** Raster mit Karten inklusive Umbenennen/Verschieben/Duplizieren/Löschen; hält die jeweiligen Dialoge. */
export function DesignGrid({ designs, loading, empty }: { designs: DesignSummary[] | undefined; loading: boolean; empty: React.ReactNode }) {
  const patch = usePatchDesign();
  const duplicate = useDuplicateDesign();
  const trash = useTrashDesign();
  const { data: folders = [] } = useFolders();
  const [renaming, setRenaming] = useState<DesignSummary | null>(null);
  const [moving, setMoving] = useState<DesignSummary | null>(null);

  if (loading) return <Skeletons />;
  if (!designs?.length) return <>{empty}</>;
  return (
    <>
      <Grid>
        {designs.map((d) => (
          <DesignCard key={d.id} design={d} actions={{
            rename: () => setRenaming(d), move: () => setMoving(d),
            duplicate: () => duplicate.mutate(d.id), trash: () => trash.mutate(d.id),
          }} />
        ))}
      </Grid>
      <PromptDialog open={!!renaming} onClose={() => setRenaming(null)} title="Design umbenennen" label="Titel" initial={renaming?.title} confirmLabel="Speichern" busy={patch.isPending}
        onSubmit={(title) => patch.mutate({ id: renaming!.id, title }, { onSuccess: () => setRenaming(null) })} />
      <MoveDialog open={!!moving} onClose={() => setMoving(null)} folders={folders} current={moving?.folderId ?? null}
        onMove={(folderId) => patch.mutate({ id: moving!.id, folderId }, { onSuccess: () => setMoving(null) })} />
    </>
  );
}

export { EmptyState };
