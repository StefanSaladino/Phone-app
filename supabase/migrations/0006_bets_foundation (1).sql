-- =========================================================
-- BETS FOUNDATION — PRIVATE WHEELS
-- =========================================================
-- Adds private prize/punishment pools and the first secure bet lifecycle:
-- pending invitation, acceptance, rejection, cancellation, and immutable
-- wheel snapshots when a bet becomes active.
--
-- Privacy and ownership rules:
-- - A prize is created by a user for themself.
-- - A punishment is created by a user for their partner.
-- - Only the creator can read the contents of a wheel item before settlement.
-- - A partner may see only whether the required private pools are ready.
-- - Accepted bets snapshot both private pools so later edits cannot change
--   the possible result for that bet.

begin;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.wheel_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('prize', 'punishment')),
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 600),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type = 'prize' and target_user_id = created_by)
    or
    (item_type = 'punishment' and target_user_id <> created_by)
  )
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  opponent_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 140),
  description text check (description is null or char_length(description) <= 1200),
  creator_prediction text not null check (char_length(creator_prediction) between 1 and 240),
  opponent_prediction text not null check (char_length(opponent_prediction) between 1 and 240),
  settlement_condition text not null check (
    char_length(settlement_condition) between 1 and 500
  ),
  settlement_due_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'rejected', 'cancelled', 'settled')
  ),
  accepted_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by <> opponent_id),
  check (
    (status = 'pending' and accepted_at is null and rejected_at is null and cancelled_at is null)
    or
    (status = 'active' and accepted_at is not null and rejected_at is null and cancelled_at is null)
    or
    (status = 'rejected' and rejected_at is not null and accepted_at is null and cancelled_at is null)
    or
    (status = 'cancelled' and cancelled_at is not null and accepted_at is null and rejected_at is null)
    or
    (status = 'settled' and accepted_at is not null)
  )
);

create table if not exists public.bet_wheel_entries (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  source_wheel_item_id uuid references public.wheel_items(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete restrict,
  item_type text not null check (item_type in ('prize', 'punishment')),
  title_snapshot text not null check (char_length(title_snapshot) between 1 and 120),
  description_snapshot text check (
    description_snapshot is null or char_length(description_snapshot) <= 600
  ),
  created_at timestamptz not null default now(),
  unique (bet_id, source_wheel_item_id),
  check (
    (item_type = 'prize' and target_user_id = created_by)
    or
    (item_type = 'punishment' and target_user_id <> created_by)
  )
);

create index if not exists wheel_items_creator_status_idx
  on public.wheel_items (created_by, status, created_at desc);

create index if not exists wheel_items_couple_owner_type_idx
  on public.wheel_items (couple_id, created_by, item_type, status);

create index if not exists bets_couple_status_idx
  on public.bets (couple_id, status, created_at desc);

create index if not exists bets_opponent_pending_idx
  on public.bets (opponent_id, created_at desc)
  where status = 'pending';

create index if not exists bet_wheel_entries_bet_idx
  on public.bet_wheel_entries (bet_id, created_by, item_type);

-- Reuse the project's existing timestamp helper.
drop trigger if exists wheel_items_set_updated_at on public.wheel_items;
create trigger wheel_items_set_updated_at
before update on public.wheel_items
for each row execute function public.set_updated_at();

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.wheel_items enable row level security;
alter table public.bets enable row level security;
alter table public.bet_wheel_entries enable row level security;

-- Wheel contents remain private to their creator.
drop policy if exists "wheel_items_select_creator" on public.wheel_items;
create policy "wheel_items_select_creator"
on public.wheel_items
for select
to authenticated
using (
  created_by = (select auth.uid())
  and public.is_couple_member(couple_id)
);

drop policy if exists "wheel_items_insert_creator" on public.wheel_items;
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

drop policy if exists "wheel_items_delete_creator" on public.wheel_items;
create policy "wheel_items_delete_creator"
on public.wheel_items
for delete
to authenticated
using (
  created_by = (select auth.uid())
  and public.is_couple_member(couple_id)
);

drop policy if exists "bets_select_members" on public.bets;
create policy "bets_select_members"
on public.bets
for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists "bets_insert_creator" on public.bets;
create policy "bets_insert_creator"
on public.bets
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and opponent_id <> (select auth.uid())
  and status = 'pending'
  and public.is_couple_member(couple_id)
  and public.is_user_in_couple(couple_id, opponent_id)
);

-- No client select policy is intentionally created for bet_wheel_entries.
-- Hidden snapshots are accessed only by security-definer settlement functions.

-- =========================================================
-- PRIVATE WHEEL READINESS
-- =========================================================

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

-- =========================================================
-- SECURE WHEEL ACTIONS
-- =========================================================

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

-- =========================================================
-- SECURE BET ACTIONS
-- =========================================================

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

create or replace function public.reject_bet(p_bet_id uuid)
returns public.bets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_user_id uuid := (select auth.uid());
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
    raise exception 'Only the invited partner can reject this bet.';
  end if;

  if v_bet.status <> 'pending' then
    raise exception 'This bet is no longer awaiting a response.';
  end if;

  update public.bets
  set
    status = 'rejected',
    rejected_at = now()
  where id = p_bet_id
  returning * into v_bet;

  return v_bet;
end;
$$;

create or replace function public.cancel_bet(p_bet_id uuid)
returns public.bets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_user_id uuid := (select auth.uid());
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

  if v_bet.created_by <> v_user_id then
    raise exception 'Only the person who created this invitation can cancel it.';
  end if;

  if v_bet.status <> 'pending' then
    raise exception 'An accepted bet cannot be cancelled from the invitation screen.';
  end if;

  update public.bets
  set
    status = 'cancelled',
    cancelled_at = now()
  where id = p_bet_id
  returning * into v_bet;

  return v_bet;
end;
$$;

-- =========================================================
-- DATA API PRIVILEGES
-- =========================================================

revoke all on public.wheel_items from anon;
revoke all on public.bets from anon;
revoke all on public.bet_wheel_entries from anon;

revoke update on public.wheel_items from authenticated;
revoke update, delete on public.bets from authenticated;
revoke insert, update, delete, select on public.bet_wheel_entries from authenticated;

grant select, insert, delete on public.wheel_items to authenticated;
grant select, insert on public.bets to authenticated;

revoke all on function public.get_wheel_readiness(uuid) from public;
revoke all on function public.archive_wheel_item(uuid) from public;
revoke all on function public.accept_bet(uuid) from public;
revoke all on function public.reject_bet(uuid) from public;
revoke all on function public.cancel_bet(uuid) from public;

grant execute on function public.get_wheel_readiness(uuid) to authenticated;
grant execute on function public.archive_wheel_item(uuid) to authenticated;
grant execute on function public.accept_bet(uuid) to authenticated;
grant execute on function public.reject_bet(uuid) to authenticated;
grant execute on function public.cancel_bet(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
