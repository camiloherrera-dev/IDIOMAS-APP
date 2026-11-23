import { Target } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { buildSkillSession, lessonsForSkill, type SessionItem } from '@/core/lessons';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { completePractice } from '../session/complete';
import { SessionPlayer, type SessionSummary } from '../session/SessionPlayer';
import { SessionSummaryView } from '../session/SessionSummaryView';

/** refuerzo de un punto concreto (una estructura gramatical): 10 ejercicios distintos cada vez */
export function SkillPage() {
  const { skill = '' } = useParams();
  const { lang, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (lang && content && !items) setItems(buildSkillSession(content, skill, lang));
  }, [lang, content, skill, items, round]);

  if (!lang || !content || !items) return <ScreenSkeleton />;
  const title = content.guides.find((g) => g.id === skill)?.title ?? lessonsForSkill(content, skill)[0]?.title ?? 'Refuerzo';

  if (items.length === 0) {
    return (
      <div className="pt-safe">
        <EmptyState
          icon={<Target size={28} weight="fill" />}
          title="No hay ejercicios para este punto"
          body="Este punto todavía no tiene frases de práctica."
          action={<Button onClick={() => navigate('/guias')}>Ir a las guías</Button>}
        />
      </div>
    );
  }

  if (summary) {
    return (
      <SessionSummaryView
        title="Refuerzo terminado"
        subtitle={title}
        summary={summary}
        primary={{
          label: 'Otra ronda',
          onClick: () => {
            setSummary(null);
            setItems(null);
            setRound((r) => r + 1);
          },
        }}
        secondary={{ label: 'Ir a Hoy', onClick: () => navigate('/') }}
      />
    );
  }

  return (
    <SessionPlayer
      key={round}
      lang={lang}
      content={content}
      items={items}
      onExit={() => navigate(-1)}
      onFinish={(s) => void completePractice(lang.id, s).then(() => setSummary(s))}
    />
  );
}
