import { useEffect } from 'react';
import type { LanguagePack } from '@/core/types';
import type { ThemePref } from '@/db';

const META_COLORS = { light: '#f4f5f7', dark: '#14161b' };

/** aplica tema claro/oscuro y el acento del idioma activo al <html> */
export function useApplyTheme(theme: ThemePref | undefined, lang: LanguagePack | undefined) {
  useEffect(() => {
    const pref = theme ?? 'system';
    try {
      localStorage.setItem('lingo-theme', pref);
    } catch {
      /* modo privado */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', dark ? META_COLORS.dark : META_COLORS.light);
        if (pref !== 'system') m.removeAttribute('media');
      });
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (!lang) return;
    const root = document.documentElement.style;
    root.setProperty('--accent-light', lang.theme.accent);
    root.setProperty('--accent-dark', lang.theme.accentDark);
    root.setProperty('--secondary', lang.theme.secondary);
    document.documentElement.dataset.lang = lang.id;
  }, [lang]);
}
