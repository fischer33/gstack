import { LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

/** Platzhalter bis Etappe (b): Dashboard mit Formaten, „Zuletzt bearbeitet“ und Vorlagen. */
export function AppHome() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-border px-4">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.name ?? user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => void logout()}><LogOut className="h-4 w-4" /> Abmelden</Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Hallo{user?.name ? `, ${user.name}` : ''}!</h1>
        <p className="mt-3 text-muted-foreground">Du bist angemeldet. Das Dashboard folgt in Etappe (b).</p>
      </main>
    </div>
  );
}
