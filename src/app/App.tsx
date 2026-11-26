import { IconContext } from '@phosphor-icons/react';
import { MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router';
import { Toaster } from 'sonner';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { TodayPage } from '@/features/today/TodayPage';
import { useAccount } from '@/core/account/store';
import { useActiveLanguage } from '@/hooks/useLanguage';
import { useApplyTheme } from '@/hooks/useTheme';
import { AppShell } from './AppShell';

// la pantalla Hoy va en el bundle inicial; el resto se carga al navegar
const DictionaryPage = lazy(() =>
  import('@/features/dictionary/DictionaryPage').then((m) => ({
    default: m.DictionaryPage,
  })),
);
const GuidePage = lazy(() => import('@/features/guides/GuidePage').then((m) => ({ default: m.GuidePage })));
const GuidesPage = lazy(() =>
  import('@/features/guides/GuidesPage').then((m) => ({
    default: m.GuidesPage,
  })),
);
const ToolPage = lazy(() => import('@/features/guides/ToolPage').then((m) => ({ default: m.ToolPage })));
const LessonPage = lazy(() =>
  import('@/features/lesson/LessonPage').then((m) => ({
    default: m.LessonPage,
  })),
);
const OnboardingPage = lazy(() =>
  import('@/features/onboarding/OnboardingPage').then((m) => ({
    default: m.OnboardingPage,
  })),
);
const PathPage = lazy(() => import('@/features/path/PathPage').then((m) => ({ default: m.PathPage })));
const ReadingsPage = lazy(() => import('@/features/reading/ReadingsPage').then((m) => ({ default: m.ReadingsPage })));
const ReadingSessionPage = lazy(() => import('@/features/reading/ReadingsPage').then((m) => ({ default: m.ReadingSessionPage })));
const PracticePage = lazy(() =>
  import('@/features/practice/PracticePage').then((m) => ({
    default: m.PracticePage,
  })),
);
const LevelTestPage = lazy(() => import('@/features/test/LevelTestPage').then((m) => ({ default: m.LevelTestPage })));
const SkillPage = lazy(() => import('@/features/practice/SkillPage').then((m) => ({ default: m.SkillPage })));
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  })),
);
const ReviewHome = lazy(() =>
  import('@/features/review/ReviewHome').then((m) => ({
    default: m.ReviewHome,
  })),
);
const ReviewSession = lazy(() =>
  import('@/features/review/ReviewSession').then((m) => ({
    default: m.ReviewSession,
  })),
);
const AccountPage = lazy(() => import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage })));
const AccountConflict = lazy(() => import('@/features/account/AccountConflict').then((m) => ({ default: m.AccountConflict })));
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);

/** sin onboarding completado, todo redirige a la bienvenida */
function RequireOnboarding() {
  const { profile } = useActiveLanguage();
  const location = useLocation();
  if (!profile) return <ScreenSkeleton />;
  if (!profile.onboarded) return <Navigate to="/bienvenida" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** remonta la lección al pasar a la siguiente */
function LessonRoute() {
  const { lessonId } = useParams();
  return <LessonPage key={lessonId} />;
}

export function App() {
  const { profile, lang } = useActiveLanguage();
  const accountStatus = useAccount((s) => s.status);
  const location = useLocation();
  useApplyTheme(profile?.theme, lang);

  return (
    <MotionConfig reducedMotion="user">
      <IconContext.Provider value={{ size: 22, weight: 'regular', mirrored: false }}>
        <Suspense fallback={<ScreenSkeleton />}>
          <Routes>
            <Route path="/bienvenida" element={<OnboardingPage />} />
            <Route path="/cuenta" element={<AccountPage />} />
            <Route element={<RequireOnboarding />}>
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="ruta" element={<PathPage />} />
                <Route path="repasar" element={<ReviewHome />} />
                <Route path="guias" element={<GuidesPage />} />
                <Route path="guias/:guideId" element={<GuidePage />} />
                <Route path="herramientas/:toolId" element={<ToolPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route path="palabras" element={<DictionaryPage />} />
                <Route path="ajustes" element={<SettingsPage />} />
                <Route path="lecturas" element={<ReadingsPage />} />
              </Route>
              <Route path="leccion/:lessonId" element={<LessonRoute />} />
              <Route path="repasar/sesion" element={<ReviewSession />} />
              <Route path="repasar/libre" element={<ReviewSession free />} />
              <Route path="practica" element={<PracticePage />} />
              <Route path="lecturas/:id" element={<ReadingSessionPage />} />
              <Route path="prueba/:level" element={<LevelTestPage />} />
              <Route path="refuerzo/:skill" element={<SkillPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {accountStatus === 'conflict' && location.pathname !== '/cuenta' && <AccountConflict />}
        </Suspense>
        <Toaster
          position="top-center"
          offset="calc(env(safe-area-inset-top, 0px) + 12px)"
          toastOptions={{
            style: {
              background: 'var(--c-surface)',
              color: 'var(--c-ink)',
              border: '1px solid var(--c-line)',
              borderRadius: '1rem',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </IconContext.Provider>
    </MotionConfig>
  );
}
