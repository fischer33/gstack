import { Check, Copy, Eye, Link2Off, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { ShareLinkSummary, ShareRole } from '@designhub/shared';
import { useCreateShare, useRevokeShare, useShareLinks } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

const ROLES: { role: ShareRole; title: string; text: string; Icon: typeof Eye }[] = [
  { role: 'VIEW', title: 'Nur ansehen', text: 'Jeder mit dem Link sieht das Design, ohne Anmeldung. Ändern geht nicht.', Icon: Eye },
  { role: 'EDIT', title: 'Bearbeiten', text: 'Jeder mit dem Link kann das Design ändern, ohne Anmeldung. Gib ihn nur Menschen, denen du vertraust.', Icon: Pencil },
];

const urlOf = (l: ShareLinkSummary) => `${window.location.origin}/s/${l.token}`;

function Row({ designId, role, link }: { designId: string; role: (typeof ROLES)[number]; link?: ShareLinkSummary }) {
  const create = useCreateShare(designId);
  const revoke = useRevokeShare(designId);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(urlOf(link)); setCopied(true); setTimeout(() => setCopied(false), 2000); toast('Link kopiert'); }
    catch { toast('Kopieren nicht möglich. Markiere den Link und kopiere ihn von Hand.', 'error'); }
  };
  return (
    <section className="rounded-lg border border-border p-3" data-testid={`share-${role.role}`}>
      <h3 className="flex items-center gap-2 font-semibold"><role.Icon className="h-4 w-4" />{role.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{role.text}</p>
      {link ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input readOnly value={urlOf(link)} aria-label={`Link zum ${role.title}`} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-muted px-2 text-xs" data-testid={`share-url-${role.role}`} />
            <Button size="sm" onClick={() => void copy()} aria-label="Link kopieren">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
          </div>
          <button type="button" onClick={() => revoke.mutate(link.id)} disabled={revoke.isPending} className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline"><Link2Off className="h-3.5 w-3.5" />Link deaktivieren</button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-3" disabled={create.isPending} onClick={() => create.mutate(role.role)} data-testid={`share-create-${role.role}`}>Link erstellen</Button>
      )}
    </section>
  );
}

export default function ShareDialog({ designId, open, onClose }: { designId: string; open: boolean; onClose(): void }) {
  const links = useShareLinks(designId);
  return (
    <Dialog open={open} onClose={onClose} title="Teilen">
      <div className="space-y-3" data-testid="share-dialog">
        {links.isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p> : ROLES.map((r) => <Row key={r.role} designId={designId} role={r} link={links.data?.find((l) => l.role === r.role)} />)}
        <p className="text-xs text-muted-foreground">Ein deaktivierter Link funktioniert sofort nicht mehr. Wer ihn schon geöffnet hat, verliert den Zugriff beim nächsten Laden.</p>
      </div>
    </Dialog>
  );
}
