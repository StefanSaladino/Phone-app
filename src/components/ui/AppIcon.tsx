interface AppIconProps {
  name: 'home' | 'ideas' | 'places' | 'notes' | 'plus' | 'logout';
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

  if (name === 'plus') {
    return (
      <svg {...commonProps}>
        <path d="M12 5v14M5 12h14" />
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
