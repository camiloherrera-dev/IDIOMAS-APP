import { ArrowLeft, DownloadSimple, ShieldCheck, Trash, UploadSimple, Warning } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { LangBadge } from '@/components/LangBadge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { hasVoiceFor, speak, ttsSupported } from '@/core/audio';
import { requestPersistence, updateProfile, type ThemePref } from '@/db';
import { downloadBackup, importData, wipeData } from '@/db/backup';
import { useProfile } from '@/hooks/useProfile';
import { getLanguage, languages } from '@/languages';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 px-1 text-sm font-semibold text-ink-3">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  if (!profile) return <ScreenSkeleton />;
  const lang = getLanguage(profile.activeLang) ?? languages[0];

  return (
    <div>
      <header className="pt-safe flex items-center gap-1 px-3 pb-1">
        <IconButton label="Volver" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} weight="bold" />
        </IconButton>
      </header>
      <div className="flex flex-col gap-7 px-5 pb-6">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Ajustes</h1>

        <Group title="Tú">
          <label className="flex flex-col gap-1.5 px-4 py-3.5">
            <span className="font-semibold">Nombre</span>
            <input
              value={name ?? profile.name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== null && void updateProfile({ name: name.trim() })}
              placeholder="Cómo quieres que te salude"
              className="h-11 rounded-[0.8rem] bg-sunken px-3 text-ink outline-none placeholder:text-ink-3 focus:shadow-[inset_0_0_0_2px_var(--c-accent)]"
            />
          </label>
          <div className="px-4 py-3.5">
            <p className="mb-2 font-semibold">Tema</p>
            <Segmented<ThemePref>
              label="Tema"
              value={profile.theme}
              onChange={(theme) => void updateProfile({ theme })}
              options={[
                { value: 'system', label: 'Sistema' },
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
              ]}
            />
          </div>
        </Group>

        <Group title="Estudio">
          <div className="px-4 py-3.5">
            <p className="font-semibold">Meta diaria</p>
            <p className="mb-2 text-sm text-ink-3">Unos 12 XP equivalen a un minuto de práctica.</p>
            <Segmented
              label="Meta diaria"
              value={String(profile.dailyGoalXp)}
              onChange={(v) => void updateProfile({ dailyGoalXp: Number(v) })}
              options={[
                { value: '20', label: 'Suave' },
                { value: '30', label: 'Normal' },
                { value: '50', label: 'Serio' },
                { value: '80', label: 'Intenso' },
              ]}
            />
          </div>
          <div className="px-4 py-3.5">
            <p className="font-semibold">Palabras nuevas por día</p>
            <p className="mb-2 text-sm text-ink-3">Cuántas tarjetas nuevas entran al repaso diario.</p>
            <Segmented
              label="Palabras nuevas por día"
              value={String(profile.newPerDay)}
              onChange={(v) => void updateProfile({ newPerDay: Number(v) })}
              options={['5', '8', '12', '20'].map((v) => ({ value: v, label: v }))}
            />
          </div>
          <div className="px-4 py-3.5">
            <p className="font-semibold">Tope de repasos por día</p>
            <Segmented
              className="mt-2"
              label="Tope de repasos"
              value={String(profile.reviewCap)}
              onChange={(v) => void updateProfile({ reviewCap: Number(v) })}
              options={['30', '50', '100', '200'].map((v) => ({ value: v, label: v }))}
            />
          </div>
          <Switch
            checked={profile.hideReading}
            onChange={(hideReading) => void updateProfile({ hideReading })}
            label="Ocultar pinyin en el repaso"
            description="Muestra solo el hanzi en el frente de la tarjeta."
          />
        </Group>

        <Group title="Audio">
          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="rate" className="font-semibold">
                Velocidad de la voz
              </label>
              <span className="text-sm font-semibold text-ink-2 tabular-nums">{profile.voiceRate.toFixed(2)}×</span>
            </div>
            <input
              id="rate"
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={profile.voiceRate}
              onChange={(e) => void updateProfile({ voiceRate: Number(e.target.value) })}
              className="mt-3 w-full accent-[var(--c-accent)]"
            />
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={!ttsSupported()}
              onClick={() =>
                speak(lang.id === 'zh' ? '你好，很高兴认识你。' : 'Olá, tudo bem? Muito prazer.', lang.locale, {
                  rate: profile.voiceRate,
                })
              }
            >
              Probar voz
            </Button>
            {ttsSupported() && !hasVoiceFor(lang.locale) && (
              <p className="mt-3 flex gap-2 text-sm text-ink-2">
                <Warning size={18} weight="fill" className="shrink-0 text-warn" />
                Este dispositivo no tiene voz para {lang.name.toLowerCase()}. En iPhone: Ajustes, Accesibilidad, Contenido leído,
                Voces.
              </p>
            )}
          </div>
          <Switch
            checked={profile.sounds}
            onChange={(sounds) => void updateProfile({ sounds })}
            label="Sonidos de acierto y error"
          />
        </Group>

        <Group title="Idiomas">
          {languages.map((l) => {
            const active = profile.langs.includes(l.id);
            return (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <LangBadge lang={l} />
                <span className="flex-1 font-semibold">{l.name}</span>
                <button
                  type="button"
                  disabled={active && profile.langs.length === 1}
                  onClick={() => {
                    const langs = active ? profile.langs.filter((x) => x !== l.id) : [...profile.langs, l.id];
                    void updateProfile({ langs, activeLang: langs.includes(profile.activeLang) ? profile.activeLang : langs[0] });
                  }}
                  className={cn(
                    'pressable h-9 rounded-full px-4 text-sm font-semibold disabled:opacity-50',
                    active ? 'bg-sunken text-ink-2' : 'bg-accent-soft text-accent',
                  )}
                >
                  {active ? 'Quitar' : 'Añadir'}
                </button>
              </div>
            );
          })}
        </Group>

        <Group title="Tus datos">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <ShieldCheck size={22} weight="fill" className={persisted ? 'text-ok' : 'text-ink-3'} />
            <div className="flex-1">
              <p className="font-semibold">{persisted ? 'Almacenamiento protegido' : 'Almacenamiento sin proteger'}</p>
              <p className="text-sm text-ink-3">
                Tu progreso vive solo en este dispositivo. Safari puede borrarlo si no usas la app; instalarla y exportar copias
                lo evita.
              </p>
              {!persisted && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={async () => {
                    const ok = await requestPersistence();
                    setPersisted(ok);
                    toast(ok ? 'Almacenamiento protegido' : 'El navegador no lo permitió. Instala la app y vuelve a intentarlo.');
                  }}
                >
                  Proteger
                </Button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void downloadBackup().then(() => toast.success('Copia descargada'))}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-sunken"
          >
            <DownloadSimple size={22} weight="bold" className="text-accent" />
            <span className="flex-1 font-semibold">Exportar progreso (JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-sunken"
          >
            <UploadSimple size={22} weight="bold" className="text-accent" />
            <span className="flex-1">
              <span className="block font-semibold">Importar progreso</span>
              <span className="block text-sm text-ink-3">Reemplaza todos los datos de este dispositivo.</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const { cards } = await importData(JSON.parse(await file.text()));
                toast.success(`Progreso importado: ${cards} tarjetas`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
              }
            }}
          />
          <button
            type="button"
            onClick={() => setConfirmWipe(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-bad hover:bg-bad-soft"
          >
            <Trash size={22} weight="bold" />
            <span className="flex-1 font-semibold">Borrar todos los datos</span>
          </button>
        </Group>
      </div>

      <Sheet open={confirmWipe} onClose={() => setConfirmWipe(false)} title="¿Borrar todo?">
        <p className="px-2 pb-5 text-ink-2">
          Se eliminan tu progreso, tu mazo, tus palabras y tus estadísticas en este dispositivo. No se puede deshacer. Exporta una
          copia antes si la quieres conservar.
        </p>
        <div className="grid gap-2.5 pb-2">
          <Button size="lg" variant="secondary" onClick={() => setConfirmWipe(false)}>
            Cancelar
          </Button>
          <Button
            size="lg"
            variant="bad"
            onClick={async () => {
              await wipeData();
              setConfirmWipe(false);
              navigate('/bienvenida', { replace: true });
            }}
          >
            Borrar todo
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
