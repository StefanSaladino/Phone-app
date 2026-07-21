interface AppIconProps {
  name:
    | 'home'
    | 'ideas'
    | 'places'
    | 'notes'
    | 'bets'
    | 'trophy'
    | 'lock'
    | 'bell'
    | 'plus'
    | 'logout'
    | 'close'
    | 'heart'
    | 'calendar'
    | 'edit'
    | 'trash'
    | 'check'
    | 'undo'
    | 'search'
    | 'external-link'
    | 'map'
    | 'globe'
    | 'mail'
    | 'send'
    | 'sparkle';
  size?: number;
}

/**
 * Small internal icon set that avoids an additional icon dependency.
 */
export function AppIcon({ name, size = 22 }: AppIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'home') {
    return (
      <svg {...commonProps}>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (name === 'ideas') {
    return (
      <svg {...commonProps}>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M8.2 14.7A7 7 0 1 1 15.8 14.7c-.9.7-1.3 1.5-1.3 2.3h-5c0-.8-.4-1.6-1.3-2.3Z" />
      </svg>
    );
  }

  if (name === 'places') {
    return (
      <svg {...commonProps}>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === 'notes') {
    return (
      <svg {...commonProps}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.7A2.5 2.5 0 0 1 4 13.5Z" />
        <path d="M8 8h8M8 12h5" />
      </svg>
    );
  }

  if (name === 'bets') {
    return (
      <svg {...commonProps}>
        <circle cx="8" cy="8" r="4.5" />
        <circle cx="16" cy="16" r="4.5" />
        <path d="M6.5 6.5h.01M9.5 9.5h.01M14.5 14.5h.01M17.5 17.5h.01" />
        <path d="m11 11 2 2" />
      </svg>
    );
  }

  if (name === 'trophy') {
    return (
      <svg {...commonProps}>
        <path d="M8 4h8v4a4 4 0 0 1-8 0Z" />
        <path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4" />
        <path d="M12 12v5M8.5 21h7M10 17h4" />
      </svg>
    );
  }

  if (name === 'lock') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </svg>
    );
  }

  if (name === 'bell') {
    return (
      <svg {...commonProps}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (name === 'plus') {
    return (
      <svg {...commonProps}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (name === 'close') {
    return (
      <svg {...commonProps}>
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  }

  if (name === 'heart') {
    return (
      <svg {...commonProps}>
        <path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    );
  }

  if (name === 'calendar') {
    return (
      <svg {...commonProps}>
        <path d="M6 2v4M18 2v4M3.5 9h17" />
        <rect x="3.5" y="4" width="17" height="17" rx="2.5" />
      </svg>
    );
  }

  if (name === 'edit') {
    return (
      <svg {...commonProps}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    );
  }

  if (name === 'trash') {
    return (
      <svg {...commonProps}>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </svg>
    );
  }

  if (name === 'check') {
    return (
      <svg {...commonProps}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === 'undo') {
    return (
      <svg {...commonProps}>
        <path d="m9 7-5 5 5 5" />
        <path d="M4 12h10a6 6 0 0 1 6 6" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }

  if (name === 'external-link') {
    return (
      <svg {...commonProps}>
        <path d="M14 4h6v6" />
        <path d="m20 4-9 9" />
        <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
      </svg>
    );
  }

  if (name === 'map') {
    return (
      <svg {...commonProps}>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
    );
  }


  if (name === 'mail') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  if (name === 'send') {
    return (
      <svg {...commonProps}>
        <path d="m3 11 18-8-8 18-2.5-7.5Z" />
        <path d="M10.5 13.5 21 3" />
      </svg>
    );
  }

  if (name === 'sparkle') {
    return (
      <svg {...commonProps}>
        <path d="M12 2.5c.7 4.5 3 6.8 7.5 7.5-4.5.7-6.8 3-7.5 7.5-.7-4.5-3-6.8-7.5-7.5 4.5-.7 6.8-3 7.5-7.5Z" />
        <path d="M19 17.5c.25 1.6 1.1 2.45 2.5 2.5-1.4.25-2.25 1.1-2.5 2.5-.25-1.4-1.1-2.25-2.5-2.5 1.4-.05 2.25-.9 2.5-2.5Z" />
      </svg>
    );
  }

  if (name === 'globe') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M10 5H5v14h5" />
      <path d="m14 8 4 4-4 4" />
      <path d="M8 12h10" />
    </svg>
  );
}
