import { useSearchParams } from 'react-router-dom';
import { useDesigns, useTemplates } from '@/api/hooks';
import { useShell } from '@/components/dashboard/AppShell';
import { EmptyState, Grid, Skeletons, TemplateCard } from '@/components/dashboard/cards';
import { DesignGrid } from '@/components/dashboard/designActions';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const shell = useShell();
  const designs = useDesigns({ q });
  const templates = useTemplates({ q });

  if (!q) return <EmptyState title="Suche" text="Gib oben einen Suchbegriff ein." />;
  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <h1 className="text-2xl font-bold tracking-tight">Ergebnisse für „{q}“</h1>
      <section aria-labelledby="s-designs">
        <h2 id="s-designs" className="mb-4 text-xl font-bold">Deine Designs</h2>
        <DesignGrid designs={designs.data} loading={designs.isLoading} empty={<EmptyState title="Keine Designs gefunden" text="Prüfe die Schreibweise oder suche nach einem Teil des Titels." />} />
      </section>
      <section aria-labelledby="s-templates">
        <h2 id="s-templates" className="mb-4 text-xl font-bold">Vorlagen</h2>
        {templates.isLoading ? <Skeletons n={5} /> : templates.data?.length
          ? <Grid>{templates.data.map((t) => <TemplateCard key={t.id} template={t} busy={shell.creating} onUse={() => shell.createFromTemplate(t.id)} />)}</Grid>
          : <EmptyState title="Keine Vorlagen gefunden" text="Suche nach Kategorie (z. B. „Poster“) oder Stichwort (z. B. „Sale“)." />}
      </section>
    </div>
  );
}
