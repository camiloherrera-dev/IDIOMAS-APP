import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** hoja inferior modal estilo iOS: arrastrar hacia abajo o tocar el fondo la cierra */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-[oklch(0.15_0.01_262/0.4)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full max-w-lg rounded-t-[1.75rem] bg-surface pb-safe outline-none shadow-[var(--shadow-lift)]"
            initial={reduce ? { opacity: 0 } : { transform: 'translateY(100%)' }}
            animate={reduce ? { opacity: 1 } : { transform: 'translateY(0%)' }}
            exit={
              reduce ? { opacity: 0 } : { transform: 'translateY(100%)', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }
            }
            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
            drag={reduce ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
          >
            <div className="cursor-grab touch-none" onPointerDown={(e) => dragControls.start(e)}>
              <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
                <div className="h-1.5 w-10 rounded-full bg-line" />
              </div>
              <h2 id={titleId} className="px-6 pt-2 pb-3 text-lg font-bold tracking-tight">
                {title}
              </h2>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto px-4 pb-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
