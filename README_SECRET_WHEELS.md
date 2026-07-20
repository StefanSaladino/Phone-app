# Phase 7 correction — private prize and punishment wheels

This update replaces the approval-based wheel model.

## Final rules

- Prizes you create are for you.
- Punishments you create are for your partner.
- Your partner cannot see your wheel titles or details before settlement.
- You cannot see your partner's wheel titles or details before settlement.
- Each person sees only whether the partner's required wheels are ready.
- Accepting a bet locks private snapshots; it does not approve wheel contents.
- The selected result is revealed later by the Phase 8 settlement flow.

## Migration choice

- If you have **not** run the old `0006_bets_foundation.sql`, run the revised
  `0006_bets_foundation.sql` and do not run 0007.
- If you **already ran** the approval-based 0006, run
  `0007_secret_wheel_privacy.sql` instead.

## Validation

```powershell
npm run typecheck
npm run lint
npm run build
npm run dev
```
