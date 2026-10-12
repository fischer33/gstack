import { useState } from 'react';
import { fitPageToSize, newId, type DesignDocument, type TemplateDetail, type TemplateSummary } from '@designhub/shared';
import { api } from '@/lib/api';
import { describeError, useTemplateCategories, useTemplates } from '@/api/hooks';
import { ConfirmDialog } from '@/components/dashboard/dialogs';
import { useToast } from '@/components/ui/toast';
import { ensureFonts } from '@/editor/lib/fonts';
import { fontsOf } from '@/editor/lib/docFonts';
import { selectActivePage, useDocumentStore } from '@/editor/store/documentStore';
import { cloneElement } from '@/editor/store/pageOps';
import { Chip } from './panelUi';

/** Vorlage auf die aktive Seite anwenden: Format wird gleichmäßig angepasst, Schriften werden vorher geladen. */
async function applyTemplate(id: string, doc: DesignDocument) {
  const t = await api<TemplateDetail>(`/templates/${id}`);
  if (!t.data.pages.length) throw new Error('empty');
  const fonts = new Set<string>();
  for (const p of t.data.pages) fontsOf(p.elements, fonts);
  await ensureFonts(fonts);
  // frische IDs, damit dieselbe Vorlage mehrfach (auch auf mehreren Seiten) verwendet werden kann
  const pages = t.data.pages.map((src) => {
    const fitted = fitPageToSize(src, t, doc);
    return { background: fitted.background, elements: fitted.elements.map((e) => cloneElement(e, newId)) };
  });
  useDocumentStore.getState().applyTemplatePages(pages);
}

export default function TemplatesPanel() {
  const [category, setCategory] = useState<string | undefined>();
  const categories = useTemplateCategories();
  const templates = useTemplates({ category });
  const doc = useDocumentStore((s) => s.doc);
  const hasContent = useDocumentStore((s) => (selectActivePage(s)?.elements.length ?? 0) > 0);
  const [pending, setPending] = useState<TemplateSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (!doc) return null;
  const same = (t: TemplateSummary) => t.width === doc.width && t.height === doc.height;
  const list = [...(templates.data ?? [])].sort((a, b) => Number(same(b)) - Number(same(a))); // passende Formate zuerst

  const run = async (t: TemplateSummary) => {
    setBusy(true);
    try { await applyTemplate(t.id, doc); toast(`Vorlage „${t.title}“ angewendet`); }
    catch (err) { toast(describeError(err), 'error'); }
    finally { setBusy(false); setPending(null); }
  };
  const choose = (t: TemplateSummary) => (hasContent ? setPending(t) : void run(t));

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Kategorien">
        <Chip active={!category} onClick={() => setCategory(undefined)}>Alle</Chip>
        {categories.data?.map((c) => <Chip key={c.name} active={category === c.name} onClick={() => setCategory(c.name)}>{c.name}</Chip>)}
      </div>
      {templates.isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p> : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((t) => (
            <button key={t.id} onClick={() => choose(t)} disabled={busy} aria-label={`Vorlage ${t.title}`} className="group text-left disabled:opacity-60">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-border bg-muted p-2 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <img src={t.thumbnail} alt="" loading="lazy" className="max-h-full max-w-full rounded-[3px] bg-white object-contain shadow-sm" />
              </div>
              <div className="mt-1 truncate text-xs font-medium">{t.title}</div>
              <div className="text-[11px] text-muted-foreground">{same(t) ? 'Passt zu diesem Format' : `${t.width} × ${t.height}, wird angepasst`}</div>
            </button>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!pending} onClose={() => setPending(null)} title="Seite ersetzen?" confirmLabel="Vorlage anwenden" busy={busy}
        message="Der Inhalt dieser Seite wird durch die Vorlage ersetzt. Du kannst das mit Strg/Cmd+Z rückgängig machen."
        onConfirm={() => pending && void run(pending)} />
    </div>
  );
}
