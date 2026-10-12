import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDeleteFolder, useDesigns, useFolders, useRenameFolder } from '@/api/hooks';
import { useShell } from '@/components/dashboard/AppShell';
import { EmptyState } from '@/components/dashboard/cards';
import { ConfirmDialog, PromptDialog } from '@/components/dashboard/dialogs';
import { DesignGrid } from '@/components/dashboard/designActions';
import { Button } from '@/components/ui/button';

export function MyDesigns() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const shell = useShell();
  const folderId = params.get('folder') ?? undefined;
  const sort = params.get('sort') === 'title' ? 'title' : 'updated';

  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const folder = folders.find((f) => f.id === folderId);
  // Ohne Ordner-Parameter: alle Designs. Ein unbekannter Ordner (z. B. gelöscht) zeigt eine Hinweisseite.
  const designs = useDesigns({ folderId, sort });
  const rename = useRenameFolder();
  const remove = useDeleteFolder();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (folderId && !foldersLoading && !folder) {
    return <EmptyState title="Ordner nicht gefunden" text="Dieser Ordner existiert nicht (mehr)." action={<Button onClick={() => navigate('/app/designs')}>Alle Designs</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{folder ? folder.name : 'Meine Designs'}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sortierung
            <select value={sort} onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); n.set('sort', e.target.value); return n; }, { replace: true })}
              className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground">
              <option value="updated">Zuletzt bearbeitet</option>
              <option value="title">Titel A–Z</option>
            </select>
          </label>
          {folder && (
            <>
              <Button variant="outline" size="sm" onClick={() => setRenaming(true)}><Pencil className="h-4 w-4" /> Umbenennen</Button>
              <Button variant="outline" size="sm" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /> Ordner löschen</Button>
            </>
          )}
        </div>
      </div>

      <DesignGrid designs={designs.data} loading={designs.isLoading}
        empty={<EmptyState title={folder ? 'Dieser Ordner ist leer' : 'Noch keine Designs'} text={folder ? 'Neue Designs landen hier automatisch. Du kannst auch bestehende per Menü verschieben.' : 'Erstelle dein erstes Design.'}
          action={<Button onClick={() => shell.openCreate()}><Plus className="h-4 w-4" /> Design erstellen</Button>} />} />

      {folder && (
        <>
          <PromptDialog open={renaming} onClose={() => setRenaming(false)} title="Ordner umbenennen" label="Name" initial={folder.name} confirmLabel="Speichern" busy={rename.isPending}
            onSubmit={(name) => rename.mutate({ id: folder.id, name }, { onSuccess: () => setRenaming(false) })} />
          <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title="Ordner löschen?" busy={remove.isPending} confirmLabel="Ordner löschen"
            message={`Der Ordner „${folder.name}“ wird gelöscht. Die ${folder.designCount} enthaltenen Designs bleiben erhalten und liegen danach unter „Meine Designs“.`}
            onConfirm={() => remove.mutate(folder.id, { onSuccess: () => { setDeleting(false); navigate('/app/designs'); } })} />
        </>
      )}
    </div>
  );
}
