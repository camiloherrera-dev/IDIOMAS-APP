import { Export, PlusSquare, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';

const KEY = 'lingo-install-dismissed';

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** iOS no muestra aviso de instalación: explicamos Compartir → Agregar a inicio */
export function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || isStandalone() || !isIOS()) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <div className="mt-4 rounded-[var(--radius-card)] bg-surface p-4 pr-2 hairline" role="region" aria-label="Instalar la app">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold">Instala Lingo Lab</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Toca <Export size={16} weight="bold" className="inline -translate-y-px text-accent" aria-label="Compartir" /> y luego{' '}
            <PlusSquare size={16} weight="bold" className="inline -translate-y-px text-accent" aria-hidden />{' '}
            <strong className="font-semibold text-ink">Agregar a inicio</strong>. Se abrirá a pantalla completa y funcionará sin
            internet.
          </p>
        </div>
        <IconButton label="Cerrar aviso" onClick={close} className="-mt-2">
          <X size={18} />
        </IconButton>
      </div>
    </div>
  );
}
