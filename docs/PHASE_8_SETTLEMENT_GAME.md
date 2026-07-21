# Phase 8 — Bet Settlement Game

Phase 8 extends accepted bets with a mutual, server-authoritative settlement flow.

## Settlement lifecycle

1. Either partner proposes a winner or a draw.
2. The other partner confirms or disputes the proposal.
3. A confirmed draw ends without a coin or wheel.
4. A confirmed winner triggers a server-side 50/50 prize/punishment result.
5. The server privately chooses an eligible locked wheel snapshot.
6. Prize: the winner spins their prize wheel.
7. Punishment: the loser spins the winner-created punishment wheel for them.
8. The selected text becomes visible only after the protected reveal call.
9. Either person may mark the playful result complete; the other confirms.
10. The winner may waive a revealed prize or punishment.

## Privacy

`bet_wheel_entries` remains unreadable to authenticated clients. The new
`bet_settlements` table is also unreadable directly. `get_bet_settlements()`
returns the selected title and description only after `revealed_at` is set.

## Voluntary outcomes

The interface explicitly states that prizes and punishments are playful and
voluntary. The app records a game result; it does not create an obligation.
