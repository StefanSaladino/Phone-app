-- =========================================================
-- LITTLE NOTES: PRIVATE NEXT-LOGIN DELIVERY
-- =========================================================
-- Run this migration in the Supabase SQL Editor after
-- 0001_initial_schema.sql and 0002_profile_names.sql.

begin;

-- Hide an unclaimed next-login surprise from its recipient's regular
-- note queries. The sender may still see and manage notes they created.
drop policy if exists "notes_select_participants" on public.notes;

create policy "notes_select_participants"
on public.notes
for select
to authenticated
using (
  public.is_couple_member(couple_id)
  and (
    author_id = (select auth.uid())
    or (
      recipient_id = (select auth.uid())
      and (
        delivery_mode = 'inbox'
        or seen_at is not null
      )
    )
  )
);

-- Atomically claims the oldest pending next-login note for the current user.
-- Marking it seen before returning prevents the same note from reopening on
-- refresh or in a second browser tab.
create or replace function public.claim_next_login_note()
returns setof public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_note_id uuid;
begin
  select note.id
  into claimed_note_id
  from public.notes as note
  where note.recipient_id = (select auth.uid())
    and note.delivery_mode = 'next_login'
    and note.seen_at is null
    and note.dismissed_at is null
    and public.is_couple_member(note.couple_id)
  order by note.created_at asc
  for update skip locked
  limit 1;

  if claimed_note_id is null then
    return;
  end if;

  return query
  update public.notes
  set seen_at = now()
  where id = claimed_note_id
    and recipient_id = (select auth.uid())
  returning *;
end;
$$;

-- Marks a regular inbox note as seen without allowing recipients to edit
-- the message, author, recipient, or delivery mode directly.
create or replace function public.mark_note_seen(check_note_id uuid)
returns setof public.notes
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.notes
  set seen_at = coalesce(seen_at, now())
  where id = check_note_id
    and recipient_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  returning *;
end;
$$;

-- Records that the recipient closed a delivered note. This remains separate
-- from seen_at so future UI can distinguish delivery from dismissal.
create or replace function public.dismiss_note(check_note_id uuid)
returns setof public.notes
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.notes
  set
    seen_at = coalesce(seen_at, now()),
    dismissed_at = coalesce(dismissed_at, now())
  where id = check_note_id
    and recipient_id = (select auth.uid())
    and public.is_couple_member(couple_id)
  returning *;
end;
$$;

revoke all on function public.claim_next_login_note() from public;
revoke all on function public.mark_note_seen(uuid) from public;
revoke all on function public.dismiss_note(uuid) from public;

grant execute on function public.claim_next_login_note() to authenticated;
grant execute on function public.mark_note_seen(uuid) to authenticated;
grant execute on function public.dismiss_note(uuid) to authenticated;

commit;
