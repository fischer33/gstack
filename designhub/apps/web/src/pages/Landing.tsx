import { Download, Layers, LayoutTemplate, MousePointer2, Palette, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/utils';

const FEATURES = [
  { Icon: LayoutTemplate, title: 'Vorlagen für alles', text: 'Posts, Stories, Folien, Poster und Visitenkarten. Ein Klick, und du hast einen Startpunkt.' },
  { Icon: MousePointer2, title: 'Drag & Drop', text: 'Verschieben, skalieren, drehen. Hilfslinien rasten Elemente exakt ein.' },
  { Icon: Layers, title: 'Ebenen und Seiten', text: 'Mehrseitige Designs, Gruppen und volle Kontrolle über die Reihenfolge.' },
  { Icon: Palette, title: 'Deine Farben, deine Schriften', text: 'Über 30 Schriften, Verläufe und Farbpaletten für einen einheitlichen Look.' },
  { Icon: Download, title: 'Export in jedes Format', text: 'PNG, JPG, SVG oder PDF, in der Qualität, die du brauchst.' },
  { Icon: Share2, title: 'Teilen per Link', text: 'Schick eine Ansicht oder lade andere zum Bearbeiten ein.' },
];

export function Landing() {
  const { status } = useAuth();
  const authed = status === 'authed';
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {authed ? (
              <Link to="/app" className={buttonVariants({ size: 'sm' })}>Zu deinen Designs</Link>
            ) : (
              <>
                <Link to="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>Anmelden</Link>
                <Link to="/register" className={buttonVariants({ size: 'sm' })}><span className="sm:hidden">Starten</span><span className="hidden sm:inline">Kostenlos starten</span></Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-brand opacity-10 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Gestalte, was du dir vorstellst.{' '}
              <span className="bg-brand bg-clip-text text-transparent">Direkt im Browser.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              DesignHub ist der Grafikeditor für Social-Media-Posts, Präsentationen und Drucksachen. Ohne Installation, ohne Vorkenntnisse.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={authed ? '/app' : '/register'} className={buttonVariants({ size: 'lg' })}>Design erstellen</Link>
              <a href="#features" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Mehr erfahren</a>
            </div>
            <EditorPreview />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24">
          <h2 className="text-center text-3xl font-bold tracking-tight">Alles, was du zum Gestalten brauchst</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-brand text-primary-foreground"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} DesignHub</footer>
    </div>
  );
}

/** Rein dekorative Skizze des Editors (keine echte Funktion). */
function EditorPreview() {
  return (
    <div aria-hidden className="mx-auto mt-16 grid max-w-4xl grid-cols-[3rem_1fr_3rem] gap-3 rounded-lg border border-border bg-card p-3 shadow-xl sm:grid-cols-[6rem_1fr_6rem]">
      <div className="space-y-2 rounded-md bg-muted p-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-border" />)}</div>
      <div className="grid place-items-center rounded-md bg-muted p-6">
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded bg-gradient-to-br from-primary to-accent shadow-lg">
          <div className="absolute left-6 top-6 h-4 w-2/3 rounded bg-white/90" />
          <div className="absolute left-6 top-14 h-3 w-1/2 rounded bg-white/60" />
          <div className="absolute bottom-6 right-6 h-20 w-20 rotate-12 rounded-full bg-white/30" />
          <div className="absolute inset-x-10 bottom-10 top-1/2 rounded border-2 border-white/80"><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white" /><span className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-white" /></div>
        </div>
      </div>
      <div className="space-y-2 rounded-md bg-muted p-2">{[0, 1, 2].map((i) => <div key={i} className="h-5 rounded bg-border" />)}</div>
    </div>
  );
}
