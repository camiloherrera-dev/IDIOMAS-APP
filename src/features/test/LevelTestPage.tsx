import { Exam } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { buildLevelTest, type SessionItem } from '@/core/lessons';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { completeLevelTest, completePractice } from '../session/complete';
import { SessionPlayer, type SessionSummary } from '../session/SessionPlayer';
import { SessionSummaryView } from '../session/SessionSummaryView';

/** fracción de aciertos al primer intento con la que se da el nivel por sabido */
/** el HSK real se aprueba con 60 %; aquí se pide más porque aprobar da el nivel por sabido */
export const PASS_SCORE = 0.8;

/** prueba para saltar un nivel: si se aprueba, el nivel queda completo y sus palabras entran al mazo como sabidas */
export function LevelTestPage() {
  const { level = '' } = useParams();
  const { lang, content } = useActiveLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<{ summary: SessionSummary; passed: boolean; words: number; lessons: number } | null>(null);

  useEffect(() => {
    if (lang && content && !items) setItems(buildLevelTest(content, level, lang));
  }, [lang, content, level, items]);

  if (!lang || !content || !items) return <ScreenSkeleton />;
  const name = lang.levels.find((l) => l.id === level)?.name ?? level;

  if (items.length === 0) {
    return (
      <div className="pt-safe">
        <EmptyState
          icon={<Exam size={28} weight="fill" />}
          title="No hay prueba para este nivel"
          body="El nivel no existe o todavía no tiene suficientes palabras."
          action={<Button onClick={() => navigate('/ruta')}>Ir a la ruta</Button>}
        />
      </div>
    );
  }

  if (result) {
    const pct = Math.round((result.summary.correctFirstTry / Math.max(1, result.summary.answered)) * 100);
    return (
      <SessionSummaryView
        title={result.passed ? `${name} superado` : 'Todavía no'}
        subtitle={
          result.passed
            ? `Acertaste el ${pct} %. Marcamos ${result.lessons} lecciones como completas y ${result.words} palabras entraron al repaso como sabidas: irán saliendo en las próximas tres semanas para comprobarlas.`
            : `Acertaste el ${pct} % y hacen falta ${Math.round(PASS_SCORE * 100)} %. Puedes estudiar el nivel o repetir la prueba cuando quieras.`
        }
        summary={result.summary}
        primary={{ label: 'Ir a la ruta', onClick: () => navigate('/ruta', { replace: true }) }}
        secondary={{ label: 'Ir a Hoy', onClick: () => navigate('/', { replace: true }) }}
      />
    );
  }

  if (!started) {
    return (
      <div className="pt-safe mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-5">
        <EmptyState
          icon={<Exam size={28} weight="fill" />}
          title={`Prueba de ${name}`}
          body={`${items.filter((i) => i.kind === 'exercise').length} preguntas en tres partes, como el examen: escucha, lectura y escritura. Unos 10 minutos. Con ${Math.round(PASS_SCORE * 100)} % o más al primer intento, el nivel queda completo y puedes seguir con el siguiente. Si no, no pasa nada.`}
          action={
            <div className="grid gap-2.5">
              <Button size="lg" onClick={() => setStarted(true)}>
                Empezar la prueba
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate(-1)}>
                Volver
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <SessionPlayer
      lang={lang}
      content={content}
      items={items}
      onExit={() => navigate(-1)}
      onFinish={(summary) => {
        const passed = summary.correctFirstTry / Math.max(1, summary.answered) >= PASS_SCORE;
        if (passed) void completeLevelTest(lang.id, content, level, summary).then((r) => setResult({ summary, passed, ...r }));
        else void completePractice(lang.id, summary).then(() => setResult({ summary, passed, words: 0, lessons: 0 }));
      }}
    />
  );
}
