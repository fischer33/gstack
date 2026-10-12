import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const Splash = () => <div className="min-h-screen grid place-items-center text-muted-foreground">Lädt…</div>;

/** Nur für angemeldete Nutzer. */
export function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return status === 'authed' ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Login/Registrierung: Angemeldete gehen direkt in die App. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return status === 'guest' ? <Outlet /> : <Navigate to="/app" replace />;
}
