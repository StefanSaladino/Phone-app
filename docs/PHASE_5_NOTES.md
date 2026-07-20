# Phase 5 — Little Notes

Phase 5 adds the private two-person messaging feature.

## Included

- Normal inbox notes
- Private next-login surprise notes
- Received and sent history
- Automatic read state for inbox notes
- Restricted database functions for claim, seen, and dismiss actions
- Delete confirmation
- Live unread dashboard count refresh
- Animated post-it surprise card
- Sequential delivery when more than one surprise is waiting

## Database migration

Run `supabase/migrations/0003_notes_delivery.sql` manually in the Supabase SQL Editor.

The migration deliberately avoids granting direct `UPDATE` access to `notes`. A recipient can only update `seen_at` and `dismissed_at` through security-definer functions that confirm the authenticated recipient and couple membership.
