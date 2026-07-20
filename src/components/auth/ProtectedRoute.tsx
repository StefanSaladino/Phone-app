import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Prevents signed-out visitors from reaching private application routes.
 */
export function ProtectedRoute() {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="route-loader" aria-live="polite">
        <span className="route-loader__mark" aria-hidden="true">
          ♥
        </span>
        <p>Opening your space…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
