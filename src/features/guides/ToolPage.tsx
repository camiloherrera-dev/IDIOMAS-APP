import { ArrowLeft, Wrench } from '@phosphor-icons/react';
import { Suspense } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { useActiveLanguage } from '@/hooks/useLanguage';

export function ToolPage() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const { lang } = useActiveLanguage();
  const tool = lang?.tools?.find((t) => t.id === toolId);

  if (!lang) return <ScreenSkeleton />;
  if (!tool) {
    return (
      <EmptyState
        icon={<Wrench size={26} weight="fill" />}
        title="Herramienta no disponible"
        body={`${lang.name} no tiene esta herramienta.`}
        action={<Button onClick={() => navigate('/guias')}>Ver guías</Button>}
      />
    );
  }

  const Tool = tool.Component;
  return (
    <div>
      <header className="pt-safe flex items-center gap-1 px-3 pb-2">
        <IconButton label="Volver" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
        <h1 className="text-xl font-bold tracking-tight">{tool.title}</h1>
      </header>
      <div className="px-5 pt-2 pb-6">
        <Suspense fallback={<ScreenSkeleton />}>
          <Tool lang={lang} />
        </Suspense>
      </div>
    </div>
  );
}
