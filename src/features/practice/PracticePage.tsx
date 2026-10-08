import { Barbell } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { buildPracticeSession, termMap, type SessionItem } from '@/core/lessons';
import { State } from '@/core/srs';
import { db } from '@/db';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { completePractice } from '../session/complete';
import { SessionPlayer, type SessionSummary } from '../session/SessionPlayer';
import { SessionSummaryView } from '../session/SessionSummaryView';

export function PracticePage() {
  const { lang, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [round, setRound] = useState(0);

  const cards = useLiveQuery(() => (lang ? db.cards.where('langId').equals(lang.id).toArray() : []), [lang?.id]);

  useEffect(() => {
    if (!lang || !content || !cards || items) return;
    const terms = termMap(content);
    // prioriza lo más reciente y lo más difícil
    const ranked = [...cards].sort(
      (a, b) =>
        (b.state === State.New ? 1 : 0) - (a.state === State.New ? 1 : 0) ||
        b.difficulty - a.difficulty ||
        b.createdAt - a.createdAt,
    );
    const learned = ranked.slice(0, 30).flatMap((c) => terms.get(c.termId) ?? []);
    setItems(buildPracticeSession(learned, lang, 10));
  }, [lang, content, cards, items, round]);

  if (!lang || !content || !items) return <ScreenSkeleton />;

  if (items.length === 0) {
    return (
      <div className="pt-safe">
        <EmptyState
          icon={<Barbell size={28} weight="fill" />}
          title="Aún no hay qué practicar"
          body="Completa una lección para tener al menos 4 palabras y generar práctica con ellas."
          action={<Button onClick={() => navigate('/ruta')}>Ir a la ruta</Button>}
        />
      </div>
    );
  }

  if (summary) {
    return (
      <SessionSummaryView
        title="Práctica terminada"
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
      onFinish={(s) => {
        void completePractice(lang.id, s).then(() => setSummary(s));
      }}
    />
  );
}
