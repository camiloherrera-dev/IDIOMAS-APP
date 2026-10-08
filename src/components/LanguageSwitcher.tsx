import { CaretDown, Check, Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import type { LanguagePack } from '@/core/types';
import { updateProfile, type Profile } from '@/db';
import { languages } from '@/languages';
import { LangBadge } from './LangBadge';
import { cn } from './ui/cn';
import { Sheet } from './ui/Sheet';

/** chip del idioma activo + hoja para cambiar o añadir idiomas */
export function LanguageSwitcher({ lang, profile }: { lang: LanguagePack; profile: Profile }) {
  const [open, setOpen] = useState(false);

  const choose = async (id: string) => {
    const langs = profile.langs.includes(id) ? profile.langs : [...profile.langs, id];
    await updateProfile({ activeLang: id, langs });
    setOpen(false);
  };

  const active = languages.filter((l) => profile.langs.includes(l.id));
  const others = languages.filter((l) => !profile.langs.includes(l.id));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="pressable flex h-11 items-center gap-2 rounded-full bg-surface pr-3 pl-1 hairline"
      >
        <LangBadge lang={lang} size="sm" className="rounded-full" />
        <span className="text-sm font-semibold">{lang.name}</span>
        <CaretDown size={14} weight="bold" className="text-ink-3" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Idioma">
        <ul className="grid gap-1.5 pb-2">
          {active.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => choose(l.id)}
                className={cn(
                  'pressable flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left',
                  l.id === lang.id ? 'bg-sunken' : 'hover:bg-sunken',
                )}
              >
                <LangBadge lang={l} />
                <span className="flex-1">
                  <span className="block font-semibold">{l.name}</span>
                  <span lang={l.locale} className="block text-sm text-ink-3">
                    {l.nativeName}
                  </span>
                </span>
                {l.id === lang.id && <Check size={20} weight="bold" className="text-accent" />}
              </button>
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <>
            <h3 className="px-3 pt-3 pb-2 text-sm font-semibold text-ink-3">Añadir idioma</h3>
            <ul className="grid gap-1.5 pb-2">
              {others.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => choose(l.id)}
                    className="pressable flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left hover:bg-sunken"
                  >
                    <LangBadge lang={l} />
                    <span className="flex-1 font-semibold">{l.name}</span>
                    <Plus size={18} weight="bold" className="text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Sheet>
    </>
  );
}
