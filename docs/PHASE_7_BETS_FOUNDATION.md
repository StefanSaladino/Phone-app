# Phase 7 — Bets Foundation with Private Wheels

Phase 7 adds a shared Bets tab while keeping every prize and punishment secret
from the other partner until settlement reveals a selected result.

## Wheel ownership

- A prize created by a user is for that same user.
- A punishment created by a user is for their partner.
- Only the creator can read a wheel item's title or details.
- The partner can see only whether the required private pools are ready.
- No prize or punishment requires partner approval.
- Participation remains voluntary in real life; the app records a playful result
  and does not imply an enforceable obligation.

## Bet acceptance

Both partners must have:

- At least one private prize for themselves.
- At least one private punishment for their partner.

When the invited partner accepts a bet, the server snapshots all active private
options into `bet_wheel_entries`. Clients cannot read those snapshots directly.
Later settlement functions will choose from the locked snapshot and reveal only
the selected result.

## Privacy boundary

`wheel_items` uses Row Level Security so only `created_by = auth.uid()` may
select content. `get_wheel_readiness` returns booleans only. The
`bet_wheel_entries` table has no authenticated client SELECT grant.
