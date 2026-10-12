import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { GuestOnly, RequireAuth } from '@/auth/RouteGuards';
import { AppShell } from '@/components/dashboard/AppShell';
import { ToastProvider } from '@/components/ui/toast';
import { ApiError, UNAUTHORIZED_EVENT } from '@/lib/api';
import { AuthPage } from '@/pages/AuthPage';
import { Home } from '@/pages/Home';
import { Landing } from '@/pages/Landing';
import { MyDesigns } from '@/pages/MyDesigns';
import { SearchPage } from '@/pages/SearchPage';
import { Trash } from '@/pages/Trash';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Der Editor (inkl. Konva, ~300 kB) wird erst beim Öffnen eines Designs geladen.
const SharePage = lazy(() => import('@/pages/SharePage').then((m) => ({ default: m.SharePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EditorPage = lazy(() => import('@/pages/EditorPage').then((m) => ({ default: m.EditorPage })));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Abgelaufene Sitzung mitten in der Nutzung: AuthProvider schickt zurück zum Login.
    onError: (err) => { if (err instanceof ApiError && err.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); },
  }),
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 2 },
  },
});

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route element={<GuestOnly />}>
                  <Route path="/login" element={<AuthPage mode="login" />} />
                  <Route path="/register" element={<AuthPage mode="register" />} />
                </Route>
                <Route element={<RequireAuth />}>
                  <Route path="/app" element={<AppShell />}>
                    <Route index element={<Home />} />
                    <Route path="designs" element={<MyDesigns />} />
                    <Route path="trash" element={<Trash />} />
                    <Route path="settings" element={<Suspense fallback={null}><SettingsPage /></Suspense>} />
                    <Route path="search" element={<SearchPage />} />
                  </Route>
                  <Route path="/design/:id" element={<Suspense fallback={<div className="grid min-h-screen place-items-center text-muted-foreground">Lädt…</div>}><EditorPage /></Suspense>} />
                </Route>
                <Route path="/s/:token" element={<Suspense fallback={<div className="grid min-h-screen place-items-center text-muted-foreground">Lädt…</div>}><SharePage /></Suspense>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
