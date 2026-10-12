import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pageToSvg } from '@designhub/shared';
import { useSharedDesign } from '@/api/hooks';
import { Logo } from '@/components/Logo';
import { buttonVariants } from '@/components/ui/button';
import { fontsOf } from '@/editor/lib/docFonts';
import { ensureFonts } from '@/editor/lib/fonts';

const EditorPage = lazy(() => import('./EditorPage').then((m) => ({ default: m.EditorPage })));

const Centered = ({ children }: { children: React.ReactNode }) => <div className="grid min-h-screen place-items-center px-4 text-center text-muted-foreground">{children}</div>;

/** Öffentliche Seite hinter einem Freigabe-Link: Bearbeiten-Links öffnen den Editor, Ansehen-Links einen schreibgeschützten Betrachter. */
export function SharePage() {
  const { token } = useParams();
  const { data, isLoading, isError } = useSharedDesign(token);
  if (isLoading) return <Centered>Lädt…</Centered>;
  if (isError || !data) {
    return (
      <Centered>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Link nicht gültig</h1>
          <p className="mt-2">Dieser Link wurde deaktiviert, ist abgelaufen oder das Design wurde gelöscht.</p>
          <Link to="/" className={buttonVariants({ className: 'mt-6' })}>Zu DesignHub</Link>
        </div>
      </Centered>
    );
  }
  if (data.role === 'EDIT') return <Suspense fallback={<Centered>Lädt…</Centered>}><EditorPage /></Suspense>;
  return <Viewer />;
}

function Viewer() {
  const { token } = useParams();
  const { data } = useSharedDesign(token);
  const [svgs, setSvgs] = useState<string[] | null>(null);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      const fonts = new Set<string>();
      for (const p of data.pages) fontsOf(p.elements, fonts);
      await ensureFonts([...fonts]);
      const { measureTextLines } = await import('@/editor/export/renderPage'); // Zeilenumbruch wie im Editor
      if (!cancelled) setSvgs(data.pages.map((p) => pageToSvg(data, p, { textLines: measureTextLines(p.elements) })));
    })();
    return () => { cancelled = true; };
  }, [data]);

  if (!data) return null;
  return (
    <div className="min-h-screen bg-muted">
      <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
        <Link to="/" aria-label="DesignHub"><Logo /></Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold" data-testid="viewer-title">{data.title}</h1>
        <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">Nur ansehen</span>
        <Link to="/register" className={buttonVariants({ size: 'sm' })}>Eigenes Design erstellen</Link>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8" data-testid="viewer-pages">
        {/* Das SVG stammt aus unserem Serializer und wurde beim Speichern gegen das Schema geprüft (keine Skripte, nur erlaubte Farben/Pfade/Bild-URLs). */}
        {svgs?.map((svg, i) => (
          <div key={i} role="img" aria-label={`Seite ${i + 1} von ${svgs.length}`} data-testid="viewer-page"
            className="overflow-hidden rounded-md bg-white shadow-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ))}
        {!svgs && <p className="text-center text-muted-foreground">Lädt…</p>}
      </main>
    </div>
  );
}
