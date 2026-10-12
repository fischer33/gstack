import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { THEME_KEY, parsePref, resolveTheme, type ThemePref } from './theme';

const Ctx = createContext<{ pref: ThemePref; setPref(p: ThemePref): void } | null>(null);
const read = () => { try { return parsePref(localStorage.getItem(THEME_KEY)); } catch { return 'system' as const; } };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>(read);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', resolveTheme(pref, mq.matches) === 'dark');
    apply();
    mq.addEventListener('change', apply);
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* Speicher gesperrt: Wahl gilt nur für diese Sitzung */ }
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  return <Ctx.Provider value={{ pref, setPref }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme braucht <ThemeProvider>');
  return v;
}
