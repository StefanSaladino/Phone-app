import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../components/auth/PublicOnlyRoute';
import { CoupleGuard } from '../components/couple/CoupleGuard';
import { AppShell } from '../components/layout/AppShell';

/*
 * Route-level dynamic imports keep each major feature out of the initial
 * JavaScript bundle until that page is opened.
 */
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);

const DateIdeasPage = lazy(() =>
  import('../pages/DateIdeasPage').then((module) => ({
    default: module.DateIdeasPage,
  })),
);

const PlacesPage = lazy(() =>
  import('../pages/PlacesPage').then((module) => ({
    default: module.PlacesPage,
  })),
);

const BetsPage = lazy(() =>
  import('../pages/BetsPage').then((module) => ({
    default: module.BetsPage,
  })),
);

const NotesPage = lazy(() =>
  import('../pages/NotesPage').then((module) => ({
    default: module.NotesPage,
  })),
);

const LoginPage = lazy(() =>
  import('../pages/auth/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
);

const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  })),
);

interface LazyRouteProps {
  children: ReactNode;
  fullPage?: boolean;
}

function RoutePageFallback() {
  return (
    <section
      className="empty-state empty-state--compact"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="route-loader__mark" aria-hidden="true">♥</span>
      <h3>Opening this page…</h3>
      <p>Just a moment.</p>
    </section>
  );
}

function FullPageFallback() {
  return (
    <main
      className="route-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="route-loader__mark" aria-hidden="true">♥</span>
      <p>Opening Together…</p>
    </main>
  );
}

function LazyRoute({ children, fullPage = false }: LazyRouteProps) {
  return (
    <Suspense fallback={fullPage ? <FullPageFallback /> : <RoutePageFallback />}>
      {children}
    </Suspense>
  );
}

/** Central application route table. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route
          path="/login"
          element={
            <LazyRoute fullPage>
              <LoginPage />
            </LazyRoute>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<CoupleGuard />}>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <LazyRoute>
                  <DashboardPage />
                </LazyRoute>
              }
            />
            <Route
              path="ideas"
              element={
                <LazyRoute>
                  <DateIdeasPage />
                </LazyRoute>
              }
            />
            <Route
              path="places"
              element={
                <LazyRoute>
                  <PlacesPage />
                </LazyRoute>
              }
            />
            <Route
              path="bets"
              element={
                <LazyRoute>
                  <BetsPage />
                </LazyRoute>
              }
            />
            <Route
              path="notes"
              element={
                <LazyRoute>
                  <NotesPage />
                </LazyRoute>
              }
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="/404"
        element={
          <LazyRoute fullPage>
            <NotFoundPage />
          </LazyRoute>
        }
      />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
