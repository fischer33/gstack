import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { describeError } from '@/api/hooks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <section className="rounded-lg border border-border bg-card p-5">
    <h2 className="text-lg font-semibold">{title}</h2>
    {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm font-medium">{label}<div className="mt-1.5 font-normal">{children}</div></label>
);

export function SettingsPage() {
  const { user, updateName, deleteAccount } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [delForm, setDelForm] = useState({ email: '', password: '' });
  const [delBusy, setDelBusy] = useState(false);
  if (!user) return null;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try { await updateName(name); toast('Name gespeichert'); } catch (err) { toast(describeError(err), 'error'); } finally { setSavingName(false); }
  };

  const mismatch = pw.repeat !== '' && pw.next !== pw.repeat;
  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.repeat) return;
    setPwBusy(true);
    try {
      await api('/auth/password', { body: { currentPassword: user.hasPassword ? pw.current : undefined, newPassword: pw.next } });
      toast(user.hasPassword ? 'Passwort geändert' : 'Passwort gesetzt');
      setPw({ current: '', next: '', repeat: '' });
    } catch (err) { toast(describeError(err), 'error'); } finally { setPwBusy(false); }
  };

  const removeAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDelBusy(true);
    try { await deleteAccount(delForm.email, user.hasPassword ? delForm.password : undefined); }
    catch (err) { toast(describeError(err), 'error'); setDelBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <Section title="Profil">
        <form onSubmit={(e) => void saveName(e)} className="space-y-4">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Wie sollen wir dich nennen?" data-testid="settings-name" /></Field>
          <Field label="E-Mail-Adresse"><Input value={user.email} readOnly disabled aria-describedby="email-hint" /></Field>
          <p id="email-hint" className="text-xs text-muted-foreground">Die E-Mail-Adresse kann hier nicht geändert werden.</p>
          <Button type="submit" disabled={savingName || name.trim() === (user.name ?? '')}>Speichern</Button>
        </form>
      </Section>

      <Section title="Darstellung"><ThemeToggle /></Section>

      <Section title={user.hasPassword ? 'Passwort ändern' : 'Passwort festlegen'} hint={user.hasPassword ? undefined : 'Du meldest dich bisher mit Google an. Mit einem Passwort kannst du dich zusätzlich per E-Mail anmelden.'}>
        <form onSubmit={(e) => void savePassword(e)} className="space-y-4">
          {user.hasPassword && <Field label="Aktuelles Passwort"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required data-testid="pw-current" /></Field>}
          <Field label="Neues Passwort (mindestens 8 Zeichen)"><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required data-testid="pw-new" /></Field>
          <Field label="Neues Passwort wiederholen"><Input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} aria-invalid={mismatch} required data-testid="pw-repeat" /></Field>
          {mismatch && <p role="alert" className="text-sm text-red-600">Die beiden Passwörter sind nicht gleich.</p>}
          <Button type="submit" disabled={pwBusy || mismatch || pw.next.length < 8}>Passwort speichern</Button>
        </form>
      </Section>

      <Section title="Konto löschen" hint="Löscht dein Konto mit allen Designs, Ordnern und hochgeladenen Bildern. Das kann nicht rückgängig gemacht werden.">
        <Button variant="outline" className="border-red-500/50 text-red-600 hover:bg-red-500/10" onClick={() => setDel(true)} data-testid="delete-account-open">Konto löschen…</Button>
      </Section>

      <Dialog open={del} onClose={() => setDel(false)} title="Konto endgültig löschen?">
        <form onSubmit={(e) => void removeAccount(e)} className="space-y-4" data-testid="delete-account-form">
          <p className="text-sm">Zur Bestätigung tippe deine E-Mail-Adresse <b>{user.email}</b>{user.hasPassword ? ' und dein Passwort' : ''}.</p>
          <Field label="E-Mail-Adresse"><Input type="email" value={delForm.email} onChange={(e) => setDelForm({ ...delForm, email: e.target.value })} required data-testid="delete-email" /></Field>
          {user.hasPassword && <Field label="Passwort"><Input type="password" autoComplete="current-password" value={delForm.password} onChange={(e) => setDelForm({ ...delForm, password: e.target.value })} required data-testid="delete-password" /></Field>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDel(false)}>Abbrechen</Button>
            <Button type="submit" disabled={delBusy || delForm.email.trim().toLowerCase() !== user.email} className="bg-red-600 text-white hover:bg-red-700" data-testid="delete-account-confirm">Endgültig löschen</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
