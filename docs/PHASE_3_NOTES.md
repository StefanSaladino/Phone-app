# Phase 3 — Date ideas

Phase 3 turns the placeholder ideas page into a complete shared feature.

## Added

- Shared date-idea list loaded through Supabase RLS
- Create and edit form in a mobile-first bottom sheet
- Idea, planned, and completed states
- Required date/time when an idea is marked planned
- Favourite toggle
- Quick complete and reopen actions
- Permanent delete confirmation
- All, ideas, planned, completed, and favourites filters
- Live local updates after mutations
- Dashboard count refresh after create or delete
- Loading, filtered-empty, first-use, and recoverable error states

## Separation of concerns

- `src/types/dateIdea.ts` — feature and database types
- `src/services/dateIdeaService.ts` — Supabase reads and mutations
- `src/components/date-ideas/` — form, card, filters, and delete dialog
- `src/pages/DateIdeasPage.tsx` — route-level feature coordination

## Database

No new migration is required. The initial schema already contains the `date_ideas` table, RLS policies, and authenticated grants needed by this phase.

## Verification

```text
npm run typecheck — passed
npm run lint      — passed with zero warnings
npm run build     — passed
```
