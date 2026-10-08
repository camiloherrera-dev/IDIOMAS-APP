import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { buildLessonSession, flattenLessons, type SessionItem } from '@/core/lessons';
import { cardId } from '@/core/srs';
import { db, updateProfile } from '@/db';
import { getLanguage, languages } from '@/languages';
import { useContentStore } from '@/stores/content';
import { useEffect } from 'react';
import { MapTrifold } from '@phosphor-icons/react';
import { completeLesson, type CompletionResult } from '../session/complete';
import { SessionPlayer, type SessionSummary } from '../session/SessionPlayer';
import { SessionSummaryView } from '../session/SessionSummaryView';

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const langId = lessonId.split('-')[0];
  const lang = getLanguage(langId) ?? languages[0];
  const entry = useContentStore((s) => s.byLang[lang.id]);
  const load = useContentStore((s) => s.load);
  const content = entry?.status === 'ready' ? entry.content : undefined;

  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [result, setResult] = useState<{ summary: SessionSummary; completion: CompletionResult } | null>(null);

  useEffect(() => {
    void load(lang.id);
    // abrir una lección de otro idioma lo activa
    void db.profile.get('me').then((p) => {
      if (p && p.activeLang !== lang.id) void updateProfile({ activeLang: lang.id, langs: [...new Set([...p.langs, lang.id])] });
    });
  }, [lang.id, load]);

  const ref = content ? flattenLessons(content).find((r) => r.lesson.id === lessonId) : undefined;

  // presentar solo las palabras que aún no están en el mazo
  const known = useLiveQuery(async () => {
    if (!ref) return undefined;
    const rows = await db.cards.bulkGet(ref.lesson.vocab.map((t) => cardId(lang.id, t)));
    return rows.filter(Boolean).length;
  }, [ref?.lesson.id]);

  useEffect(() => {
    if (!ref || !content || known === undefined || items) return;
    setItems(buildLessonSession(ref.lesson, content, { introduce: known < ref.lesson.vocab.length }));
  }, [ref, content, known, items]);

  if (entry?.status === 'error' || (content && !ref)) {
    return (
      <div className="pt-safe">
        <EmptyState
          icon={<MapTrifold size={28} weight="fill" />}
          title="Lección no encontrada"
          body="Puede que el enlace sea de una versión anterior del curso."
          action={<Button onClick={() => navigate('/ruta')}>Ir a la ruta</Button>}
        />
      </div>
    );
  }
  if (!content || !ref || !items) return <ScreenSkeleton />;

  if (result) {
    const all = flattenLessons(content);
    const following = all[ref.order + 1];
    const accuracy = result.summary.answered ? result.summary.correctFirstTry / result.summary.answered : 1;
    return (
      <SessionSummaryView
        title={accuracy === 1 ? 'Lección perfecta' : 'Lección completada'}
        subtitle={ref.lesson.title}
        summary={{ ...result.summary, xp: result.completion.xp }}
        newWords={result.completion.newWords}
        primary={
          following
            ? { label: 'Siguiente lección', onClick: () => navigate(`/leccion/${following.lesson.id}`, { replace: true }) }
            : { label: 'Volver a la ruta', onClick: () => navigate('/ruta') }
        }
        secondary={{ label: 'Ir a Hoy', onClick: () => navigate('/') }}
      />
    );
  }

  return (
    <SessionPlayer
      key={lessonId}
      lang={lang}
      content={content}
      items={items}
      onExit={() => navigate(-1)}
      onFinish={(summary) => {
        void completeLesson(lang.id, ref.lesson, summary).then((completion) => setResult({ summary, completion }));
      }}
    />
  );
}
