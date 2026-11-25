import {
  ArrowLeft,
  ArrowsClockwise,
  CloudCheck,
  CloudSlash,
  CloudWarning,
  GoogleLogo,
  Key,
  LinkSimple,
  SignOut,
  Trash,
  UserCircle,
} from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import {
  changePassword,
  deleteAccount,
  importLegacyCode,
  replaceDeviceData,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  useAccount,
} from '@/core/account';
import { db } from '@/db';
import { normalizeSyncCode } from '@/db/sync';
import { countPending, syncAccount, useAccountSync } from '@/db/sync/account';
import { useProfile } from '@/hooks/useProfile';
import { Field, FormError, PasswordField } from './fields';

function timeAgo(ts: number | null): string {
  if (!ts) return 'todavía no';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** ruta a la que se vuelve después de entrar */
function useAfterAuth() {
  const navigate = useNavigate();
  const profile = useProfile();
  return async () => {
    // en un dispositivo nuevo, baja el progreso antes de seguir (nunca si los datos son de otra cuenta)
    if (useAccount.getState().status === 'signedIn') await syncAccount();
    const p = await db.profile.get('me');
    navigate(p?.onboarded || profile?.onboarded ? '/' : '/bienvenida', { replace: true });
  };
}

function AuthForms() {
  const { google } = useAccount();
  const profile = useProfile();
  const afterAuth = useAfterAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') ? 'No se pudo entrar con Google. Inténtalo de nuevo.' : null,
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = mode === 'signin' ? await signIn(email, password) : await signUp(name, email, password);
    if (r.ok) {
      toast.success(mode === 'signin' ? 'Sesión iniciada' : 'Cuenta creada');
      await afterAuth();
    } else {
      setError(r.error);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Tu cuenta</h1>
        <p className="mt-2 text-ink-2">
          Guarda tu progreso en la nube y úsalo en el iPhone y en el computador. Sin cuenta, la app funciona igual, pero solo en
          este dispositivo.
        </p>
      </div>

      <Segmented
        label="Elige"
        value={mode}
        onChange={(v) => {
          setMode(v);
          setError(null);
        }}
        options={[
          { value: 'signin', label: 'Iniciar sesión' },
          { value: 'signup', label: 'Crear cuenta' },
        ]}
      />

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {mode === 'signup' && <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
        <Field
          label="Correo"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
        />
        <PasswordField
          label="Contraseña"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          hint={mode === 'signup' ? 'Mínimo 8 caracteres.' : undefined}
        />
        <FormError>{error}</FormError>
        <Button size="lg" type="submit" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Button>
      </form>

      {google && (
        <>
          <div className="flex items-center gap-3 text-sm text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
          </div>
          <Button
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setError(null);
              const r = await signInWithGoogle();
              if (!r.ok) setError(r.error);
            }}
          >
            <GoogleLogo size={20} weight="bold" /> Continuar con Google
          </Button>
        </>
      )}

      <p className="text-xs text-ink-3">
        Si ya usabas la app sin cuenta, tu progreso de este dispositivo se combina con el de la cuenta al entrar.
      </p>
    </div>
  );
}

function SignedIn() {
  const { user, offline } = useAccount();
  const { state, lastSyncAt, error } = useAccountSync();
  const navigate = useNavigate();
  const pending = useLiveQuery(() => countPending(), [lastSyncAt]);
  const [sheet, setSheet] = useState<'signout' | 'delete' | 'password' | 'code' | null>(null);
  const busy = state === 'syncing';
  const Icon = state === 'error' || state === 'auth' ? CloudWarning : CloudCheck;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <UserCircle size={32} weight="fill" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{user?.name || 'Tu cuenta'}</h1>
          <p className="truncate text-ink-2">{user?.email}</p>
        </div>
      </div>

      <section className="card flex items-start gap-3 px-4 py-4" aria-label="Sincronización">
        <Icon size={24} weight="fill" className={state === 'error' || state === 'auth' ? 'text-warn' : 'text-ok'} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{offline ? 'Sin conexión' : busy ? 'Sincronizando…' : 'Progreso guardado en tu cuenta'}</p>
          <p className="text-sm text-ink-3">
            Última sincronización: {timeAgo(lastSyncAt)}.{' '}
            {pending ? `${pending} cambio${pending === 1 ? '' : 's'} por subir.` : 'Nada pendiente.'}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm font-medium text-bad">
              {error}
            </p>
          )}
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (await syncAccount()) toast.success('Progreso sincronizado');
            }}
          >
            <ArrowsClockwise size={16} weight="bold" className={busy ? 'animate-spin' : undefined} /> Sincronizar ahora
          </Button>
        </div>
      </section>

      <section className="card divide-y divide-line overflow-hidden" aria-label="Opciones de la cuenta">
        {[
          {
            icon: LinkSimple,
            label: 'Importar un código de sincronización',
            hint: 'Del sistema anterior',
            on: () => setSheet('code'),
          },
          { icon: Key, label: 'Cambiar contraseña', on: () => setSheet('password') },
          { icon: SignOut, label: 'Cerrar sesión', on: () => setSheet('signout') },
          { icon: Trash, label: 'Borrar mi cuenta', danger: true, on: () => setSheet('delete') },
        ].map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={row.on}
            className={`pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-sunken/60 ${row.danger ? 'text-bad' : ''}`}
          >
            <row.icon size={22} />
            <span className="flex-1">
              <span className="block font-semibold">{row.label}</span>
              {row.hint && <span className="block text-sm text-ink-3">{row.hint}</span>}
            </span>
          </button>
        ))}
      </section>

      <SignOutSheet
        open={sheet === 'signout'}
        onClose={() => setSheet(null)}
        onDone={() => navigate('/ajustes', { replace: true })}
      />
      <DeleteSheet open={sheet === 'delete'} onClose={() => setSheet(null)} />
      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} />
      <CodeSheet open={sheet === 'code'} onClose={() => setSheet(null)} />
    </div>
  );
}

function SignOutSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (wipe: boolean) => {
    setBusy(true);
    await signOut(wipe);
    setBusy(false);
    onClose();
    toast(wipe ? 'Sesión cerrada y datos borrados de este dispositivo' : 'Sesión cerrada');
    if (wipe) window.location.assign(import.meta.env.BASE_URL);
    else onDone();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Cerrar sesión">
      <p className="px-2 pb-5 text-ink-2">
        Antes de salir se sube lo que falte. ¿Qué hacemos con el progreso de este dispositivo?
      </p>
      <div className="grid gap-2.5 pb-2">
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => run(false)}>
          Dejarlo en este dispositivo
        </Button>
        <Button size="lg" variant="danger" disabled={busy} onClick={() => run(true)}>
          Borrarlo de este dispositivo
        </Button>
        <p className="px-2 text-xs text-ink-3">Borrarlo sirve en un computador prestado. Tu cuenta conserva todo.</p>
        <Button size="lg" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="¿Borrar tu cuenta?">
      <form
        className="flex flex-col gap-4 px-2 pb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const r = await deleteAccount(password || undefined);
          setBusy(false);
          if (r.ok) {
            toast('Cuenta borrada. Tu progreso sigue en este dispositivo.');
            onClose();
          } else setError(r.error);
        }}
      >
        <p className="text-ink-2">
          Se borran la cuenta y su copia en la nube. El progreso de este dispositivo se conserva; el de otros dispositivos deja de
          sincronizarse. No se puede deshacer.
        </p>
        <PasswordField
          label="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          hint="Si entras con Google, déjala vacía."
        />
        <Field
          label='Escribe "BORRAR" para confirmar'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoCapitalize="characters"
        />
        <FormError>{error}</FormError>
        <Button size="lg" variant="bad" type="submit" disabled={busy || confirm.trim().toUpperCase() !== 'BORRAR'}>
          {busy ? 'Borrando…' : 'Borrar mi cuenta'}
        </Button>
      </form>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Cambiar contraseña">
      <form
        className="flex flex-col gap-4 px-2 pb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const r = await changePassword(current, next);
          setBusy(false);
          if (r.ok) {
            toast.success('Contraseña cambiada. Las otras sesiones se cerraron.');
            setCurrent('');
            setNext('');
            onClose();
          } else setError(r.error);
        }}
      >
        <PasswordField
          label="Contraseña actual"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
        <PasswordField
          label="Contraseña nueva"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          hint="Mínimo 8 caracteres. Las otras sesiones se cierran."
        />
        <FormError>{error}</FormError>
        <Button size="lg" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </Sheet>
  );
}

function CodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Importar un código">
      <form
        className="flex flex-col gap-4 px-2 pb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const code = normalizeSyncCode(input);
          if (!code) return setError('El código tiene 20 letras y números, como ABCD-EFGH-JKLM-NPQR-STUV.');
          setBusy(true);
          setError(null);
          const r = await importLegacyCode(code);
          setBusy(false);
          if (r.ok) {
            toast.success(`Progreso importado (${r.imported} registros)`);
            setInput('');
            onClose();
          } else setError(r.error);
        }}
      >
        <p className="text-ink-2">
          Si usabas la sincronización con código, escríbelo aquí: ese progreso pasa a tu cuenta y el código deja de funcionar.
        </p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ABCD-EFGH-JKLM-NPQR-STUV"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Código de sincronización"
          className="h-12 rounded-[0.8rem] bg-sunken px-3 font-mono text-base tracking-wider text-ink uppercase outline-none placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
        />
        <FormError>{error}</FormError>
        <Button size="lg" type="submit" disabled={busy || !input.trim()}>
          {busy ? 'Importando…' : 'Importar'}
        </Button>
      </form>
    </Sheet>
  );
}

/** otra cuenta ya tiene progreso en este dispositivo */
export function ConflictContent({ onDone }: { onDone?: () => void }) {
  const { user } = useAccount();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-4 px-2 pb-3">
      <p className="text-ink-2">
        Este dispositivo tiene el progreso de otra cuenta. Para entrar como <strong className="text-ink">{user?.email}</strong>{' '}
        hay que borrar ese progreso de aquí (sigue guardado en la otra cuenta).
      </p>
      <Button
        size="lg"
        variant="danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await replaceDeviceData();
          await syncAccount();
          setBusy(false);
          onDone?.();
          window.location.assign(import.meta.env.BASE_URL);
        }}
      >
        {busy ? 'Un momento…' : 'Borrar y usar esta cuenta'}
      </Button>
      <Button
        size="lg"
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          await signOut(false);
          onDone?.();
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

function Downloading() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center" role="status">
      <ArrowsClockwise size={36} className="animate-spin text-accent" aria-hidden />
      <p className="text-lg font-semibold">Trayendo tu progreso…</p>
      <p className="max-w-[32ch] text-ink-2">La primera vez puede tardar unos segundos. No cierres la app.</p>
    </div>
  );
}

export function AccountPage() {
  const { status } = useAccount();
  const { state, lastSyncAt } = useAccountSync();
  // primera sincronización de este dispositivo con la cuenta
  const firstSync = state === 'syncing' && !lastSyncAt;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // vuelta desde Google: limpia la URL
  useEffect(() => {
    if (status === 'signedIn' && params.has('error')) setParams({}, { replace: true });
  }, [status, params, setParams]);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <header className="pt-safe flex items-center gap-1 px-3 pb-1">
        <IconButton label="Volver" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
      </header>
      <main className="px-5 pt-2 pb-10">
        {status === 'loading' && <ScreenSkeleton />}
        {status === 'unavailable' && (
          <EmptyState
            icon={<CloudSlash size={28} weight="fill" />}
            title="Las cuentas no están disponibles aquí"
            body="Esta versión de la app no tiene servidor (por ejemplo, la de GitHub Pages) o el servidor aún no tiene configuradas las cuentas. Tu progreso sigue guardado en este dispositivo."
            action={
              import.meta.env.VITE_APP_URL ? (
                <Button onClick={() => window.location.assign(import.meta.env.VITE_APP_URL)}>Abrir la versión con cuentas</Button>
              ) : undefined
            }
          />
        )}
        {status === 'signedOut' && <AuthForms />}
        {status === 'signedIn' && (firstSync ? <Downloading /> : <SignedIn />)}
        {status === 'conflict' && (
          <div className="flex flex-col gap-4">
            <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Otra cuenta en este dispositivo</h1>
            <ConflictContent />
          </div>
        )}
      </main>
    </div>
  );
}
