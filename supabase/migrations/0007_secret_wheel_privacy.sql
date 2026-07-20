-- =========================================================
-- SECRET WHEEL PRIVACY PATCH
-- =========================================================
-- Run this migration only when the earlier approval-based version of 0006
-- has already been executed. New installations should run the revised 0006
-- and skip this compatibility patch.

begin;

-- Remove approval-specific routines and policies first.
drop function if exists public.review_wheel_item(uuid, text);

drop policy if exists "wheel_items_select_members" on public.wheel_items;
drop policy if exists "wheel_items_insert_creator" on public.wheel_items;
drop policy if exists "wheel_items_delete_unapproved_creator" on public.wheel_items;
drop policy if exists "wheel_items_select_creator" on public.wheel_items;
drop policy if exists "wheel_items_delete_creator" on public.wheel_items;
drop policy if exists "bet_wheel_entries_select_members" on public.bet_wheel_entries;

-- Remove the old review metadata and status checks.
alter table public.wheel_items
  drop column if exists reviewed_by,
  drop column if exists reviewed_at;

alter table public.wheel_items
  drop constraint if exists wheel_items_status_check;

update public.wheel_items
set status = case
  when status = 'rejected' then 'archived'
  when status = 'archived' then 'archived'
  else 'active'
end;

alter table public.wheel_items
  add constraint wheel_items_status_check
  check (status in ('active', 'archived'));

alter table public.wheel_items
  alter column status set default 'active';

-- Only the creator can see private wheel contents.
create policy "wheel_items_select_creator"
on public.wheel_items
for select
to authenticated
using (
  created_by = (select auth.uid())
  and public.is_couple_member(couple_id)
);

create policy "wheel_items_insert_creator"
on public.wheel_items
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and public.is_couple_member(couple_id)
  and public.is_user_in_couple(couple_id, target_user_id)
  and (
    (item_type = 'prize' and target_user_id = (select auth.uid()))
    or
    (
      item_type = 'punishment'
      and target_user_id <> (select auth.uid())
    )
  )
);

create policy "wheel_items_delete_creator"
on public.wheel_items
for delete
to authenticated
using (
  created_by = (select auth.uid())
  and public.is_couple_member(couple_id)
);

-- Hidden snapshots are no longer directly readable by clients.
revoke select on public.bet_wheel_entries from authenticated;

create or replace function public.get_wheel_readiness(p_couple_id uuid)
returns table (
  user_id uuid,
  prize_ready boolean,
  punishment_ready boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_couple_member(p_couple_id) then
    raise exception 'You cannot view wheel readiness for this couple.';
  end if;

  return query
  select
    members.user_id,
    exists (
      select 1
      from public.wheel_items
      where wheel_items.couple_id = p_couple_id
        and wheel_items.created_by = members.user_id
        and wheel_items.target_user_id = members.user_id
        and wheel_items.item_type = 'prize'
        and wheel_items.status = 'active'
    ) as prize_ready,
    exists (
      select 1
      from public.wheel_items
      where wheel_items.couple_id = p_couple_id
        and wheel_items.created_by = members.user_id
        and wheel_items.target_user_id <> members.user_id
        and wheel_items.item_type = 'punishment'
        and wheel_items.status = 'active'
    ) as punishment_ready
  from public.couple_members as members
  where members.couple_id = p_couple_id;
end;
$$;

create or replace function public.archive_wheel_item(p_item_id uuid)
returns public.wheel_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.wheel_items;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select *
  into v_item
  from public.wheel_items
  where id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Wheel item not found.';
  end if;

  if v_item.created_by <> v_user_id then
    raise exception 'Only the person who created this private item can archive it.';
  end if;

  if not public.is_couple_member(v_item.couple_id) then
    raise exception 'You cannot archive this wheel item.';
  end if;

  if v_item.status = 'archived' then
    return v_item;
  end if;

  update public.wheel_items
  set status = 'archived'
  where id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

create or replace function public.accept_bet(p_bet_id uuid)
returns public.bets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_user_id uuid := (select auth.uid());
  v_creator_prizes integer;
  v_creator_punishments integer;
  v_opponent_prizes integer;
  v_opponent_punishments integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select *
  into v_bet
  from public.bets
  where id = p_bet_id
  for update;

  if v_bet.id is null then
    raise exception 'Bet not found.';
  end if;

  if v_bet.opponent_id <> v_user_id then
    raise exception 'Only the invited partner can accept this bet.';
  end if;

  if v_bet.status <> 'pending' then
    raise exception 'This bet is no longer awaiting acceptance.';
  end if;

  select
    count(*) filter (
      where item_type = 'prize'
        and created_by = v_bet.created_by
        and target_user_id = v_bet.created_by
    ),
    count(*) filter (
      where item_type = 'punishment'
        and created_by = v_bet.created_by
        and target_user_id = v_bet.opponent_id
    ),
    count(*) filter (
      where item_type = 'prize'
        and created_by = v_bet.opponent_id
        and target_user_id = v_bet.opponent_id
    ),
    count(*) filter (
      where item_type = 'punishment'
        and created_by = v_bet.opponent_id
        and target_user_id = v_bet.created_by
    )
  into
    v_creator_prizes,
    v_creator_punishments,
    v_opponent_prizes,
    v_opponent_punishments
  from public.wheel_items
  where couple_id = v_bet.couple_id
    and status = 'active';

  if v_creator_prizes = 0
    or v_creator_punishments = 0
    or v_opponent_prizes = 0
    or v_opponent_punishments = 0 then
    raise exception using
      message = 'Both partners need a private prize and private punishment option before this bet can begin.',
      hint = 'Each person should privately add at least one prize for themself and one punishment for their partner.';
  end if;

  insert into public.bet_wheel_entries (
    bet_id,
    source_wheel_item_id,
    created_by,
    target_user_id,
    item_type,
    title_snapshot,
    description_snapshot
  )
  select
    v_bet.id,
    wheel_items.id,
    wheel_items.created_by,
    wheel_items.target_user_id,
    wheel_items.item_type,
    wheel_items.title,
    wheel_items.description
  from public.wheel_items
  where couple_id = v_bet.couple_id
    and status = 'active'
  on conflict (bet_id, source_wheel_item_id) do nothing;

  update public.bets
  set
    status = 'active',
    accepted_at = now()
  where id = p_bet_id
  returning * into v_bet;

  return v_bet;
end;
$$;

revoke all on function public.get_wheel_readiness(uuid) from public;
revoke all on function public.archive_wheel_item(uuid) from public;
revoke all on function public.accept_bet(uuid) from public;

grant execute on function public.get_wheel_readiness(uuid) to authenticated;
grant execute on function public.archive_wheel_item(uuid) to authenticated;
grant execute on function public.accept_bet(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
