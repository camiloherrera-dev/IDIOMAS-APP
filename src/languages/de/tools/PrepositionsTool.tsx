import { useState, type ReactNode } from 'react';
import { SpeakButton } from '@/components/SpeakButton';
import { Segmented } from '@/components/ui/Segmented';
import type { LanguagePack } from '@/core/types';

type GroupId = 'acusativo' | 'dativo' | 'dos-casos' | 'genitivo' | 'contracciones';

interface Example {
  de: string;
  es: string;
  /** etiqueta corta: "Wo? · dativo" */
  label?: string;
}

interface Preposition {
  prep: string;
  meaning: string;
  examples: Example[];
}

const ACCUSATIVE: Preposition[] = [
  {
    prep: 'durch',
    meaning: 'a través de, por',
    examples: [{ de: 'Wir gehen durch den Park.', es: 'Caminamos por el parque.' }],
  },
  {
    prep: 'für',
    meaning: 'para, por',
    examples: [{ de: 'Das Geschenk ist für dich.', es: 'El regalo es para ti.' }],
  },
  {
    prep: 'gegen',
    meaning: 'contra; hacia (hora aproximada)',
    examples: [{ de: 'Ich bin gegen den Plan.', es: 'Estoy en contra del plan.' }],
  },
  {
    prep: 'ohne',
    meaning: 'sin',
    examples: [{ de: 'Ich trinke Kaffee ohne Zucker.', es: 'Tomo café sin azúcar.' }],
  },
  {
    prep: 'um',
    meaning: 'alrededor de; a las (hora)',
    examples: [{ de: 'Der Kurs beginnt um acht Uhr.', es: 'El curso empieza a las ocho.' }],
  },
  {
    prep: 'bis',
    meaning: 'hasta',
    examples: [{ de: 'Ich arbeite bis Freitag.', es: 'Trabajo hasta el viernes.' }],
  },
  {
    prep: 'entlang',
    meaning: 'a lo largo de (va detrás del sustantivo)',
    examples: [{ de: 'Wir gehen den Fluss entlang.', es: 'Caminamos a lo largo del río.' }],
  },
];

const DATIVE: Preposition[] = [
  {
    prep: 'aus',
    meaning: 'de (origen), salir de',
    examples: [{ de: 'Ich komme aus Kolumbien.', es: 'Soy de Colombia.' }],
  },
  {
    prep: 'bei',
    meaning: 'en casa de, cerca de, en (una empresa)',
    examples: [{ de: 'Ich wohne bei meinen Eltern.', es: 'Vivo en casa de mis padres.' }],
  },
  {
    prep: 'mit',
    meaning: 'con; en (medio de transporte)',
    examples: [{ de: 'Ich fahre mit dem Bus.', es: 'Voy en autobús.' }],
  },
  {
    prep: 'nach',
    meaning: 'después de; a (ciudades y países sin artículo)',
    examples: [{ de: 'Nach dem Unterricht fahre ich nach Berlin.', es: 'Después de clase voy a Berlín.' }],
  },
  {
    prep: 'seit',
    meaning: 'desde, desde hace',
    examples: [{ de: 'Ich lerne seit einem Jahr Deutsch.', es: 'Aprendo alemán desde hace un año.' }],
  },
  {
    prep: 'von',
    meaning: 'de, desde',
    examples: [{ de: 'Das ist ein Brief von meiner Mutter.', es: 'Es una carta de mi madre.' }],
  },
  {
    prep: 'zu',
    meaning: 'a (personas y lugares), hacia',
    examples: [{ de: 'Ich gehe zum Arzt.', es: 'Voy al médico.' }],
  },
  {
    prep: 'gegenüber',
    meaning: 'enfrente de',
    examples: [{ de: 'Die Apotheke ist gegenüber dem Bahnhof.', es: 'La farmacia está enfrente de la estación.' }],
  },
  {
    prep: 'ab',
    meaning: 'a partir de',
    examples: [{ de: 'Ab nächster Woche arbeite ich hier.', es: 'A partir de la próxima semana trabajo aquí.' }],
  },
];

const wo = (de: string, es: string): Example => ({ de, es, label: 'Wo? · dativo' });
const wohin = (de: string, es: string): Example => ({ de, es, label: 'Wohin? · acusativo' });

const TWO_WAY: Preposition[] = [
  {
    prep: 'an',
    meaning: 'en, junto a (superficie vertical, borde)',
    examples: [
      wo('Das Bild hängt an der Wand.', 'El cuadro está colgado en la pared.'),
      wohin('Ich hänge das Bild an die Wand.', 'Cuelgo el cuadro en la pared.'),
    ],
  },
  {
    prep: 'auf',
    meaning: 'sobre, encima de (con contacto)',
    examples: [
      wo('Das Buch liegt auf dem Tisch.', 'El libro está sobre la mesa.'),
      wohin('Ich lege das Buch auf den Tisch.', 'Pongo el libro sobre la mesa.'),
    ],
  },
  {
    prep: 'hinter',
    meaning: 'detrás de',
    examples: [
      wo('Der Garten ist hinter dem Haus.', 'El jardín está detrás de la casa.'),
      wohin('Die Katze läuft hinter das Haus.', 'El gato corre detrás de la casa.'),
    ],
  },
  {
    prep: 'in',
    meaning: 'en, dentro de',
    examples: [wo('Ich bin im Kino.', 'Estoy en el cine.'), wohin('Ich gehe ins Kino.', 'Voy al cine.')],
  },
  {
    prep: 'neben',
    meaning: 'al lado de',
    examples: [wo('Er sitzt neben mir.', 'Está sentado a mi lado.'), wohin('Setz dich neben mich!', '¡Siéntate a mi lado!')],
  },
  {
    prep: 'über',
    meaning: 'sobre, encima de (sin contacto)',
    examples: [
      wo('Die Lampe hängt über dem Tisch.', 'La lámpara cuelga sobre la mesa.'),
      wohin('Ich hänge die Lampe über den Tisch.', 'Cuelgo la lámpara sobre la mesa.'),
    ],
  },
  {
    prep: 'unter',
    meaning: 'debajo de',
    examples: [
      wo('Der Hund schläft unter dem Bett.', 'El perro duerme debajo de la cama.'),
      wohin('Der Hund kriecht unter das Bett.', 'El perro se mete debajo de la cama.'),
    ],
  },
  {
    prep: 'vor',
    meaning: 'delante de; hace (tiempo, siempre con dativo)',
    examples: [
      wo('Das Auto steht vor dem Haus.', 'El coche está delante de la casa.'),
      wohin('Ich stelle das Auto vor das Haus.', 'Pongo el coche delante de la casa.'),
    ],
  },
  {
    prep: 'zwischen',
    meaning: 'entre',
    examples: [
      wo('Die Bank ist zwischen der Post und dem Café.', 'El banco está entre el correo y el café.'),
      wohin('Ich stelle den Stuhl zwischen die Fenster.', 'Pongo la silla entre las ventanas.'),
    ],
  },
];

const GENITIVE: Preposition[] = [
  {
    prep: 'wegen',
    meaning: 'por, a causa de',
    examples: [{ de: 'Wegen des Regens bleiben wir zu Hause.', es: 'Por la lluvia nos quedamos en casa.' }],
  },
  {
    prep: 'trotz',
    meaning: 'a pesar de',
    examples: [{ de: 'Trotz des Wetters gehen wir spazieren.', es: 'A pesar del tiempo salimos a pasear.' }],
  },
  {
    prep: 'während',
    meaning: 'durante',
    examples: [{ de: 'Während des Unterrichts ist das Handy aus.', es: 'Durante la clase el móvil está apagado.' }],
  },
  {
    prep: 'statt (anstatt)',
    meaning: 'en lugar de',
    examples: [{ de: 'Statt eines Autos kauft er ein Fahrrad.', es: 'En lugar de un coche se compra una bicicleta.' }],
  },
  {
    prep: 'innerhalb',
    meaning: 'dentro de (espacio o plazo)',
    examples: [{ de: 'Innerhalb einer Woche ist das Paket da.', es: 'En el plazo de una semana llega el paquete.' }],
  },
  {
    prep: 'außerhalb',
    meaning: 'fuera de',
    examples: [{ de: 'Wir wohnen außerhalb der Stadt.', es: 'Vivimos fuera de la ciudad.' }],
  },
];

/** [contracción, forma larga, ejemplo, traducción] */
const CONTRACTIONS: [string, string, string, string][] = [
  ['am', 'an dem', 'am Montag', 'el lunes'],
  ['im', 'in dem', 'im Sommer', 'en verano'],
  ['ins', 'in das', 'ins Kino', 'al cine'],
  ['ans', 'an das', 'ans Meer', 'al mar'],
  ['zum', 'zu dem', 'zum Bahnhof', 'a la estación'],
  ['zur', 'zu der', 'zur Schule', 'a la escuela'],
  ['beim', 'bei dem', 'beim Arzt', 'en el médico'],
  ['vom', 'von dem', 'vom Bahnhof', 'desde la estación'],
];

const GROUPS: Record<Exclude<GroupId, 'contracciones'>, { title: string; intro: ReactNode; items: Preposition[] }> = {
  acusativo: {
    title: 'Siempre con acusativo',
    intro: (
      <>
        Truco para recordarlas: <span lang="de-DE">«durch, für, gegen, ohne, um»</span> (+ <span lang="de-DE">bis</span> y{' '}
        <span lang="de-DE">entlang</span>).
      </>
    ),
    items: ACCUSATIVE,
  },
  dativo: {
    title: 'Siempre con dativo',
    intro: (
      <>
        <span lang="de-DE">aus, bei, mit, nach, seit, von, zu</span> son las más frecuentes. Aunque indiquen movimiento (
        <span lang="de-DE">zum Arzt</span>), van con dativo.
      </>
    ),
    items: DATIVE,
  },
  'dos-casos': {
    title: 'Con dos casos',
    intro: null,
    items: TWO_WAY,
  },
  genitivo: {
    title: 'Con genitivo',
    intro: (
      <>
        Propias del registro escrito. En la lengua hablada <span lang="de-DE">wegen, trotz</span> y{' '}
        <span lang="de-DE">statt</span> se usan a menudo con dativo (<span lang="de-DE">wegen dem Regen</span>).
      </>
    ),
    items: GENITIVE,
  },
};

function PrepositionCard({ p, locale }: { p: Preposition; locale: string }) {
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p lang="de-DE" className="text-xl font-bold tracking-tight">
            {p.prep}
          </p>
          <p className="mt-0.5 text-sm text-ink-2">{p.meaning}</p>
        </div>
        <SpeakButton text={p.prep.replace(/\s*\(.*\)/, '')} locale={locale} size="sm" label={`Escuchar ${p.prep}`} />
      </div>
      <ul className="mt-3 grid gap-2">
        {p.examples.map((ex) => (
          <li key={ex.de} className="flex items-center gap-3 rounded-[0.8rem] bg-sunken px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {ex.label && <p className="text-xs font-semibold text-accent">{ex.label}</p>}
              <p lang="de-DE" className="font-medium">
                {ex.de}
              </p>
              <p className="text-sm text-ink-2">{ex.es}</p>
            </div>
            <SpeakButton text={ex.de} locale={locale} size="sm" label="Escuchar el ejemplo" />
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function PrepositionsTool({ lang }: { lang: LanguagePack }) {
  const [group, setGroup] = useState<GroupId>('acusativo');

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-2">
        Cada preposición exige un caso. Apréndelas por grupos: el artículo que sigue cambia según el caso.
      </p>

      <Segmented
        label="Grupo de preposiciones"
        value={group}
        onChange={setGroup}
        options={[
          { value: 'acusativo', label: 'Acusativo' },
          { value: 'dativo', label: 'Dativo' },
          { value: 'dos-casos', label: 'Dos casos' },
          { value: 'genitivo', label: 'Genitivo' },
          { value: 'contracciones', label: 'Contracciones' },
        ]}
      />

      {group === 'contracciones' ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">Contracciones</h2>
          <p className="text-sm text-ink-2">
            Preposición + artículo <span lang="de-DE">dem</span>, <span lang="de-DE">das</span> o <span lang="de-DE">der</span> se
            funden en una palabra. En el habla son casi obligatorias.
          </p>
          <ul className="card divide-y divide-line overflow-hidden">
            {CONTRACTIONS.map(([short, long, ex, es]) => (
              <li key={short} className="flex items-center gap-3 px-4 py-2">
                <span lang="de-DE" className="w-14 shrink-0 text-lg font-bold text-accent">
                  {short}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-3">
                    = <span lang="de-DE">{long}</span>
                  </p>
                  <p>
                    <span lang="de-DE" className="font-medium">
                      {ex}
                    </span>{' '}
                    <span className="text-sm text-ink-2">· {es}</span>
                  </p>
                </div>
                <SpeakButton text={ex} locale={lang.locale} size="sm" label={`Escuchar ${ex}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">{GROUPS[group].title}</h2>
          {group === 'dos-casos' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] bg-sunken p-3">
                <p className="font-semibold">
                  <span lang="de-DE">Wo?</span> → dativo
                </p>
                <p className="text-sm text-ink-2">¿Dónde? Posición, sin cambio de lugar.</p>
              </div>
              <div className="rounded-[var(--radius-control)] bg-sunken p-3">
                <p className="font-semibold">
                  <span lang="de-DE">Wohin?</span> → acusativo
                </p>
                <p className="text-sm text-ink-2">¿Adónde? Movimiento hacia un destino.</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-2">{GROUPS[group].intro}</p>
          )}
          <ul className="grid gap-3">
            {GROUPS[group].items.map((p) => (
              <PrepositionCard key={p.prep} p={p} locale={lang.locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
