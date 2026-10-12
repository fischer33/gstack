import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { describeAuthError, type FormErrors } from '@/auth/errors';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** Gemeinsame Seite für Anmelden und Registrieren. */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const [params] = useSearchParams();
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(params.get('error') === 'google' ? { fields: {}, form: 'Die Anmeldung mit Google ist fehlgeschlagen. Bitte versuche es erneut.' } : { fields: {} });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ google: boolean }>('/auth/providers').then((p) => setGoogleEnabled(p.google)).catch(() => setGoogleEnabled(false));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [name, email, password] = ['name', 'email', 'password'].map((k) => String(f.get(k) ?? ''));
    setBusy(true);
    setErrors({ fields: {} });
    try {
      // Bei Erfolg wechselt GuestOnly automatisch nach /app.
      await (isRegister ? register(name, email, password) : login(email, password));
    } catch (err) {
      setErrors(describeAuthError(err));
      setBusy(false);
    }
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <Input id={name} name={name} aria-invalid={!!errors.fields[name]} aria-describedby={errors.fields[name] ? `${name}-err` : undefined} {...props} />
      {errors.fields[name] && <p id={`${name}-err`} className="text-sm text-red-500">{errors.fields[name]}</p>}
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between"><Link to="/"><Logo /></Link><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold tracking-tight">{isRegister ? 'Konto erstellen' : 'Willkommen zurück'}</h1>
          <p className="mt-2 text-muted-foreground">{isRegister ? 'Kostenlos starten, ohne Kreditkarte.' : 'Melde dich an, um deine Designs zu öffnen.'}</p>

          {googleEnabled && (
            <>
              <a href="/api/auth/google" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-8 w-full')}><GoogleG /> Mit Google fortfahren</a>
              <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />oder<span className="h-px flex-1 bg-border" /></div>
            </>
          )}

          <form onSubmit={onSubmit} noValidate className={cn('space-y-4', !googleEnabled && 'mt-8')}>
            {errors.form && <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{errors.form}</div>}
            {isRegister && field('name', 'Name (optional)', { autoComplete: 'name', maxLength: 80 })}
            {field('email', 'E-Mail', { type: 'email', autoComplete: 'email', required: true, placeholder: 'du@beispiel.de' })}
            {field('password', 'Passwort', { type: 'password', autoComplete: isRegister ? 'new-password' : 'current-password', required: true, minLength: isRegister ? 8 : undefined, placeholder: isRegister ? 'Mindestens 8 Zeichen' : undefined })}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Einen Moment…' : isRegister ? 'Registrieren' : 'Anmelden'}</Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? 'Schon ein Konto?' : 'Noch kein Konto?'}{' '}
            <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-primary hover:underline">{isRegister ? 'Anmelden' : 'Registrieren'}</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand lg:block" aria-hidden>
        <div className="absolute -left-20 top-24 h-80 w-80 rounded-full bg-white/15" />
        <div className="absolute bottom-16 right-10 h-64 w-64 rotate-12 rounded-3xl bg-white/20" />
        <div className="absolute inset-0 grid place-items-center p-16"><p className="max-w-sm text-4xl font-bold leading-tight text-white">Aus Ideen werden Designs, in Minuten.</p></div>
      </div>
    </div>
  );
}
