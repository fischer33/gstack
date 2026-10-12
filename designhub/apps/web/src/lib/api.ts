/** Fehler vom Server: HTTP-Status, Fehlercode und ggf. Feldfehler (bei `validation`). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public fields: Record<string, string> = {}) {
    super(code);
  }
}

/** Dünner Fetch-Wrapper. Cookies laufen same-origin (Vite-Proxy bzw. gleiche Domain in Produktion). */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'unknown', data.fields);
  return data as T;
}
