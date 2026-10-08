import { WarningOctagon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function ContentError({ message }: { message: string }) {
  return (
    <div className="pt-safe">
      <EmptyState
        icon={<WarningOctagon size={28} weight="fill" />}
        title="No se pudo cargar el curso"
        body={`El contenido de este idioma tiene un error. ${message.slice(0, 160)}`}
        action={
          <Button variant="secondary" onClick={() => location.reload()}>
            Reintentar
          </Button>
        }
      />
    </div>
  );
}
