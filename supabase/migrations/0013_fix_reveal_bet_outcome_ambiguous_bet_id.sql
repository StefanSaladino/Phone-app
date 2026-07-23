-- =========================================================
-- MIGRATION 0013
-- Fix reveal_bet_outcome() PL/pgSQL column ambiguity
--
-- The function returns a column named bet_id. In PL/pgSQL, RETURNS TABLE
-- columns are variables inside the function body, so an unqualified
-- `where bet_id = p_bet_id` can refer to either the output variable or the
-- public.bet_settlements column. Qualifying every table reference removes
-- that ambiguity without changing the function contract or privacy model.
-- =========================================================

begin;

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

  select bets.*
  into v_bet
  from public.bets as bets
  where bets.id = p_bet_id;

  if v_bet.id is null then
    raise exception 'Bet not found.';
  end if;

  if v_user_id not in (v_bet.created_by, v_bet.opponent_id) then
    raise exception 'You are not part of this bet.';
  end if;

  select settlements.*
  into v_settlement
  from public.bet_settlements as settlements
  where settlements.bet_id = p_bet_id
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
    update public.bet_settlements as settlements
    set
      status = 'revealed',
      revealed_at = now()
    where settlements.id = v_settlement.id
    returning settlements.* into v_settlement;
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

-- Preserve the original RPC access model explicitly.
revoke all on function public.reveal_bet_outcome(uuid) from public;
grant execute on function public.reveal_bet_outcome(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
