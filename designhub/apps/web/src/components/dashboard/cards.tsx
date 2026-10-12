import { Copy, FolderInput, MoreHorizontal, Pencil, Trash2, Undo2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TRASH_RETENTION_DAYS, type DesignSummary, type TemplateSummary } from '@designhub/shared';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { daysUntilPurge, formatSize, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Vorschau im Kartenformat; Bilder werden eingepasst, nicht beschnitten. */
function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={cn('grid aspect-[4/3] place-items-center overflow-hidden rounded-md bg-muted p-3', className)}>
      {src ? <img src={src} alt="" loading="lazy" className="max-h-full max-w-full rounded-[3px] bg-white object-contain shadow-sm" /> : <div className="h-full w-2/3 rounded-[3px] bg-border" />}
    </div>
  );
}

export function DesignCard({ design, actions }: { design: DesignSummary; actions: { rename(): void; move(): void; duplicate(): void; trash(): void } }) {
  const items: MenuItem[] = [
    { label: 'Umbenennen', icon: <Pencil className="h-4 w-4" />, onSelect: actions.rename },
    { label: 'Duplizieren', icon: <Copy className="h-4 w-4" />, onSelect: actions.duplicate },
    { label: 'In Ordner verschieben', icon: <FolderInput className="h-4 w-4" />, onSelect: actions.move },
    { label: 'In den Papierkorb', icon: <Trash2 className="h-4 w-4" />, onSelect: actions.trash, danger: true },
  ];
  return (
    <article className="group relative">
      <Link to={`/design/${design.id}`} className="block rounded-lg outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/60">
        <Thumb src={design.thumbnail} className="border border-border transition-shadow group-hover:shadow-md" />
        <h3 className="mt-2 truncate text-sm font-semibold">{design.title}</h3>
        <p className="text-xs text-muted-foreground">{formatSize(design.width, design.height)} · {relativeTime(design.updatedAt)}</p>
      </Link>
      {/* Auf Touch-Geräten immer sichtbar, am Desktop erst beim Hovern/Fokussieren */}
      <Menu label={`Aktionen für ${design.title}`} className="absolute right-2 top-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
        trigger={<span className="grid h-8 w-8 place-items-center rounded-md bg-card/90 shadow ring-1 ring-border hover:bg-card"><MoreHorizontal className="h-4 w-4" /></span>} items={items} />
    </article>
  );
}

export function TrashCard({ design, onRestore, onDelete }: { design: DesignSummary; onRestore(): void; onDelete(): void }) {
  const days = design.deletedAt ? daysUntilPurge(design.deletedAt, TRASH_RETENTION_DAYS) : TRASH_RETENTION_DAYS;
  return (
    <article>
      <Thumb src={design.thumbnail} className="border border-border opacity-70" />
      <h3 className="mt-2 truncate text-sm font-semibold">{design.title}</h3>
      <p className="text-xs text-muted-foreground">Wird in {days} {days === 1 ? 'Tag' : 'Tagen'} endgültig gelöscht</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={onRestore}><Undo2 className="h-4 w-4" /> Wiederherstellen</Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`${design.title} endgültig löschen`} className="text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </article>
  );
}

export function TemplateCard({ template, onUse, busy }: { template: TemplateSummary; onUse(): void; busy?: boolean }) {
  return (
    <button onClick={onUse} disabled={busy} className="group text-left outline-none disabled:opacity-60">
      <Thumb src={template.thumbnail} className="border border-border transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/60" />
      <h3 className="mt-2 truncate text-sm font-semibold">{template.title}</h3>
      <p className="text-xs text-muted-foreground">{template.category} · {formatSize(template.width, template.height)}</p>
    </button>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeletons({ n = 4 }: { n?: number }) {
  return <Grid>{Array.from({ length: n }, (_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-md bg-muted" />)}</Grid>;
}
