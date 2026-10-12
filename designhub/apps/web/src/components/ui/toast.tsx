import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Kind = 'info' | 'error';
interface Item { id: number; message: string; kind: Kind }
const Ctx = createContext<{ toast(message: string, kind?: Kind): void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(0);
  const toast = useCallback((message: string, kind: Kind = 'info') => {
    const id = ++next.current;
    setItems((x) => [...x, { id, message, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {/* aria-live: Screenreader lesen neue Meldungen vor */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((i) => (
          <div key={i.id} role={i.kind === 'error' ? 'alert' : 'status'}
            className={cn('pointer-events-auto rounded-md px-4 py-2.5 text-sm font-medium shadow-lg', i.kind === 'error' ? 'bg-red-600 text-white' : 'bg-foreground text-background')}>
            {i.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast braucht <ToastProvider>');
  return v;
}
