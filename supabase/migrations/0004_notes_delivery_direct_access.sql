-- =========================================================
-- LITTLE NOTES: ROBUST DIRECT DELIVERY ACCESS
-- =========================================================
-- Replaces the RPC-based surprise delivery added in 0003.
-- Run this migration in the Supabase SQL Editor after 0003.

begin;

-- Both participants may select their notes. The React inbox deliberately hides
-- an unseen next-login note until the popup controller has delivered it.
drop policy if exists "notes_select_participants" on public.notes;

create policy "notes_select_participants"
on public.notes
for select
to authenticated
using (
  public.is_couple_member(couple_id)
  and (
    author_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  )
);

-- Recipients may update only their own delivery state.
drop policy if exists "notes_update_recipient_delivery" on public.notes;

create policy "notes_update_recipient_delivery"
on public.notes
for update
to authenticated
using (
  recipient_id = (select auth.uid())
  and public.is_couple_member(couple_id)
)
with check (
  recipient_id = (select auth.uid())
  and public.is_couple_member(couple_id)
);

-- Keep the note body and relationship fields immutable from the browser.
revoke update on public.notes from authenticated;
grant update (seen_at, dismissed_at) on public.notes to authenticated;

-- The application no longer calls these RPC functions.
drop function if exists public.claim_next_login_note();
drop function if exists public.mark_note_seen(uuid);
drop function if exists public.dismiss_note(uuid);

-- Refresh the Data API schema cache after dropping the RPC endpoints.
notify pgrst, 'reload schema';

commit;
