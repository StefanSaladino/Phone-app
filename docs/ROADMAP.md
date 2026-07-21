# Implementation status

- Phase 1 — Complete
- Phase 2 — Complete
- Phase 3 — Complete
- Phase 4 — Complete
- Phase 5 — Complete
- Phase 6 — Complete
- Phase 7 — Complete
- Phase 8 — Complete
- Phase 9 — Complete (deployment configuration required)

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

## Phase 5 — Little notes ✅

**Goal:** Add private messages and surprise popups on app open or while the recipient is online.

- Write a note to the partner
- Normal inbox delivery
- Next-login popup delivery
- Seen and dismissed states
- Sent and received views
- Secure database functions for note state changes

**Exit check:** A surprise note appears once for the intended recipient—live when the app is open or on the next app opening—and cannot be edited by the recipient.

## Phase 6 — iPhone installation and release ✅

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

## Phase 7 — Bets foundation

**Goal:** Add private prize and punishment wheels plus locked bet invitations.

- Personal prizes created privately for oneself
- Punishments created privately for the partner
- Wheel contents hidden from the partner until a selected result is revealed
- Readiness-only sharing with no partner approval requirement
- Bet creation with visible predictions or a server-protected hidden-answer mode
- Hidden predictions revealed only after the designated partner submits the real answer
- Accept, reject, and cancel invitation flows
- Private wheel snapshots when a bet becomes active
- Immutable active bet terms and hidden snapshot contents

**Exit check:** Both partners can privately prepare complete wheels, agree to a bet, and see the same locked wager without seeing each other’s wheel entries.

## Phase 8 — Secure settlement game

**Goal:** Settle active bets fairly and reveal the result through the coin and wheels.

- Winner proposal and partner confirmation
- Dispute, draw, and mutual cancellation handling
- Server-authoritative prize-or-punishment coin flip
- Server-authoritative wheel selection
- Coin and wheel reveal animations
- Completion, waiver, and history tracking

## Phase 9 — Push notifications

**Goal:** Deliver scheduled date and bet notifications while the PWA is closed.

- Per-device Web Push subscriptions
- Notification preferences and quiet hours
- Date reminder scheduling
- Bet invitation and settlement notifications
- Service-worker notification handling
- Supabase Edge Function delivery
- Explicit exclusion of surprise notes

## Deferred ideas

- Photo uploads
- Calendar integration
- Location-based suggestions
- AI recommendations
- Public sharing
