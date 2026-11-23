import { ArrowLeft, Flag, Target } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { lessonsForSkill } from '@/core/lessons';
import { flagSkill } from '@/core/skills';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { GuideBody } from './GuideBody';

export function GuidePage() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const { lang, content } = useActiveLanguage();
  const guide = content?.guides.find((g) => g.id === guideId);

  const practice = Boolean(content && guide && lessonsForSkill(content, guide.id).some((l) => l.sentences.length > 0));

  if (!lang || !content) return <ScreenSkeleton />;
  if (!guide) {
    return (
      <EmptyState
        icon={<ArrowLeft size={26} />}
        title="Guía no encontrada"
        body="Esta guía no existe en el idioma activo."
        action={<Button onClick={() => navigate('/guias')}>Ver guías</Button>}
      />
    );
  }

  return (
    <article>
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-3 pb-1 backdrop-blur-lg">
        <IconButton label="Volver" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
      </header>
      <div className="px-5 pb-8">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight text-balance">{guide.title}</h1>
        <p className="mt-2 text-lg text-ink-2">{guide.summary}</p>
        {guide.level && (
          <span className="mt-3 inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            Nivel {guide.level}
          </span>
        )}
        {practice && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button onClick={() => navigate(`/refuerzo/${guide.id}`)}>
              <Target size={18} weight="bold" />
              Practicar este punto
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void flagSkill(lang.id, guide.id).then(() =>
                  toast.success('Marcado como punto débil. Aparecerá en Hoy hasta que lo domines.'),
                )
              }
            >
              <Flag size={18} weight="bold" />
              Me cuesta
            </Button>
          </div>
        )}
        <GuideBody body={guide.body} lang={lang} className="mt-6" />
      </div>
    </article>
  );
}
