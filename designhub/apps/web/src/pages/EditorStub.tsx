import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDesign } from '@/api/hooks';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { formatSize } from '@/lib/format';

/** Platzhalter bis Etappe (c). Zeigt, dass Anlegen, Öffnen und Rechteprüfung ende-zu-ende funktionieren. */
export function EditorStub() {
  const { id = '' } = useParams();
  const { data: design, isLoading, isError } = useDesign(id);

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-4">
          <Link to="/app" aria-label="Zurück zum Dashboard" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <Logo />
        </div>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        {isLoading && <p className="text-muted-foreground">Lädt…</p>}
        {isError && (
          <>
            <h1 className="text-2xl font-bold">Design nicht gefunden</h1>
            <p className="mt-2 text-muted-foreground">Es existiert nicht, liegt im Papierkorb oder gehört jemand anderem.</p>
            <Link to="/app/designs" className={buttonVariants({ className: 'mt-6' })}>Zu meinen Designs</Link>
          </>
        )}
        {design && (
          <>
            <h1 className="text-2xl font-bold">{design.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatSize(design.width, design.height)} · {design.pages.length} Seite{design.pages.length === 1 ? '' : 'n'}</p>
            {design.thumbnail && <img src={design.thumbnail} alt="" className="mx-auto mt-8 max-h-80 rounded-md border border-border bg-white shadow-md" />}
            <p className="mt-8 text-muted-foreground">Der Editor folgt in Etappe (c).</p>
          </>
        )}
      </main>
    </div>
  );
}
