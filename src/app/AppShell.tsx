import { BookOpenText, Cards, House, Path, UserCircle, type Icon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/components/ui/cn';
import { buildReviewQueue, countNewSeenToday } from '@/core/srs';
import { useActiveLanguage } from '@/hooks/useLanguage';

const TABS: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: '/', label: 'Hoy', icon: House, end: true },
  { to: '/ruta', label: 'Ruta', icon: Path },
  { to: '/repasar', label: 'Repasar', icon: Cards },
  { to: '/guias', label: 'Guías', icon: BookOpenText },
  { to: '/perfil', label: 'Perfil', icon: UserCircle },
];

export function AppShell() {
  const { lang, profile } = useActiveLanguage();
  const due = useLiveQuery(async () => {
    if (!lang || !profile) return 0;
    const seen = await countNewSeenToday(lang.id);
    const q = await buildReviewQueue(lang.id, { reviewCap: profile.reviewCap, newPerDay: profile.newPerDay, newSeenToday: seen });
    return q.length;
  }, [lang?.id, profile?.reviewCap, profile?.newPerDay]);

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <div className="pb-tabbar">
        <Outlet />
      </div>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--c-bg)_94%,transparent)] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-bg"
      >
        <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5 px-1" style={{ marginBottom: 'var(--safe-bottom)' }}>
          {TABS.map(({ to, label, icon: TabIcon, end }) => (
            <li key={to} className="flex">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'pressable relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold',
                    isActive ? 'text-accent' : 'text-ink-3',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <TabIcon size={26} weight={isActive ? 'fill' : 'regular'} />
                      {to === '/repasar' && Boolean(due) && (
                        <span className="absolute -top-1 -right-2.5 min-w-[1.15rem] rounded-full bg-accent px-1 text-center text-[0.65rem] leading-[1.15rem] font-bold text-accent-ink tabular-nums">
                          {due! > 99 ? '99+' : due}
                          <span className="sr-only"> por repasar</span>
                        </span>
                      )}
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
