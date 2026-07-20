import { NavLink } from 'react-router-dom';
import { AppIcon } from '../ui/AppIcon';

const navigationItems = [
  { to: '/', label: 'Home', icon: 'home' as const, end: true },
  { to: '/ideas', label: 'Ideas', icon: 'ideas' as const },
  { to: '/places', label: 'Places', icon: 'places' as const },
  { to: '/notes', label: 'Notes', icon: 'notes' as const },
];

/**
 * Thumb-friendly primary navigation for the installed mobile web app.
 */
export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Primary navigation">
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `bottom-navigation__link${isActive ? ' is-active' : ''}`
          }
        >
          <AppIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
