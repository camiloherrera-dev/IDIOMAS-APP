import { useEffect } from 'react';
import { getLanguage, languages } from '@/languages';
import { useContentStore } from '@/stores/content';
import { useProfile } from './useProfile';

/** idioma activo del perfil + su contenido cargado */
export function useActiveLanguage() {
  const profile = useProfile();
  // sin perfil aún no hay idioma: evita cargar y pintar otro idioma un instante
  const lang = profile ? (getLanguage(profile.activeLang) ?? languages[0]) : undefined;
  const entry = useContentStore((s) => (lang ? s.byLang[lang.id] : undefined));
  const load = useContentStore((s) => s.load);

  useEffect(() => {
    if (lang) void load(lang.id);
  }, [lang, load]);

  return {
    profile,
    lang,
    content: entry?.status === 'ready' ? entry.content : undefined,
    error: entry?.status === 'error' ? entry.error : undefined,
    loading: !profile || !entry || entry.status === 'loading',
  };
}
