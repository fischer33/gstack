import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDesigns, useTemplateCategories, useTemplates } from '@/api/hooks';
import { useAuth } from '@/auth/AuthContext';
import { useShell } from '@/components/dashboard/AppShell';
import { EmptyState, Grid, Skeletons, TemplateCard } from '@/components/dashboard/cards';
import { DesignGrid } from '@/components/dashboard/designActions';
import { CustomSizeTile, FORMAT_KEYS, FormatTile } from '@/components/dashboard/formats';
import { Button } from '@/components/ui/button';
import { FORMATS } from '@designhub/shared';
import { cn } from '@/lib/utils';

export function Home() {
  const { user } = useAuth();
  const shell = useShell();
  const [category, setCategory] = useState<string | undefined>();
  const recent = useDesigns({ limit: 6 });
  const categories = useTemplateCategories();
  const templates = useTemplates({ category });

  const total = categories.data?.reduce((n, c) => n + c.count, 0) ?? 0;
  const chips = [{ name: undefined as string | undefined, label: 'Alle', count: total }, ...(categories.data ?? []).map((c) => ({ name: c.name, label: c.name, count: c.count }))];

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Was möchtest du gestalten{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {FORMAT_KEYS.map((k) => (
            <FormatTile key={k} format={k} disabled={shell.creating} onPick={() => shell.createBlank({ width: FORMATS[k].width, height: FORMATS[k].height })} />
          ))}
          <CustomSizeTile onPick={() => shell.openCreate({ custom: true })} />
        </div>
      </section>

      <section aria-labelledby="recent">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent" className="text-xl font-bold">Zuletzt bearbeitet</h2>
          {!!recent.data?.length && <Link to="/app/designs" className="text-sm font-semibold text-primary hover:underline">Alle anzeigen</Link>}
        </div>
        <DesignGrid designs={recent.data} loading={recent.isLoading}
          empty={<EmptyState title="Noch keine Designs" text="Wähle oben ein Format oder starte mit einer Vorlage." action={<Button onClick={() => shell.openCreate()}>Erstes Design erstellen</Button>} />} />
      </section>

      <section aria-labelledby="templates">
        <h2 id="templates" className="mb-4 text-xl font-bold">Vorlagen</h2>
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Vorlagen-Kategorien">
          {chips.map((c) => (
            <button key={c.label} role="tab" aria-selected={category === c.name} onClick={() => setCategory(c.name)}
              className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors', category === c.name ? 'border-transparent bg-brand text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>
              {c.label} <span className="opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
        {templates.isLoading ? <Skeletons n={5} /> : templates.data?.length ? (
          <Grid>{templates.data.map((t) => (
            <TemplateCard key={t.id} template={t} busy={shell.creating} onUse={() => shell.createFromTemplate(t.id)} />
          ))}</Grid>
        ) : <EmptyState title="Keine Vorlagen gefunden" text="Wähle eine andere Kategorie." />}
        {shell.creating && <p role="status" className="mt-4 text-sm text-muted-foreground">Design wird erstellt…</p>}
      </section>
    </div>
  );
}
