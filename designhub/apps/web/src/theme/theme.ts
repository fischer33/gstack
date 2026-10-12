export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = 'dh-theme';

/** Welches Theme gilt tatsächlich? "system" folgt der Betriebssystem-Einstellung. */
export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' =>
  pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

export const parsePref = (raw: string | null): ThemePref => (raw === 'light' || raw === 'dark' ? raw : 'system');
