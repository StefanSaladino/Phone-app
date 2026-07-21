import { NavLink } from 'react-router-dom';

/**
 * Header-mounted shortcut to the dedicated application settings page.
 *
 * Inline positioning keeps the control aligned with the existing fixed top
 * bar without adding another global stylesheet dependency.
 */
export function SettingsShortcut() {
  return (
    <NavLink
      aria-label="Open settings"
      title="Settings"
      to="/settings"
      style={({ isActive }) => ({
        position: 'fixed',
        zIndex: 150,
        top: 'calc(0.88rem + env(safe-area-inset-top))',
        right:
          'max(calc(4rem + env(safe-area-inset-right)), calc((100vw - 48rem) / 2 + 4rem))',
        width: '2.65rem',
        height: '2.65rem',
        display: 'grid',
        placeItems: 'center',
        border: isActive
          ? '1px solid rgba(255, 255, 255, 0.5)'
          : '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '50%',
        background: isActive
          ? 'rgba(255, 255, 255, 0.24)'
          : 'rgba(255, 255, 255, 0.12)',
        color: '#ffffff',
        boxShadow: '0 6px 18px rgba(43, 32, 37, 0.12)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      })}
    >
      <svg
        aria-hidden="true"
        fill="none"
        height="22"
        viewBox="0 0 24 24"
        width="22"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="3" />

        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.09.37.3.72.6 1 .3.27.69.41 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" />
      </svg>
    </NavLink>
  );
}