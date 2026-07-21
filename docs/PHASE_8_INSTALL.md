# Phase 8 Installation

1. Confirm the current branch is `feature/bets-and-notifications`.
2. Extract the focused update into the project root.
3. Run `supabase/migrations/0008_bet_settlement_game.sql` in Supabase SQL Editor.
4. Do not run `0007_secret_wheel_privacy.sql` when the revised private-wheel
   `0006` was used.
5. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
6. Test proposal, confirmation, dispute, draw, coin result, designated spinner,
   reveal, completion confirmation, and waiver using both accounts.
