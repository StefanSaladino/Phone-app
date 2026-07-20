import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Keeps authenticated users out of pages intended only for signed-out visitors.
 */
export function PublicOnlyRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="route-loader" aria-live="polite">
        <span className="route-loader__mark" aria-hidden="true">
          ♥
        </span>
        <p>Checking your session…</p>
      </main>
    );
  }

  return user ? <Navigate to="/" replace /> : <Outlet />;
}
