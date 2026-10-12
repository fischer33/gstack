import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { DesignSummary, FolderSummary, Page, TemplateCategory, TemplateSummary } from '@designhub/shared';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Fehlercodes der API in verständliche Meldungen übersetzen. */
export function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Keine Verbindung zum Server.';
  switch (err.code) {
    case 'folder_exists': return 'Ein Ordner mit diesem Namen gibt es schon.';
    case 'invalid_folder': return 'Dieser Ordner existiert nicht (mehr).';
    case 'invalid_template': return 'Diese Vorlage existiert nicht (mehr).';
    case 'not_found': return 'Nicht gefunden. Vielleicht wurde es schon gelöscht.';
    case 'validation': return Object.values(err.fields)[0] ?? 'Ungültige Eingabe.';
    default: return 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
  }
}

// ---------- Abfragen ----------
export interface DesignQuery { q?: string; folderId?: string; trash?: boolean; sort?: 'updated' | 'title'; limit?: number }

export const useDesigns = (query: DesignQuery = {}) =>
  useQuery({ queryKey: ['designs', query], queryFn: async () => (await api<{ designs: DesignSummary[] }>(`/designs${qs({ ...query })}`)).designs });

export const useDesign = (id: string) =>
  useQuery({ queryKey: ['design', id], retry: false, queryFn: () => api<DesignSummary & { pages: Page[]; version: number }>(`/designs/${id}`) });

export const useFolders = () =>
  useQuery({ queryKey: ['folders'], queryFn: async () => (await api<{ folders: FolderSummary[] }>('/folders')).folders });

export const useTemplates = (query: { category?: string; q?: string } = {}) =>
  useQuery({ queryKey: ['templates', query], queryFn: async () => (await api<{ templates: TemplateSummary[] }>(`/templates${qs(query)}`)).templates });

export const useTemplateCategories = () =>
  useQuery({ queryKey: ['template-categories'], staleTime: 5 * 60_000, queryFn: async () => (await api<{ categories: TemplateCategory[] }>('/templates/categories')).categories });

// ---------- Änderungen ----------
/** Mutation mit einheitlicher Fehler-Toast und Cache-Invalidierung (Designs und Ordnerzähler). */
function useApiMutation<I, O>(fn: (input: I) => Promise<O>, opts: { success?: string | ((out: O) => string); invalidate?: QueryKey[] } = {}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (out) => {
      for (const key of opts.invalidate ?? [['designs'], ['folders']]) void qc.invalidateQueries({ queryKey: key });
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(out) : opts.success);
    },
    onError: (err) => toast(describeError(err), 'error'),
  });
}

export interface CreateDesignInput { width?: number; height?: number; title?: string; folderId?: string | null; templateId?: string }

export const useCreateDesign = () => useApiMutation((b: CreateDesignInput) => api<DesignSummary>('/designs', { body: b }));
export const usePatchDesign = () =>
  useApiMutation(({ id, ...patch }: { id: string; title?: string; folderId?: string | null }) => api<DesignSummary>(`/designs/${id}`, { method: 'PATCH', body: patch }), { success: 'Gespeichert' });
export const useDuplicateDesign = () => useApiMutation((id: string) => api<DesignSummary>(`/designs/${id}/duplicate`, { method: 'POST' }), { success: 'Design dupliziert' });
export const useTrashDesign = () => useApiMutation((id: string) => api(`/designs/${id}/trash`, { method: 'POST' }), { success: 'In den Papierkorb verschoben' });
export const useRestoreDesign = () => useApiMutation((id: string) => api(`/designs/${id}/restore`, { method: 'POST' }), { success: 'Wiederhergestellt' });
export const useDeleteForever = () => useApiMutation((id: string) => api(`/designs/${id}`, { method: 'DELETE' }), { success: 'Endgültig gelöscht' });
export const useEmptyTrash = () => useApiMutation(() => api<{ deleted: number }>('/designs/trash', { method: 'DELETE' }), { success: (o) => `${o.deleted} Design${o.deleted === 1 ? '' : 's'} gelöscht` });

export const useCreateFolder = () => useApiMutation((name: string) => api<FolderSummary>('/folders', { body: { name } }), { invalidate: [['folders']], success: 'Ordner erstellt' });
export const useRenameFolder = () => useApiMutation(({ id, name }: { id: string; name: string }) => api(`/folders/${id}`, { method: 'PATCH', body: { name } }), { invalidate: [['folders']], success: 'Ordner umbenannt' });
export const useDeleteFolder = () => useApiMutation((id: string) => api(`/folders/${id}`, { method: 'DELETE' }), { success: 'Ordner gelöscht' });
