import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCouple } from '../../hooks/useCouple';
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
  const { workspace } = useCouple();

  if (!workspace) return null;

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      // AuthContext already exposes the underlying message when needed.
    }
  }

  const currentProfile = workspace.currentMember.profile;
  const currentFullName = [currentProfile.first_name, currentProfile.last_name]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app-shell">
      <TopBar
        title={pageTitles[pathname] ?? 'Our space'}
        workspaceName={workspace.couple.name}
        displayName={currentFullName}
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
