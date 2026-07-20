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
          className="top-bar__avatar"
          aria-label={`Signed in as ${displayName || email || 'user'}`}
          title={displayName || email}
        >
          {initial}
        </span>
        <button
          className="icon-button"
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <AppIcon name="logout" size={20} />
        </button>
      </div>
    </header>
  );
}
