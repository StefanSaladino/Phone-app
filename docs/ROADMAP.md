# Together — project roadmap

Together is a private, installable web app for exactly two people. It is intentionally designed to remain free to build, host, and use.

## Project rules

- Use only free and open-source frontend dependencies.
- Stay within the free Supabase and Netlify plans.
- Do not add paid APIs, paid maps, SMS, or subscription services.
- Keep authentication and database authorization separate from presentation.
- Keep React components small and organize code by feature and responsibility.
- Build mobile-first for iPhone, then improve wider layouts.
- Complete and verify one phase before expanding the scope.

## Phase 1 — Foundation and private access

**Goal:** Produce a complete runnable React repository with private authentication and the shared mobile shell.

- React, Vite, and TypeScript project configuration
- Supabase browser client
- Email/password sign-in for two pre-approved accounts
- Public-only and protected route guards
- Shared authenticated layout
- Mobile bottom navigation
- Initial PostgreSQL schema and Row Level Security
- Netlify configuration
- Baseline responsive styling

**Exit check:** The project installs, type-checks, lints, builds, and routes signed-out users to `/login`.

## Phase 2 — Couple workspace

**Goal:** Connect the authenticated account to its couple and partner.

- Shared TypeScript database types
- Profile service and couple service
- `CoupleProvider` and `useCouple` hook
- Loading, empty-membership, and error states
- Display names and partner details
- Real dashboard totals

**Exit check:** Either account sees the same couple workspace and only its linked records.

## Phase 3 — Date ideas

**Goal:** Make the date-idea list fully usable.

- Create, read, edit, and delete ideas
- Optional description
- Idea, planned, and completed states
- Optional planned date
- Favourite toggle
- Sorting and useful empty states

**Exit check:** Changes made by either person are visible to the other and survive reloads.

## Phase 4 — Saved places

**Goal:** Build the categorized place library.

- Create, read, edit, and delete places
- Food, coffee, drinks, dessert, and recreation categories
- Address, website, map link, and private notes
- Visited and favourite toggles
- Category filtering and search

**Exit check:** The shared list filters correctly and opens external map links without a paid maps API.

## Phase 5 — Little notes

**Goal:** Add private messages and next-login surprises.

- Write a note to the partner
- Normal inbox delivery
- Next-login popup delivery
- Seen and dismissed states
- Sent and received views
- Secure database functions for note state changes

**Exit check:** A surprise note appears once for the intended recipient and cannot be edited by the recipient.

## Phase 6 — iPhone installation and release

**Goal:** Finish the app as a polished, private PWA.

- Web app manifest and app icons
- iPhone safe-area handling
- Offline shell and graceful offline messaging
- Install instructions
- Accessibility and reduced-motion review
- Production deployment to Netlify
- Supabase production checks and signup disabled
- Final cross-account test pass

**Exit check:** Both people can add the app to their iPhone Home Screens and use the production deployment privately.

## Deferred ideas

These are intentionally outside the first release:

- Push notifications
- Photo uploads
- Calendar integration
- Location-based suggestions
- AI recommendations
- Public sharing

They can be considered later only when they remain free and solve a real need.
