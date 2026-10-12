import { SpeakButton } from '@/components/SpeakButton';
import { ChoiceButton, ExerciseHeading, type ChoiceState } from '@/core/exercises/shared';
import type { CheckResult, ExercisePlugin, ExerciseProps } from '@/core/types';
import { DE_ARTICLES, deArticleSchema, type DeArticleData } from './schemas';

function articleState(article: string, answer: unknown, status: string, correct: string): ChoiceState {
  if (status === 'checked') {
    if (article === correct) return 'correct';
    if (article === answer) return 'wrong';
    return 'dim';
  }
  return article === answer ? 'selected' : 'idle';
}

function Article({ data, ctx, answer, setAnswer, status }: ExerciseProps<DeArticleData>) {
  const checked = status === 'checked';
  const spoken = checked ? `${data.article} ${data.noun}` : data.noun;

  return (
    <div className="flex flex-col gap-6">
      <ExerciseHeading>¿Qué artículo lleva?</ExerciseHeading>

      <div className="flex items-center gap-4 py-2">
        <SpeakButton text={spoken} locale={ctx.lang.locale} label={`Escuchar ${spoken}`} />
        <div className="min-w-0">
          <p lang="de-DE" className="text-4xl leading-tight font-bold tracking-tight break-words">
            {checked && <span className="text-accent">{data.article} </span>}
            {data.noun}
          </p>
          <p className="mt-1 text-ink-2">{data.meaning}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Artículos">
        {DE_ARTICLES.map((a) => (
          <ChoiceButton
            key={a}
            state={articleState(a, answer, status, data.article)}
            disabled={checked}
            onClick={() => setAnswer(a)}
            className="min-h-16 justify-center text-center text-xl font-bold"
          >
            <span lang="de-DE">{a}</span>
          </ChoiceButton>
        ))}
      </div>
    </div>
  );
}

export function checkArticle(data: DeArticleData, answer: unknown): CheckResult {
  const parts: string[] = [];
  if (data.plural) parts.push(`Plural: ${data.plural}.`);
  if (data.tip) parts.push(`Pista: ${data.tip}`);
  return {
    correct: answer === data.article,
    solution: `${data.article} ${data.noun}`,
    feedback: parts.length ? parts.join(' ') : undefined,
  };
}

export const deArticlePlugin: ExercisePlugin<DeArticleData> = {
  type: 'de-article',
  label: 'Artículo',
  schema: deArticleSchema,
  Component: Article,
  check: (data, answer) => checkArticle(data, answer),
};
