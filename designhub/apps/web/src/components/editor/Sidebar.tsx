import { Layers, LayoutTemplate, Palette, Shapes, Type, Upload, X } from 'lucide-react';
import { Suspense, lazy, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';

// Panels laden erst beim ersten Öffnen (Lazy Loading)
const panels: Record<string, ReturnType<typeof lazy<ComponentType>>> = {
  templates: lazy(() => import('./panels/TemplatesPanel')),
  elements: lazy(() => import('./panels/ElementsPanel')),
  text: lazy(() => import('./panels/TextPanel')),
  uploads: lazy(() => import('./panels/UploadsPanel')),
  background: lazy(() => import('./panels/BackgroundPanel')),
  layers: lazy(() => import('./panels/LayersPanel')),
};

const TABS = [
  { id: 'templates', label: 'Vorlagen', Icon: LayoutTemplate },
  { id: 'elements', label: 'Elemente', Icon: Shapes },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'uploads', label: 'Uploads', Icon: Upload },
  { id: 'background', label: 'Hintergrund', Icon: Palette },
  { id: 'layers', label: 'Ebenen', Icon: Layers },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Linke Seitenleiste mit sechs Tabs; am Handy unten, das Panel öffnet darüber. */
export function Sidebar() {
  const [tab, setTab] = useState<TabId | null>('elements');
  const Panel = tab ? panels[tab] : null;
  const current = TABS.find((t) => t.id === tab);

  return (
    <aside className="flex shrink-0 flex-col-reverse border-border md:flex-row md:border-r">
      <nav aria-label="Werkzeuge" className="flex shrink-0 items-center justify-around gap-0.5 border-t border-border bg-background p-1 md:w-[4.5rem] md:flex-col md:justify-start md:border-r md:border-t-0 md:p-1.5">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(tab === id ? null : id)} aria-label={label} aria-pressed={tab === id}
            className={cn('flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium transition-colors md:w-16',
              tab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </nav>
      {Panel && current && (
        <section aria-label={current.label} className="max-h-[42vh] overflow-y-auto border-b border-border bg-background md:max-h-none md:w-72 md:border-b-0">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 py-3">
            <h2 className="font-semibold">{current.label}</h2>
            <button onClick={() => setTab(null)} aria-label="Panel schließen" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-4 pb-6">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Lädt…</p>}><Panel /></Suspense>
          </div>
        </section>
      )}
    </aside>
  );
}
