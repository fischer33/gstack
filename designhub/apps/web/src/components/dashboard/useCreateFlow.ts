import { useNavigate } from 'react-router-dom';
import { useCreateDesign } from '@/api/hooks';

/** Design anlegen (leer oder aus Vorlage) und direkt in den Editor wechseln. */
export function useCreateFlow(folderId?: string | null) {
  const navigate = useNavigate();
  const create = useCreateDesign();
  const go = (body: Parameters<typeof create.mutate>[0]) =>
    create.mutate({ ...body, folderId: folderId ?? undefined }, { onSuccess: (d) => navigate(`/design/${d.id}`) });
  return {
    pending: create.isPending,
    createBlank: (size: { width: number; height: number }) => go(size),
    createFromTemplate: (templateId: string) => go({ templateId }),
  };
}
