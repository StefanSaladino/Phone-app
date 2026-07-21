import { NavLink } from 'react-router-dom';
import { AppIcon } from '../ui/AppIcon';

interface TopBarProps {
  title: string;
  workspaceName: string;
  displayName: string;
  email?: string;
  onSignOut: () => void;
}

/**
 * Compact application header shared by every protected page.
 */
export function TopBar({
  title,
  workspaceName,
  displayName,
  email,
  onSignOut,
}: TopBarProps) {
  const initial = (displayName || email || 'U').charAt(0).toUpperCase();

  return (
    <header className="top-bar">
      <div>
        <p className="top-bar__eyebrow">{workspaceName}</p>
        <h1>{title}</h1>
      </div>

      <div className="top-bar__actions">
        <span
          aria-label={`Signed in as ${displayName || email || 'user'}`}
          className="top-bar__avatar"
          title={displayName || email}
        >
          {initial}
        </span>

        <NavLink
          aria-label="Open settings"
          className={({ isActive }) =>
            `icon-button${isActive ? ' is-active' : ''}`
          }
          title="Settings"
          to="/settings"
        >
          <AppIcon name="settings" size={20} />
        </NavLink>

        <button
          aria-label="Sign out"
          className="icon-button"
          onClick={onSignOut}
          title="Sign out"
          type="button"
        >
          <AppIcon name="logout" size={20} />
        </button>
      </div>
    </header>
  );
}