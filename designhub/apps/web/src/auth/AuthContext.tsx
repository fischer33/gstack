import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, UNAUTHORIZED_EVENT, api } from '@/lib/api';

export interface User { id: string; email: string; name: string | null; avatarUrl: string | null }
type Status = 'loading' | 'authed' | 'guest';

interface AuthValue {
  status: Status;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const qc = useQueryClient();

  const set = (u: User | null) => { setUser(u); setStatus(u ? 'authed' : 'guest'); };

  // Session beim Start prüfen: 401 heißt einfach "nicht angemeldet".
  useEffect(() => {
    api<{ user: User }>('/auth/me').then((r) => set(r.user)).catch((e) => {
      if (!(e instanceof ApiError)) console.error(e);
      set(null);
    });
  }, []);

  // Cache bei jedem Kontowechsel leeren, damit nie Daten eines vorherigen Nutzers sichtbar bleiben.
  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/login', { body: { email, password } });
    qc.clear(); set(user);
  }, [qc]);
  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/register', { body: { name: name || undefined, email, password } });
    qc.clear(); set(user);
  }, [qc]);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }); qc.clear(); set(null); }, [qc]);

  useEffect(() => {
    const onUnauthorized = () => { qc.clear(); set(null); };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc]);

  const value = useMemo(() => ({ status, user, login, register, logout }), [status, user, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth braucht <AuthProvider>');
  return v;
}
