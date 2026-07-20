# Phase 6 — iPhone installation and release

Phase 6 turns Together into an installable Progressive Web App without adding a paid service or another runtime dependency.

## Included

- standards-based web app manifest
- 192px, 512px, maskable, and Apple touch icons
- standalone display mode and iPhone metadata
- dependency-free service worker
- network-first navigation with an offline application-shell fallback
- same-origin static-asset caching
- explicit exclusion of Supabase and other cross-origin requests from the service-worker cache
- connectivity banner when shared data cannot be reached
- iPhone Add to Home Screen instructions
- native install prompt on supporting browsers
- iPhone safe-area handling
- reduced-motion support
- Netlify cache headers for the service worker, manifest, icons, and Vite assets

## Offline behaviour

Together does not queue database writes or cache private Supabase rows. Date ideas, places, and notes remain network-backed so the two accounts cannot unknowingly edit stale copies.

The service worker caches the app shell and visited same-origin assets. When offline, the interface can still load after a previous successful visit and explains that shared data requires a connection.

## Production verification

Before sharing the deployed URL:

1. Add the Supabase URL and publishable key to the Netlify environment variables.
2. Deploy the production build.
3. Sign in with both approved accounts.
4. Confirm date ideas, places, and notes are shared correctly.
5. Disable public user signup in Supabase.
6. Open the production URL in Safari on each iPhone.
7. Use Share → Add to Home Screen.
8. Launch Together from its Home Screen icon.
9. Confirm safe areas, navigation, login persistence, and post-it surprises.

No database migration is required for Phase 6.
