import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BottomNavigation } from './BottomNavigation';
import { TopBar } from './TopBar';

const pageTitles: Record<string, string> = {
  '/': 'Our space',
  '/ideas': 'Date ideas',
  '/places': 'Saved places',
  '/notes': 'Little notes',
};

/**
 * Shared authenticated layout containing the top bar, content, and mobile nav.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      // AuthContext already exposes the underlying message when needed.
    }
  }

  return (
    <div className="app-shell">
      <TopBar
        title={pageTitles[pathname] ?? 'Our space'}
        email={user?.email}
        onSignOut={() => void handleSignOut()}
      />

      <main className="app-content">
        <Outlet />
      </main>

      <BottomNavigation />
    </div>
  );
}
