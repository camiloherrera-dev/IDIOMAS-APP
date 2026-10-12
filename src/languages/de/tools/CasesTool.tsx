import { useState, type ReactNode } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/Segmented';
import type { LanguagePack } from '@/core/types';

type TableId = 'definido' | 'indefinido' | 'posesivos' | 'pronombres' | 'adjetivos';

const CASES = ['Nominativo', 'Acusativo', 'Dativo', 'Genitivo'] as const;
const GENDERS = ['Masc.', 'Fem.', 'Neutro', 'Plural'];

/** filas: [caso, masc, fem, neutro, plural] */
type Grid = string[][];

const DEFINITE: Grid = [
  ['der', 'die', 'das', 'die'],
  ['den', 'die', 'das', 'die'],
  ['dem', 'der', 'dem', 'den'],
  ['des', 'der', 'des', 'der'],
];

const INDEFINITE: Grid = [
  ['ein / kein', 'eine / keine', 'ein / kein', '— / keine'],
  ['einen / keinen', 'eine / keine', 'ein / kein', '— / keine'],
  ['einem / keinem', 'einer / keiner', 'einem / keinem', '— / keinen'],
  ['eines / keines', 'einer / keiner', 'eines / keines', '— / keiner'],
];

const POSSESSIVE: Grid = [
  ['mein', 'meine', 'mein', 'meine'],
  ['meinen', 'meine', 'mein', 'meine'],
  ['meinem', 'meiner', 'meinem', 'meinen'],
  ['meines', 'meiner', 'meines', 'meiner'],
];

const POSSESSIVE_STEMS: [string, string, string][] = [
  ['ich', 'mein-', 'mi'],
  ['du', 'dein-', 'tu'],
  ['er / es', 'sein-', 'su (de él / de ello)'],
  ['sie', 'ihr-', 'su (de ella)'],
  ['wir', 'unser-', 'nuestro'],
  ['ihr', 'euer- (eure, euren…)', 'vuestro / de ustedes'],
  ['sie', 'ihr-', 'su (de ellos)'],
  ['Sie', 'Ihr-', 'su (de usted/es)'],
];

/** [persona, nominativo, acusativo, dativo, significado] */
const PRONOUNS: string[][] = [
  ['ich', 'mich', 'mir', 'yo'],
  ['du', 'dich', 'dir', 'tú'],
  ['er', 'ihn', 'ihm', 'él'],
  ['sie', 'sie', 'ihr', 'ella'],
  ['es', 'es', 'ihm', 'ello'],
  ['wir', 'uns', 'uns', 'nosotros'],
  ['ihr', 'euch', 'euch', 'vosotros / ustedes'],
  ['sie', 'sie', 'ihnen', 'ellos / ellas'],
  ['Sie', 'Sie', 'Ihnen', 'usted / ustedes'],
];

const ADJ_WEAK: Grid = [
  ['-e', '-e', '-e', '-en'],
  ['-en', '-e', '-e', '-en'],
  ['-en', '-en', '-en', '-en'],
  ['-en', '-en', '-en', '-en'],
];
const ADJ_MIXED: Grid = [
  ['-er', '-e', '-es', '-en'],
  ['-en', '-e', '-es', '-en'],
  ['-en', '-en', '-en', '-en'],
  ['-en', '-en', '-en', '-en'],
];
const ADJ_STRONG: Grid = [
  ['-er', '-e', '-es', '-e'],
  ['-en', '-e', '-es', '-e'],
  ['-em', '-er', '-em', '-en'],
  ['-en', '-er', '-en', '-er'],
];

function TableCard({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="card overflow-hidden">
      {/* la tabla se desplaza dentro de la tarjeta, nunca la página */}
      <div className="overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </div>
  );
}

const TH = 'px-3 py-2.5 text-xs font-semibold text-ink-3 whitespace-nowrap';
const ROW_TH = 'sticky left-0 bg-surface px-3 py-3 text-sm font-medium text-ink-2 whitespace-nowrap';

/** tabla caso × género; resalta en acento lo que cambia respecto al nominativo */
function CaseGrid({ grid, caption, highlight = true }: { grid: Grid; caption: string; highlight?: boolean }) {
  return (
    <TableCard caption={caption}>
      <thead className="bg-sunken">
        <tr>
          <th scope="col" className={cn(TH, 'sticky left-0 bg-sunken')}>
            Caso
          </th>
          {GENDERS.map((g) => (
            <th key={g} scope="col" className={TH}>
              {g}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {grid.map((row, r) => (
          <tr key={CASES[r]}>
            <th scope="row" className={ROW_TH}>
              {CASES[r]}
            </th>
            {row.map((cell, c) => (
              <td
                key={c}
                lang="de-DE"
                className={cn(
                  'px-3 py-3 text-[1.0625rem] font-semibold whitespace-nowrap',
                  highlight && r > 0 && cell !== grid[0][c] ? 'text-accent' : 'text-ink',
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-[var(--radius-control)] bg-sunken px-3 py-2.5 text-sm text-ink-2">{children}</p>;
}

function De({ children }: { children: ReactNode }) {
  return (
    <span lang="de-DE" className="font-semibold text-ink">
      {children}
    </span>
  );
}

const ADJ_TABLES: { id: string; title: string; when: ReactNode; grid: Grid; examples: string }[] = [
  {
    id: 'debil',
    title: 'Declinación débil',
    when: (
      <>
        Tras el artículo definido (<De>der, die, das</De>) y <De>dieser, jeder, welcher</De>.
      </>
    ),
    grid: ADJ_WEAK,
    examples: 'der alte Mann · die junge Frau · das kleine Kind · die neuen Bücher',
  },
  {
    id: 'mixta',
    title: 'Declinación mixta',
    when: (
      <>
        Tras <De>ein, kein</De> y los posesivos (<De>mein, dein, unser…</De>).
      </>
    ),
    grid: ADJ_MIXED,
    examples: 'ein alter Mann · eine junge Frau · ein kleines Kind · keine neuen Bücher',
  },
  {
    id: 'fuerte',
    title: 'Declinación fuerte',
    when: 'Sin artículo: el adjetivo toma las terminaciones del artículo definido (salvo genitivo masc./neutro: -en).',
    grid: ADJ_STRONG,
    examples: 'kalter Kaffee · frische Milch · kaltes Wasser · neue Bücher',
  },
];

export default function CasesTool({ lang }: { lang: LanguagePack }) {
  const [table, setTable] = useState<TableId>('definido');

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-2">
        El caso indica la función de la palabra en la frase: <strong className="text-ink">nominativo</strong> (sujeto),{' '}
        <strong className="text-ink">acusativo</strong> (complemento directo), <strong className="text-ink">dativo</strong>{' '}
        (complemento indirecto) y <strong className="text-ink">genitivo</strong> (posesión). En color, lo que cambia respecto al
        nominativo.
      </p>

      <Segmented
        label="Tabla"
        value={table}
        onChange={setTable}
        options={[
          { value: 'definido', label: 'Definido' },
          { value: 'indefinido', label: 'Indefinido' },
          { value: 'posesivos', label: 'Posesivos' },
          { value: 'pronombres', label: 'Pronombres' },
          { value: 'adjetivos', label: 'Adjetivos' },
        ]}
      />

      {table === 'definido' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Artículo definido</h2>
          <CaseGrid grid={DEFINITE} caption="Artículo definido por caso y género" />
          <Note>
            En dativo plural el sustantivo añade <De>-n</De> si puede: <De>mit den Kindern</De>. En genitivo, masculino y neutro
            añaden <De>-(e)s</De>: <De>des Mannes</De>, <De>des Autos</De>.
          </Note>
        </section>
      )}

      {table === 'indefinido' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Artículo indefinido y negativo</h2>
          <CaseGrid grid={INDEFINITE} caption="Artículo indefinido y kein por caso y género" />
          <Note>
            <De>ein</De> no tiene plural (<De>Ich habe Bücher</De>); <De>kein</De> sí: <De>Ich habe keine Bücher</De>. Masculino
            nominativo y neutro nominativo/acusativo no llevan terminación.
          </Note>
        </section>
      )}

      {table === 'posesivos' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Posesivos (modelo: mein)</h2>
          <CaseGrid grid={POSSESSIVE} caption="Declinación del posesivo mein" />
          <Note>
            Todos los posesivos se declinan como <De>mein</De> (y como <De>kein</De>). La terminación depende del sustantivo
            poseído, no del poseedor: <De>sein Bruder</De>, <De>seine Schwester</De>.
          </Note>
          <TableCard caption="Raíz del posesivo según la persona">
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className={cn(TH, 'sticky left-0 bg-sunken')}>
                  Persona
                </th>
                <th scope="col" className={TH}>
                  Posesivo
                </th>
                <th scope="col" className={TH}>
                  Significado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {POSSESSIVE_STEMS.map(([person, stem, meaning]) => (
                <tr key={`${person}-${meaning}`}>
                  <th scope="row" lang="de-DE" className={ROW_TH}>
                    {person}
                  </th>
                  <td lang="de-DE" className="px-3 py-3 text-[1.0625rem] font-semibold whitespace-nowrap">
                    {stem}
                  </td>
                  <td className="px-3 py-3 text-sm text-ink-2">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </section>
      )}

      {table === 'pronombres' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Pronombres personales</h2>
          <TableCard caption="Pronombres personales en nominativo, acusativo y dativo">
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className={cn(TH, 'sticky left-0 bg-sunken')}>
                  Nominativo
                </th>
                <th scope="col" className={TH}>
                  Acusativo
                </th>
                <th scope="col" className={TH}>
                  Dativo
                </th>
                <th scope="col" className={TH}>
                  Significado
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Escuchar</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PRONOUNS.map(([nom, acc, dat, meaning]) => (
                <tr key={`${nom}-${meaning}`}>
                  <th scope="row" lang="de-DE" className={cn(ROW_TH, 'text-[1.0625rem] font-semibold text-ink')}>
                    {nom}
                  </th>
                  <td
                    lang="de-DE"
                    className={cn('px-3 py-3 text-[1.0625rem] font-semibold', acc !== nom ? 'text-accent' : 'text-ink')}
                  >
                    {acc}
                  </td>
                  <td
                    lang="de-DE"
                    className={cn('px-3 py-3 text-[1.0625rem] font-semibold', dat !== nom ? 'text-accent' : 'text-ink')}
                  >
                    {dat}
                  </td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap text-ink-2">{meaning}</td>
                  <td className="px-2 py-1.5 text-right">
                    <SpeakButton
                      text={`${nom}, ${acc}, ${dat}`}
                      locale={lang.locale}
                      size="sm"
                      label={`Escuchar ${nom}, ${acc}, ${dat}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          <Note>
            <De>Ich sehe ihn</De> (acusativo) · <De>Ich helfe ihm</De> (dativo). Los genitivos (<De>meiner, deiner…</De>) casi no
            se usan.
          </Note>
        </section>
      )}

      {table === 'adjetivos' &&
        ADJ_TABLES.map((t) => (
          <section key={t.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">{t.title}</h2>
              <p className="text-sm text-ink-2">{t.when}</p>
            </div>
            <CaseGrid grid={t.grid} caption={`Terminaciones del adjetivo: ${t.title.toLowerCase()}`} highlight={false} />
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2">
              <p lang="de-DE" className="flex-1 text-sm font-medium text-ink">
                {t.examples}
              </p>
              <SpeakButton text={t.examples.replaceAll(' · ', ', ')} locale={lang.locale} size="sm" label="Escuchar ejemplos" />
            </div>
          </section>
        ))}
    </div>
  );
}
