import { CaretRight, CloudCheck, CloudSlash, CloudWarning, UserCircle } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useAccount } from '@/core/account/store';
import { useAccountSync } from '@/db/sync/account';

/** fila de Ajustes y Perfil que lleva a la cuenta */
export function AccountRow() {
  const { status, user, offline } = useAccount();
  const { state } = useAccountSync();
  if (status === 'loading' || status === 'unavailable') return null;

  const signedIn = status === 'signedIn';
  const warn = status === 'conflict' || state === 'error' || state === 'auth';
  const Icon = !signedIn
    ? status === 'conflict'
      ? CloudWarning
      : UserCircle
    : warn
      ? CloudWarning
      : offline
        ? CloudSlash
        : CloudCheck;
  const title = signedIn
    ? user?.name || user?.email || 'Tu cuenta'
    : status === 'conflict'
      ? 'Revisa tu cuenta'
      : 'Crea una cuenta';
  const detail = signedIn
    ? state === 'auth'
      ? 'La sesión venció: vuelve a entrar para sincronizar.'
      : state === 'error'
        ? 'No se pudo sincronizar. Toca para ver el detalle.'
        : offline
          ? 'Sin conexión: se sincroniza al volver.'
          : `${user?.email ?? ''} · progreso guardado en la nube`
    : status === 'conflict'
      ? 'Este dispositivo tiene el progreso de otra cuenta.'
      : 'Guarda tu progreso y úsalo en el iPhone y en el computador.';

  return (
    <Link to="/cuenta" className="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/60">
      <Icon size={22} weight="fill" className={warn ? 'text-warn' : signedIn ? 'text-ok' : 'text-accent'} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block text-sm text-ink-3">{detail}</span>
      </span>
      <CaretRight size={18} className="text-ink-3" aria-hidden />
    </Link>
  );
}

/** la misma fila dentro de una tarjeta (Perfil) */
export function AccountCard() {
  const status = useAccount((s) => s.status);
  if (status === 'loading' || status === 'unavailable') return null;
  return (
    <div className="card overflow-hidden">
      <AccountRow />
    </div>
  );
}
