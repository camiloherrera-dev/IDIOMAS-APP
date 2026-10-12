import { ArrowsClockwise, CloudCheck, CloudSlash, CloudWarning, Copy, LinkSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { deleteCloudData, disableSync, enableSync, linkSync, syncNow, useSyncStore } from '@/db/sync';

function timeAgo(ts: number | null): string {
  if (!ts) return 'nunca';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** tarjeta de "Sincronización en la nube" dentro de Ajustes */
export function SyncSection() {
  const { code, lastSyncAt, state, error } = useSyncStore();
  const [linking, setLinking] = useState(false);
  const [input, setInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'unlink' | 'delete' | null>(null);
  const busy = state === 'syncing';

  const Icon = !code ? CloudSlash : state === 'error' ? CloudWarning : CloudCheck;

  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon
          size={22}
          weight="fill"
          className={!code ? 'text-ink-3' : state === 'error' ? 'text-warn' : 'text-ok'}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{code ? 'Sincronización activada' : 'Sincronización desactivada'}</p>
          <p className="text-sm text-ink-3">
            {code
              ? `Tu progreso se guarda en la nube. Última vez: ${busy ? 'sincronizando…' : timeAgo(lastSyncAt)}.`
              : 'Guarda tu progreso en la nube y úsalo en el iPhone y en el computador con el mismo código.'}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm font-medium text-bad">
              {error}
            </p>
          )}

          {code ? (
            <>
              <div className="mt-3 flex items-center gap-2 rounded-[0.8rem] bg-sunken px-3 py-2">
                <code className="min-w-0 flex-1 font-mono text-[0.9rem] font-semibold tracking-wide break-all">{code}</code>
                <button
                  type="button"
                  aria-label="Copiar código"
                  className="pressable flex size-10 items-center justify-center rounded-full text-accent"
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(code)
                      .then(() => toast.success('Código copiado'))
                      .catch(() => toast('Cópialo a mano: ' + code))
                  }
                >
                  <Copy size={20} weight="bold" />
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Guárdalo en un lugar seguro: quien lo tenga puede ver y cambiar tu progreso. Para usarlo en otro dispositivo, ve a
                Ajustes y toca "Ya tengo un código".
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (await syncNow()) toast.success('Progreso sincronizado');
                  }}
                >
                  <ArrowsClockwise size={16} weight="bold" className={busy ? 'animate-spin' : undefined} />
                  Sincronizar ahora
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm('unlink')}>
                  Desvincular
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  if (await enableSync()) toast.success('Sincronización activada');
                }}
              >
                {busy ? 'Activando…' : 'Activar'}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setLinking(true)}>
                <LinkSimple size={16} weight="bold" /> Ya tengo un código
              </Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={linking} onClose={() => setLinking(false)} title="Vincular con tu código">
        <form
          className="flex flex-col gap-4 px-2 pb-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLinkError(null);
            const r = await linkSync(input);
            if (r.ok) {
              toast.success('Dispositivo vinculado: progreso descargado');
              setLinking(false);
              setInput('');
            } else setLinkError(r.error ?? 'No se pudo vincular.');
          }}
        >
          <p className="text-ink-2">
            Escribe el código que aparece en Ajustes del otro dispositivo. Tu progreso de aquí y el de la nube se combinan.
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
          {linkError && (
            <p role="alert" className="text-sm font-medium text-bad">
              {linkError}
            </p>
          )}
          <Button size="lg" type="submit" disabled={busy || !input.trim()}>
            {busy ? 'Vinculando…' : 'Vincular'}
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'delete' ? '¿Borrar los datos de la nube?' : '¿Desvincular este dispositivo?'}
      >
        <p className="px-2 pb-5 text-ink-2">
          {confirm === 'delete'
            ? 'Se borra la copia de la nube para este código. Los datos de este dispositivo se conservan, pero los otros dispositivos dejarán de sincronizarse.'
            : 'Este dispositivo deja de sincronizarse, pero conserva sus datos. La copia de la nube sigue ahí y puedes volver a vincularte con el mismo código.'}
        </p>
        <div className="grid gap-2.5 pb-2">
          {confirm === 'unlink' && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                disableSync();
                setConfirm(null);
                toast('Dispositivo desvinculado');
              }}
            >
              Desvincular
            </Button>
          )}
          {confirm === 'unlink' && (
            <Button size="lg" variant="danger" onClick={() => setConfirm('delete')}>
              Borrar también la copia de la nube
            </Button>
          )}
          {confirm === 'delete' && (
            <Button
              size="lg"
              variant="bad"
              onClick={async () => {
                const ok = await deleteCloudData();
                setConfirm(null);
                toast(ok ? 'Copia de la nube borrada' : 'No se pudo borrar. Revisa tu conexión.');
              }}
            >
              Borrar copia de la nube
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={() => setConfirm(null)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
