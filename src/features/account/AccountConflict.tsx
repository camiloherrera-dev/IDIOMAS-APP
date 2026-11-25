import { Sheet } from '@/components/ui/Sheet';
import { useState } from 'react';
import { ConflictContent } from './AccountPage';

/** aviso global cuando la sesión es de una cuenta distinta a la dueña de los datos locales */
export function AccountConflict() {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Otra cuenta en este dispositivo">
      <ConflictContent onDone={() => setOpen(false)} />
    </Sheet>
  );
}
