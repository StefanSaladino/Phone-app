import { AppIcon } from '../ui/AppIcon';

interface TopBarProps {
  title: string;
  email?: string;
  onSignOut: () => void;
}

/**
 * Compact application header shared by every protected page.
 */
export function TopBar({ title, email, onSignOut }: TopBarProps) {
  const initial = email?.charAt(0).toUpperCase() ?? 'U';

  return (
    <header className="top-bar">
      <div>
        <p className="top-bar__eyebrow">Just us</p>
        <h1>{title}</h1>
      </div>

      <div className="top-bar__actions">
        <span className="top-bar__avatar" aria-label={email ?? 'Signed-in user'}>
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
