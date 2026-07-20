# Installing the revised Phase 7

## Before running any Bets migration

Use the revised `0006_bets_foundation.sql`. Do not run the older approval-based
version.

## If the older 0006 was already executed

Do not rerun the revised 0006 over it. Run:

`supabase/migrations/0007_secret_wheel_privacy.sql`

The compatibility migration removes approval behavior, converts existing wheel
statuses, hides all wheel contents from the partner, and revokes direct access
to locked bet snapshots.

## Validation

```powershell
npm run typecheck
npm run lint
npm run build
npm run dev
```
