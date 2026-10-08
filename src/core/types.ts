import type { ComponentType, LazyExoticComponent } from 'react';
import type { ZodType } from 'zod';
import type { ExerciseData, Term, Unit } from './schema';

export type { Example, ExerciseData, Lesson, Term, Unit } from './schema';

export interface Guide {
  id: string;
  title: string;
  summary: string;
  level?: string;
  order: number;
  /** cuerpo en Markdown */
  body: string;
}

export interface LanguageContent {
  units: Unit[];
  vocab: Term[];
  guides: Guide[];
}

export interface CheckResult {
  correct: boolean;
  /** correcto con un detalle menor (tilde, errata) */
  partial?: boolean;
  feedback?: string;
  /** forma correcta para mostrar en la hoja de feedback */
  solution?: string;
}

export interface ExerciseContext {
  lang: LanguagePack;
  content: LanguageContent;
  prefs: { voiceRate: number; sounds: boolean };
}

export interface ExerciseProps<TData> {
  data: TData;
  ctx: ExerciseContext;
  /** respuesta actual (null = aún no hay nada que comprobar) */
  answer: unknown;
  setAnswer: (answer: unknown) => void;
  /** 'checked' bloquea la interacción y muestra la corrección */
  status: 'answering' | 'checked';
  result?: CheckResult;
  /** comprobar desde dentro del ejercicio (p. ej. Enter en un input) */
  submit: (answer?: unknown) => void;
}

export interface ExercisePlugin<TData extends ExerciseData = ExerciseData> {
  type: string;
  /** nombre corto para la UI: "Escuchar y elegir" */
  label: string;
  schema: ZodType<TData>;
  Component: ComponentType<ExerciseProps<TData>>;
  check: (data: TData, answer: unknown, ctx: ExerciseContext) => CheckResult;
  /**
   * Ejercicios que se autocorrigen al completarse (emparejar parejas):
   * no muestran el botón "Comprobar".
   */
  autoSubmit?: boolean;
}

export interface LanguageTool {
  id: string;
  title: string;
  description: string;
  Component: LazyExoticComponent<ComponentType<{ lang: LanguagePack }>>;
}

export interface AnswerCheckOptions {
  /** lenient: una tilde mal cuenta como "casi correcto". strict: es un error con pista. */
  diacritics: 'lenient' | 'strict';
  /** mensaje cuando el único fallo son diacríticos y el modo es strict */
  diacriticsFeedback?: string;
  /** distancia de Levenshtein ≤ 1 aceptada en palabras de 6+ letras */
  typoTolerance: boolean;
}

export interface LanguagePack {
  id: string;
  name: string;
  nativeName: string;
  /** glifo corto para la insignia del idioma ("Pt", "中") */
  glyph: string;
  flag: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  script: 'latin' | 'hanzi' | 'cyrillic' | 'arabic' | 'other';
  /** separador entre palabras al formar frases ("" en chino) */
  wordSeparator: ' ' | '';
  features: {
    tones?: boolean;
    characters?: boolean;
    romanization?: 'pinyin' | 'romaji' | null;
    conjugation?: boolean;
    gender?: boolean;
  };
  theme: {
    /** color de acento en OKLCH, claro y oscuro */
    accent: string;
    accentDark: string;
    /** acento secundario (detalles, logros) */
    secondary: string;
  };
  levels: { id: string; name: string }[];
  answerCheck: AnswerCheckOptions;
  loadContent: () => Promise<LanguageContent>;
  exercises?: ExercisePlugin<any>[];
  tools?: LanguageTool[];
  normalizeAnswer?: (s: string) => string;
  /** bloque extra en la ficha de una palabra (p. ej. orden de trazos) */
  termDetail?: LazyExoticComponent<ComponentType<{ term: Pick<Term, 'term' | 'reading'> }>>;
  renderTerm?: ComponentType<{ term: Pick<Term, 'term' | 'reading'>; size?: 'sm' | 'md' | 'lg' | 'xl'; showReading?: boolean }>;
}
