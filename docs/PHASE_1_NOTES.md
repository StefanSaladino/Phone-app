# Phase 1 implementation notes

Phase 1 establishes the application's boundaries without implementing feature CRUD prematurely.

## Implemented

- Complete Vite/React/TypeScript repository
- Supabase browser configuration
- Central authentication provider
- Signed-out and signed-in route guards
- Shared protected layout
- Mobile-first bottom navigation
- Placeholder pages for each future feature
- Initial database tables and Row Level Security
- Netlify SPA rewrite and baseline security headers

## Deliberately deferred

- Couple/profile loading
- Live dashboard data
- Date idea forms and lists
- Saved place forms and lists
- Notes inbox and popup
- PWA service worker and production icons

These belong to later phases so each feature can be implemented with its service, hooks, UI, validation, loading states, and tests together.

## Security decisions

- There is no public signup page.
- The two Auth accounts are created manually in Supabase.
- Database access is protected by Row Level Security.
- The browser receives only the publishable Supabase key.
- The service-role key is never used by the React app.
- Note recipients do not receive generic table update permission; restricted seen/dismissed functions will be added during the notes phase.
- Update privileges are limited to user-editable columns where practical.
