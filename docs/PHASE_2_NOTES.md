# Phase 2 — Couple Workspace

## Implemented

- Added a dedicated `CoupleProvider` and `useCouple` hook.
- Added a service layer for Supabase workspace queries.
- Added typed profile, membership, couple, and dashboard-count models.
- Added `CoupleGuard` for missing or invalid workspace states.
- Loaded the signed-in person's profile and their partner's profile.
- Loaded live counts for date ideas, places, and unread received notes.
- Updated the top bar and dashboard with real couple data.

## Verification

Sign in as each account and confirm:

1. The top-bar eyebrow shows the shared couple name.
2. The avatar uses the signed-in person's display name.
3. The dashboard greets the correct signed-in person.
4. The hero sentence names the other person.
5. All three dashboard totals display `0` in a new database.
6. Signing out and switching accounts swaps the names correctly.

No database migration is required for this phase.
