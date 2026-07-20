# Phase 5 popup delivery fix

The first Phase 5 implementation used Postgres RPC functions to claim and update
surprise notes. The replacement uses normal `notes` table reads plus a narrowly
scoped recipient update policy.

Security remains enforced in PostgreSQL:

- only a note author or recipient can select the row;
- only the recipient can update the row;
- browser updates are limited to `seen_at` and `dismissed_at`;
- note text, sender, recipient, couple, and delivery mode cannot be edited;
- pending surprises are filtered out of the normal received-notes screen until
  the popup controller marks them seen.

`CoupleProvider` also keeps the existing workspace mounted during background
count refreshes, preventing the full app from flickering or resetting.
