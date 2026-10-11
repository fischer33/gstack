import type { Config } from 'tailwindcss';

// Eigene Identität: Violett → Türkis. Farben als CSS-Variablen (shadcn-Konvention), damit Dark Mode nur Variablen tauscht.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'system-ui', 'sans-serif'] },
      colors: {
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))', card: 'hsl(var(--card))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        accent: 'hsl(var(--accent))',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
      backgroundImage: { brand: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' },
      transitionDuration: { DEFAULT: '180ms' },
    },
  },
  plugins: [],
} satisfies Config;
