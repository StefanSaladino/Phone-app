import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../components/auth/PublicOnlyRoute';
import { CoupleGuard } from '../components/couple/CoupleGuard';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { DateIdeasPage } from '../pages/DateIdeasPage';
import { NotesPage } from '../pages/NotesPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlacesPage } from '../pages/PlacesPage';
import { LoginPage } from '../pages/auth/LoginPage';

/**
 * Central application route table.
 * Authentication, couple loading, layout, and page concerns remain separate.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<CoupleGuard />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="ideas" element={<DateIdeasPage />} />
            <Route path="places" element={<PlacesPage />} />
            <Route path="notes" element={<NotesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
