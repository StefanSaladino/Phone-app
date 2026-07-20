import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../components/auth/PublicOnlyRoute';
import { CoupleGuard } from '../components/couple/CoupleGuard';
import { AppShell } from '../components/layout/AppShell';

/*
 * Route-level dynamic imports.
 *
 * Each page currently uses a named export, so the imported component is
 * converted into the default-export shape required by React.lazy().
 *
 * These declarations must remain outside AppRoutes so React does not create
 * a new lazy component whenever the route table renders.
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

/**
 * Lightweight loading state used inside the authenticated application shell.
 *
 * Keeping the Suspense boundary around the individual page means the header,
 * bottom navigation, couple context, and surprise-note controller remain
 * mounted while the requested route chunk downloads.
 */
function RoutePageFallback() {
  return (
    <section
      className="empty-state empty-state--compact"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="route-loader__mark" aria-hidden="true">
        ♥
      </span>
      <h3>Opening this page…</h3>
      <p>Just a moment.</p>
    </section>
  );
}

/**
 * Full-page loading state for routes that do not render inside AppShell,
 * including the login and not-found pages.
 */
function FullPageFallback() {
  return (
    <main
      className="route-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="route-loader__mark" aria-hidden="true">
        ♥
      </span>
      <p>Opening Together…</p>
    </main>
  );
}

/**
 * Reusable Suspense boundary for lazy route modules.
 */
function LazyRoute({ children, fullPage = false }: LazyRouteProps) {
  return (
    <Suspense
      fallback={fullPage ? <FullPageFallback /> : <RoutePageFallback />}
    >
      {children}
    </Suspense>
  );
}

/**
 * Central application route table.
 *
 * Authentication, couple-workspace loading, shared layout, and route-page
 * loading remain separate concerns.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Routes available only while signed out. */}
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

      {/* Private routes require both authentication and a valid couple. */}
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

      {/* Standalone error route. */}
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