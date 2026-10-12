import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePref } from '@/theme/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Hell', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dunkel', Icon: Moon },
];

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Farbschema" className="inline-flex rounded-md border border-border bg-card p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value} role="radio" aria-checked={pref === value} aria-label={label} title={label}
          onClick={() => setPref(value)}
          className={cn('grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground',
            pref === value && 'bg-muted text-foreground')}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
