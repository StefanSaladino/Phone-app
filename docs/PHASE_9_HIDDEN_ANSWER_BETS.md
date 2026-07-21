# Hidden-answer bets with Phase 9 notifications

Migration `0010_hidden_answer_bets.sql` adds a second bet mode without changing normal bets.

## Flow

1. The creator selects **Hidden answer** in the bet form.
2. The creator enters a private prediction, such as `Filet mignon`.
3. The invited partner sees the question, visible terms, and answer instructions, but not the prediction.
4. The partner accepts the wager.
5. When the real-world answer is known, the partner enters it in Together.
6. Supabase stores the submitted answer before returning the hidden prediction.
7. Both values become visible.
8. The server suggests a winner using a trimmed, case-insensitive exact-text comparison.
9. The other partner confirms or disputes that suggestion using the existing Phase 8 settlement flow.
10. A confirmed winner continues to the normal coin flip and private wheel game.

## Privacy model

The private prediction is stored in `bet_hidden_answers`, not in the shared `bets` table. Authenticated clients have no direct table privileges or RLS read policy for hidden values.

`get_hidden_bet_states()` returns:

- The creator's own prediction to the creator.
- `null` for the invited partner before submission.
- Both answers to both partners only after the server has stored the submitted answer.

`submit_hidden_bet_answer()` performs submission, reveal, comparison, and settlement proposal creation in one database transaction.

## Comparison rule

The automatic suggestion ignores capitalization, leading/trailing spaces, and repeated whitespace. It intentionally does not attempt semantic matching.

Examples:

- `Filet Mignon` and ` filet   mignon ` are an exact match.
- `Filet mignon` and `steak` are not an exact match.

Similar wording can be disputed and decided mutually.

## Notifications

Phase 9 sends only generic messages:

- Hidden-answer wager invitation
- Real answer required after acceptance
- Result proposal ready for confirmation

Neither the hidden prediction nor the submitted answer is placed in a push payload or Lock Screen preview.
