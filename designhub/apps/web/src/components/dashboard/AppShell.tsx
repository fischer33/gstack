import { FolderPlus, Folder, Home as HomeIcon, Images, LogOut, Menu as MenuIcon, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useCreateFolder, useFolders } from '@/api/hooks';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/utils';
import { CreateDesignDialog } from './CreateDesignDialog';
import { PromptDialog } from './dialogs';
import { useCreateFlow } from './useCreateFlow';

export interface ShellContext {
  openCreate(opts?: { custom?: boolean }): void;
  createBlank(size: { width: number; height: number }): void;
  createFromTemplate(id: string): void;
  creating: boolean;
}
export const useShell = () => useOutletContext<ShellContext>();

const link = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted', isActive && 'bg-muted text-primary');

/** Rahmen aller Dashboard-Seiten: Seitenleiste, Kopfzeile mit Suche, "Design erstellen". */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();

  const [drawer, setDrawer] = useState(false);
  const [creating, setCreating] = useState<{ custom: boolean } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');

  // In einer Ordneransicht landen neue Designs direkt in diesem Ordner.
  const activeFolder = location.pathname === '/app/designs' ? params.get('folder') : null;
  const flow = useCreateFlow(activeFolder && activeFolder !== 'root' ? activeFolder : null);

  useEffect(() => setDrawer(false), [location.pathname, location.search]); // Drawer nach Navigation schließen
  useEffect(() => { if (location.pathname !== '/app/search') setQ(''); }, [location.pathname]);

  const search = (e: FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/app/search?q=${encodeURIComponent(q.trim())}`); };
  const ctx: ShellContext = {
    openCreate: (opts) => setCreating({ custom: !!opts?.custom }),
    createBlank: flow.createBlank,
    createFromTemplate: flow.createFromTemplate,
    creating: flow.pending,
  };
  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label="Hauptnavigation">
      <NavLink to="/app" end className={link}><HomeIcon className="h-4 w-4" /> Start</NavLink>
      <NavLink to="/app/designs" end className={({ isActive }) => link({ isActive: isActive && !params.get('folder') })}><Images className="h-4 w-4" /> Meine Designs</NavLink>
      <NavLink to="/app/trash" className={link}><Trash2 className="h-4 w-4" /> Papierkorb</NavLink>
      <NavLink to="/app/settings" className={link}><Settings className="h-4 w-4" /> Einstellungen</NavLink>

      <div className="mt-6 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ordner
        <button onClick={() => setNewFolder(true)} aria-label="Neuer Ordner" className="grid h-6 w-6 place-items-center rounded-sm hover:bg-muted hover:text-foreground"><FolderPlus className="h-4 w-4" /></button>
      </div>
      {folders.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Noch keine Ordner.</p>}
      {folders.map((f) => (
        <NavLink key={f.id} to={`/app/designs?folder=${f.id}`}
          className={() => link({ isActive: location.pathname === '/app/designs' && params.get('folder') === f.id })}>
          <Folder className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">{f.designCount}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
        <button onClick={() => setDrawer(true)} aria-label="Menü öffnen" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted lg:hidden"><MenuIcon className="h-5 w-5" /></button>
        <NavLink to="/app" className="hidden sm:block lg:w-48"><Logo /></NavLink>

        <form onSubmit={search} role="search" className="relative mx-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Designs und Vorlagen suchen" aria-label="Suche" className="pl-9" maxLength={100} />
        </form>

        <Button onClick={() => ctx.openCreate()} className="shrink-0"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Design erstellen</span><span className="sm:hidden">Neu</span></Button>
        <span className="hidden sm:block"><ThemeToggle /></span>
        <Menu label="Konto" trigger={<span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-primary-foreground">{initial}</span>}
          items={[{ label: 'Einstellungen', icon: <Settings className="h-4 w-4" />, onSelect: () => navigate('/app/settings') }, { label: `Abmelden (${user?.email})`, icon: <LogOut className="h-4 w-4" />, onSelect: () => void logout() }]} />
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button aria-label="Menü schließen" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <aside className="relative h-full w-64 bg-background shadow-xl">
              <button onClick={() => setDrawer(false)} aria-label="Menü schließen" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
              <div className="px-4 pt-4"><Logo /></div>
              {sidebar}
              <div className="p-4"><ThemeToggle /></div>
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8"><Outlet context={ctx} /></main>
      </div>

      <CreateDesignDialog open={!!creating} startCustom={creating?.custom} onClose={() => setCreating(null)} busy={flow.pending} onCreate={flow.createBlank} />
      <PromptDialog open={newFolder} onClose={() => setNewFolder(false)} title="Neuer Ordner" label="Name" confirmLabel="Erstellen" busy={createFolder.isPending}
        onSubmit={(name) => createFolder.mutate(name, { onSuccess: (f) => { setNewFolder(false); navigate(`/app/designs?folder=${f.id}`); } })} />
    </div>
  );
}
