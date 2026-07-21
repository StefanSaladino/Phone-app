-- =========================================================
-- BET SETTLEMENT GAME
-- =========================================================
-- Adds mutual result confirmation, disputes, draws, a server-authoritative
-- coin flip, a private server-selected wheel result, and voluntary outcome
-- completion tracking.
--
-- Privacy rules:
-- - Locked bet wheel snapshots remain unreadable from the client.
-- - Confirming a winner stores the coin result and selected snapshot privately.
-- - The selected option text is returned only after the correct person spins.
-- - Prize: the winner spins their private prize wheel.
-- - Punishment: the loser spins the winner-created punishment wheel for them.

begin;

-- =========================================================
-- BET SETTLEMENT STATE
-- =========================================================

alter table public.bets
  add column if not exists settled_at timestamptz;

create table if not exists public.bet_settlements (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null unique references public.bets(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  proposed_winner_id uuid references public.profiles(id) on delete restrict,
  proposal_note text check (
    proposal_note is null or char_length(proposal_note) <= 600
  ),
  status text not null default 'awaiting_confirmation' check (
    status in (
      'awaiting_confirmation',
      'disputed',
      'ready_to_reveal',
      'revealed',
      'completion_requested',
      'completed',
      'waived',
      'draw'
    )
  ),
  responded_by uuid references public.profiles(id) on delete restrict,
  response_note text check (
    response_note is null or char_length(response_note) <= 600
  ),
  winner_user_id uuid references public.profiles(id) on delete restrict,
  loser_user_id uuid references public.profiles(id) on delete restrict,
  consequence_type text check (
    consequence_type is null or consequence_type in ('prize', 'punishment')
  ),
  selected_entry_id uuid references public.bet_wheel_entries(id) on delete restrict,
  proposed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  disputed_at timestamptz,
  revealed_at timestamptz,
  completion_requested_by uuid references public.profiles(id) on delete restrict,
  completion_requested_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  completed_at timestamptz,
  waived_by uuid references public.profiles(id) on delete restrict,
  waived_at timestamptz,
  updated_at timestamptz not null default now(),
  check (winner_user_id is null or winner_user_id <> loser_user_id)
);

create index if not exists bet_settlements_couple_status_idx
  on public.bet_settlements (couple_id, status, updated_at desc);

create index if not exists bet_settlements_spinner_lookup_idx
  on public.bet_settlements (winner_user_id, loser_user_id, status);

drop trigger if exists bet_settlements_set_updated_at on public.bet_settlements;
create trigger bet_settlements_set_updated_at
before update on public.bet_settlements
for each row execute function public.set_updated_at();

alter table public.bet_settlements enable row level security;

-- No direct client policy is created. All reads use get_bet_settlements(),
-- which hides the selected wheel text until revealed_at has been set.
revoke all on public.bet_settlements from anon;
revoke all on public.bet_settlements from authenticated;

-- =========================================================
-- SAFE SETTLEMENT READER
-- =========================================================

create or replace function public.get_bet_settlements(p_couple_id uuid)
returns table (
  id uuid,
  bet_id uuid,
  couple_id uuid,
  proposed_by uuid,
  proposed_winner_id uuid,
  proposal_note text,
  status text,
  responded_by uuid,
  response_note text,
  winner_user_id uuid,
  loser_user_id uuid,
  consequence_type text,
  spinner_user_id uuid,
  selected_title text,
  selected_description text,
  proposed_at timestamptz,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  revealed_at timestamptz,
  completion_requested_by uuid,
  completion_requested_at timestamptz,
  completed_by uuid,
  completed_at timestamptz,
  waived_by uuid,
  waived_at timestamptz,
  updated_at timestamptz
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
    raise exception 'You cannot view settlements for this couple.';
  end if;

  return query
  select
    settlements.id,
    settlements.bet_id,
    settlements.couple_id,
    settlements.proposed_by,
    settlements.proposed_winner_id,
    settlements.proposal_note,
    settlements.status,
    settlements.responded_by,
    settlements.response_note,
    settlements.winner_user_id,
    settlements.loser_user_id,
    settlements.consequence_type,
    case
      when settlements.consequence_type = 'prize'
        then settlements.winner_user_id
      when settlements.consequence_type = 'punishment'
        then settlements.loser_user_id
      else null
    end as spinner_user_id,
    case
      when settlements.revealed_at is not null
        then entries.title_snapshot
      else null
    end as selected_title,
    case
      when settlements.revealed_at is not null
        then entries.description_snapshot
      else null
    end as selected_description,
    settlements.proposed_at,
    settlements.confirmed_at,
    settlements.disputed_at,
    settlements.revealed_at,
    settlements.completion_requested_by,
    settlements.completion_requested_at,
    settlements.completed_by,
    settlements.completed_at,
    settlements.waived_by,
    settlements.waived_at,
    settlements.updated_at
  from public.bet_settlements as settlements
  left join public.bet_wheel_entries as entries
    on entries.id = settlements.selected_entry_id
  where settlements.couple_id = p_couple_id
  order by settlements.updated_at desc;
end;
$$;

-- =========================================================
-- PROPOSE OR RE-PROPOSE A RESULT
-- =========================================================

create or replace function public.propose_bet_settlement(
  p_bet_id uuid,
  p_winner_user_id uuid,
  p_note text default null
)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
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

  if v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You are not part of this bet.';
  end if;

  if v_bet.status <> 'active' then
    raise exception 'Only an active bet can be settled.';
  end if;

  if p_winner_user_id is not null
    and p_winner_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'The proposed winner must be one of the two people in the bet.';
  end if;

  if p_note is not null and char_length(trim(p_note)) > 600 then
    raise exception 'Settlement notes must be 600 characters or fewer.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null then
    insert into public.bet_settlements (
      bet_id,
      couple_id,
      proposed_by,
      proposed_winner_id,
      proposal_note,
      status
    )
    values (
      v_bet.id,
      v_bet.couple_id,
      v_user_id,
      p_winner_user_id,
      nullif(trim(p_note), ''),
      'awaiting_confirmation'
    )
    returning * into v_settlement;

    return v_settlement;
  end if;

  if v_settlement.status = 'awaiting_confirmation'
    and v_settlement.proposed_by <> v_user_id then
    raise exception 'Your partner already proposed a result. Confirm or dispute it first.';
  end if;

  if v_settlement.status not in ('awaiting_confirmation', 'disputed') then
    raise exception 'This settlement can no longer be changed.';
  end if;

  update public.bet_settlements
  set
    proposed_by = v_user_id,
    proposed_winner_id = p_winner_user_id,
    proposal_note = nullif(trim(p_note), ''),
    status = 'awaiting_confirmation',
    responded_by = null,
    response_note = null,
    proposed_at = now(),
    confirmed_at = null,
    disputed_at = null,
    winner_user_id = null,
    loser_user_id = null,
    consequence_type = null,
    selected_entry_id = null,
    revealed_at = null,
    completion_requested_by = null,
    completion_requested_at = null,
    completed_by = null,
    completed_at = null,
    waived_by = null,
    waived_at = null
  where id = v_settlement.id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

-- =========================================================
-- DISPUTE A PROPOSED RESULT
-- =========================================================

create or replace function public.dispute_bet_settlement(
  p_bet_id uuid,
  p_reason text default null
)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id;

  if v_bet.id is null then
    raise exception 'Bet not found.';
  end if;

  if v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You are not part of this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null or v_settlement.status <> 'awaiting_confirmation' then
    raise exception 'There is no result awaiting confirmation.';
  end if;

  if v_settlement.proposed_by = v_user_id then
    raise exception 'The person who proposed the result cannot dispute their own proposal.';
  end if;

  if p_reason is not null and char_length(trim(p_reason)) > 600 then
    raise exception 'Dispute notes must be 600 characters or fewer.';
  end if;

  update public.bet_settlements
  set
    status = 'disputed',
    responded_by = v_user_id,
    response_note = nullif(trim(p_reason), ''),
    disputed_at = now()
  where id = v_settlement.id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

-- =========================================================
-- CONFIRM RESULT, FLIP COIN, AND SELECT HIDDEN ENTRY
-- =========================================================

create or replace function public.confirm_bet_settlement(p_bet_id uuid)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
  v_loser_user_id uuid;
  v_consequence_type text;
  v_selected_entry_id uuid;
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

  if v_bet.status <> 'active' then
    raise exception 'Only an active bet can be settled.';
  end if;

  if v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You are not part of this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null or v_settlement.status <> 'awaiting_confirmation' then
    raise exception 'There is no result awaiting confirmation.';
  end if;

  if v_settlement.proposed_by = v_user_id then
    raise exception 'Your partner must confirm the result you proposed.';
  end if;

  -- A null proposed winner represents a mutually confirmed draw.
  if v_settlement.proposed_winner_id is null then
    update public.bet_settlements
    set
      status = 'draw',
      responded_by = v_user_id,
      confirmed_at = now()
    where id = v_settlement.id
    returning * into v_settlement;

    update public.bets
    set
      status = 'settled',
      settled_at = now()
    where id = v_bet.id;

    return v_settlement;
  end if;

  if v_settlement.proposed_winner_id = v_bet.created_by then
    v_loser_user_id := v_bet.opponent_id;
  else
    v_loser_user_id := v_bet.created_by;
  end if;

  -- The server performs the 50/50 coin flip. The client receives only the
  -- resulting consequence type and cannot influence the random decision.
  v_consequence_type := case
    when pg_catalog.random() < 0.5 then 'prize'
    else 'punishment'
  end;

  if v_consequence_type = 'prize' then
    select entries.id
    into v_selected_entry_id
    from public.bet_wheel_entries as entries
    where entries.bet_id = v_bet.id
      and entries.item_type = 'prize'
      and entries.created_by = v_settlement.proposed_winner_id
      and entries.target_user_id = v_settlement.proposed_winner_id
    order by pg_catalog.random()
    limit 1;
  else
    select entries.id
    into v_selected_entry_id
    from public.bet_wheel_entries as entries
    where entries.bet_id = v_bet.id
      and entries.item_type = 'punishment'
      and entries.created_by = v_settlement.proposed_winner_id
      and entries.target_user_id = v_loser_user_id
    order by pg_catalog.random()
    limit 1;
  end if;

  if v_selected_entry_id is null then
    raise exception 'The locked wheel does not contain an eligible result.';
  end if;

  update public.bet_settlements
  set
    status = 'ready_to_reveal',
    responded_by = v_user_id,
    confirmed_at = now(),
    winner_user_id = v_settlement.proposed_winner_id,
    loser_user_id = v_loser_user_id,
    consequence_type = v_consequence_type,
    selected_entry_id = v_selected_entry_id
  where id = v_settlement.id
  returning * into v_settlement;

  update public.bets
  set
    status = 'settled',
    settled_at = now()
  where id = v_bet.id;

  return v_settlement;
end;
$$;

-- =========================================================
-- CORRECT PERSON SPINS AND REVEALS THE PRIVATE RESULT
-- =========================================================

create or replace function public.reveal_bet_outcome(p_bet_id uuid)
returns table (
  bet_id uuid,
  consequence_type text,
  spinner_user_id uuid,
  winner_user_id uuid,
  loser_user_id uuid,
  selected_title text,
  selected_description text,
  revealed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
  v_spinner_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id;

  if v_bet.id is null then
    raise exception 'Bet not found.';
  end if;

  if v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You are not part of this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null
    or v_settlement.status not in (
      'ready_to_reveal',
      'revealed',
      'completion_requested',
      'completed',
      'waived'
    ) then
    raise exception 'This bet does not have a wheel result ready to reveal.';
  end if;

  v_spinner_user_id := case
    when v_settlement.consequence_type = 'prize'
      then v_settlement.winner_user_id
    else v_settlement.loser_user_id
  end;

  if v_settlement.revealed_at is null and v_user_id <> v_spinner_user_id then
    raise exception 'The designated spinner must reveal this wheel result.';
  end if;

  if v_settlement.revealed_at is null then
    update public.bet_settlements
    set
      status = 'revealed',
      revealed_at = now()
    where id = v_settlement.id
    returning * into v_settlement;
  end if;

  return query
  select
    v_settlement.bet_id,
    v_settlement.consequence_type,
    v_spinner_user_id,
    v_settlement.winner_user_id,
    v_settlement.loser_user_id,
    entries.title_snapshot,
    entries.description_snapshot,
    v_settlement.revealed_at
  from public.bet_wheel_entries as entries
  where entries.id = v_settlement.selected_entry_id;
end;
$$;

-- =========================================================
-- VOLUNTARY COMPLETION AND WAIVER
-- =========================================================

create or replace function public.request_bet_outcome_completion(p_bet_id uuid)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id;

  if v_bet.id is null or v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You cannot update this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null or v_settlement.status <> 'revealed' then
    raise exception 'The result must be revealed before completion can be requested.';
  end if;

  update public.bet_settlements
  set
    status = 'completion_requested',
    completion_requested_by = v_user_id,
    completion_requested_at = now()
  where id = v_settlement.id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

create or replace function public.confirm_bet_outcome_completion(p_bet_id uuid)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id;

  if v_bet.id is null or v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You cannot update this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null or v_settlement.status <> 'completion_requested' then
    raise exception 'Completion has not been requested for this result.';
  end if;

  if v_settlement.completion_requested_by = v_user_id then
    raise exception 'Your partner must confirm the completion request.';
  end if;

  update public.bet_settlements
  set
    status = 'completed',
    completed_by = v_user_id,
    completed_at = now()
  where id = v_settlement.id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

create or replace function public.waive_bet_outcome(p_bet_id uuid)
returns public.bet_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_settlement public.bet_settlements;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_bet
  from public.bets
  where id = p_bet_id;

  if v_bet.id is null or v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You cannot update this bet.';
  end if;

  select *
  into v_settlement
  from public.bet_settlements
  where bet_id = p_bet_id
  for update;

  if v_settlement.id is null
    or v_settlement.status not in ('revealed', 'completion_requested') then
    raise exception 'Only a revealed, unfinished result can be waived.';
  end if;

  if v_settlement.winner_user_id <> v_user_id then
    raise exception 'Only the winner can waive the prize or punishment.';
  end if;

  update public.bet_settlements
  set
    status = 'waived',
    waived_by = v_user_id,
    waived_at = now()
  where id = v_settlement.id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

-- =========================================================
-- DATA API PRIVILEGES
-- =========================================================

revoke all on function public.get_bet_settlements(uuid) from public;
revoke all on function public.propose_bet_settlement(uuid, uuid, text) from public;
revoke all on function public.dispute_bet_settlement(uuid, text) from public;
revoke all on function public.confirm_bet_settlement(uuid) from public;
revoke all on function public.reveal_bet_outcome(uuid) from public;
revoke all on function public.request_bet_outcome_completion(uuid) from public;
revoke all on function public.confirm_bet_outcome_completion(uuid) from public;
revoke all on function public.waive_bet_outcome(uuid) from public;

grant execute on function public.get_bet_settlements(uuid) to authenticated;
grant execute on function public.propose_bet_settlement(uuid, uuid, text) to authenticated;
grant execute on function public.dispute_bet_settlement(uuid, text) to authenticated;
grant execute on function public.confirm_bet_settlement(uuid) to authenticated;
grant execute on function public.reveal_bet_outcome(uuid) to authenticated;
grant execute on function public.request_bet_outcome_completion(uuid) to authenticated;
grant execute on function public.confirm_bet_outcome_completion(uuid) to authenticated;
grant execute on function public.waive_bet_outcome(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
