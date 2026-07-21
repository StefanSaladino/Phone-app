-- =========================================================
-- HIDDEN-ANSWER BETS
-- =========================================================
-- Adds an optional bet type where the creator enters a prediction that is
-- hidden from the invited partner. After acceptance, the invited partner must
-- submit the real answer before the server reveals both values.
--
-- Security rules:
-- - Secret predictions never live in the shared bets table.
-- - The answerer cannot read the secret before submitting their answer.
-- - The submitted answer and reveal happen in one server transaction.
-- - The server suggests a winner using a normalized exact-text comparison.
-- - The existing mutual confirmation/dispute flow remains authoritative.
-- - Push notifications never contain either hidden value.

begin;

-- =========================================================
-- BET TYPE
-- =========================================================

alter table public.bets
  add column if not exists bet_type text not null default 'standard';

alter table public.bets
  drop constraint if exists bets_bet_type_check;

alter table public.bets
  add constraint bets_bet_type_check
  check (bet_type in ('standard', 'hidden_answer'));

-- Hidden-answer predictions are stored in a separate protected table, so the
-- shared prediction columns must be nullable for that bet type.
alter table public.bets
  alter column creator_prediction drop not null,
  alter column opponent_prediction drop not null;

alter table public.bets
  drop constraint if exists bets_prediction_mode_check;

alter table public.bets
  add constraint bets_prediction_mode_check
  check (
    (
      bet_type = 'standard'
      and creator_prediction is not null
      and opponent_prediction is not null
    )
    or
    (
      bet_type = 'hidden_answer'
      and creator_prediction is null
      and opponent_prediction is null
    )
  );

-- Direct client inserts remain available only for normal bets. Hidden-answer
-- bets are created atomically through create_hidden_answer_bet().
drop policy if exists "bets_insert_creator" on public.bets;
create policy "bets_insert_creator"
on public.bets
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and opponent_id <> (select auth.uid())
  and bet_type = 'standard'
  and creator_prediction is not null
  and opponent_prediction is not null
  and status = 'pending'
  and public.is_couple_member(couple_id)
  and public.is_user_in_couple(couple_id, opponent_id)
);

-- =========================================================
-- PROTECTED HIDDEN VALUES
-- =========================================================

create table if not exists public.bet_hidden_answers (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null unique references public.bets(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  secret_owner_id uuid not null references public.profiles(id) on delete restrict,
  answerer_user_id uuid not null references public.profiles(id) on delete restrict,
  secret_answer text not null check (char_length(secret_answer) between 1 and 240),
  submitted_answer text check (
    submitted_answer is null or char_length(submitted_answer) between 1 and 240
  ),
  status text not null default 'awaiting_answer' check (
    status in ('awaiting_answer', 'revealed')
  ),
  exact_match boolean,
  submitted_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (secret_owner_id <> answerer_user_id),
  check (
    (
      status = 'awaiting_answer'
      and submitted_answer is null
      and exact_match is null
      and submitted_at is null
      and revealed_at is null
    )
    or
    (
      status = 'revealed'
      and submitted_answer is not null
      and exact_match is not null
      and submitted_at is not null
      and revealed_at is not null
    )
  )
);

create index if not exists bet_hidden_answers_couple_status_idx
  on public.bet_hidden_answers (couple_id, status, created_at desc);

create index if not exists bet_hidden_answers_answerer_idx
  on public.bet_hidden_answers (answerer_user_id, status, created_at desc);

drop trigger if exists bet_hidden_answers_set_updated_at
  on public.bet_hidden_answers;
create trigger bet_hidden_answers_set_updated_at
before update on public.bet_hidden_answers
for each row execute function public.set_updated_at();

alter table public.bet_hidden_answers enable row level security;

-- No direct browser policy is created. Every read and write passes through a
-- security-definer function that decides which fields are safe for this user.
revoke all on public.bet_hidden_answers from anon;
revoke all on public.bet_hidden_answers from authenticated;

-- =========================================================
-- ATOMIC CREATION
-- =========================================================

create or replace function public.create_hidden_answer_bet(
  p_couple_id uuid,
  p_opponent_id uuid,
  p_title text,
  p_description text,
  p_secret_answer text,
  p_settlement_condition text,
  p_settlement_due_at timestamptz default null
)
returns public.bets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_bet public.bets;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_couple_member(p_couple_id) then
    raise exception 'You cannot create a bet for this couple.';
  end if;

  if p_opponent_id = v_user_id
    or not public.is_user_in_couple(p_couple_id, p_opponent_id) then
    raise exception 'Choose your linked partner for this bet.';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 1 and 140 then
    raise exception 'Give the hidden-answer bet a title between 1 and 140 characters.';
  end if;

  if p_description is not null and char_length(trim(p_description)) > 1200 then
    raise exception 'Bet terms must be 1200 characters or fewer.';
  end if;

  if char_length(trim(coalesce(p_secret_answer, ''))) not between 1 and 240 then
    raise exception 'Enter a hidden prediction between 1 and 240 characters.';
  end if;

  if char_length(trim(coalesce(p_settlement_condition, ''))) not between 1 and 500 then
    raise exception 'Explain when the real answer should be entered.';
  end if;

  insert into public.bets (
    couple_id,
    created_by,
    opponent_id,
    bet_type,
    title,
    description,
    creator_prediction,
    opponent_prediction,
    settlement_condition,
    settlement_due_at,
    status
  )
  values (
    p_couple_id,
    v_user_id,
    p_opponent_id,
    'hidden_answer',
    trim(p_title),
    nullif(trim(p_description), ''),
    null,
    null,
    trim(p_settlement_condition),
    p_settlement_due_at,
    'pending'
  )
  returning * into v_bet;

  insert into public.bet_hidden_answers (
    bet_id,
    couple_id,
    secret_owner_id,
    answerer_user_id,
    secret_answer
  )
  values (
    v_bet.id,
    v_bet.couple_id,
    v_bet.created_by,
    v_bet.opponent_id,
    trim(p_secret_answer)
  );

  return v_bet;
end;
$$;

-- =========================================================
-- PRIVACY-SAFE READER
-- =========================================================

create or replace function public.get_hidden_bet_states(p_couple_id uuid)
returns table (
  bet_id uuid,
  secret_owner_id uuid,
  answerer_user_id uuid,
  status text,
  secret_answer text,
  submitted_answer text,
  exact_match boolean,
  can_submit_answer boolean,
  submitted_at timestamptz,
  revealed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_couple_member(p_couple_id) then
    raise exception 'You cannot view hidden-answer state for this couple.';
  end if;

  return query
  select
    hidden.bet_id,
    hidden.secret_owner_id,
    hidden.answerer_user_id,
    hidden.status,
    case
      when hidden.status = 'revealed' or hidden.secret_owner_id = v_user_id
        then hidden.secret_answer
      else null
    end as secret_answer,
    case
      when hidden.status = 'revealed' then hidden.submitted_answer
      else null
    end as submitted_answer,
    case
      when hidden.status = 'revealed' then hidden.exact_match
      else null
    end as exact_match,
    (
      hidden.status = 'awaiting_answer'
      and hidden.answerer_user_id = v_user_id
      and bets.status = 'active'
    ) as can_submit_answer,
    case
      when hidden.status = 'revealed' then hidden.submitted_at
      else null
    end as submitted_at,
    case
      when hidden.status = 'revealed' then hidden.revealed_at
      else null
    end as revealed_at
  from public.bet_hidden_answers as hidden
  join public.bets as bets
    on bets.id = hidden.bet_id
  where hidden.couple_id = p_couple_id
    and v_user_id in (hidden.secret_owner_id, hidden.answerer_user_id)
  order by hidden.created_at desc;
end;
$$;

-- =========================================================
-- PREVENT EARLY SETTLEMENT
-- =========================================================

create or replace function public.guard_hidden_answer_settlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet_type text;
  v_hidden_status text;
begin
  select bets.bet_type
  into v_bet_type
  from public.bets as bets
  where bets.id = new.bet_id;

  if v_bet_type = 'hidden_answer' then
    select hidden.status
    into v_hidden_status
    from public.bet_hidden_answers as hidden
    where hidden.bet_id = new.bet_id;

    if v_hidden_status is distinct from 'revealed' then
      raise exception 'The real answer must be submitted before this bet can be settled.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bet_settlements_guard_hidden_answer
  on public.bet_settlements;
create trigger bet_settlements_guard_hidden_answer
before insert or update on public.bet_settlements
for each row execute function public.guard_hidden_answer_settlement();

-- =========================================================
-- LOCK ANSWER, REVEAL, AND PROPOSE RESULT
-- =========================================================

create or replace function public.submit_hidden_bet_answer(
  p_bet_id uuid,
  p_submitted_answer text
)
returns table (
  bet_id uuid,
  secret_owner_id uuid,
  answerer_user_id uuid,
  status text,
  secret_answer text,
  submitted_answer text,
  exact_match boolean,
  can_submit_answer boolean,
  submitted_at timestamptz,
  revealed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_bet public.bets;
  v_hidden public.bet_hidden_answers;
  v_exact_match boolean;
  v_suggested_winner_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if char_length(trim(coalesce(p_submitted_answer, ''))) not between 1 and 240 then
    raise exception 'Enter an answer between 1 and 240 characters.';
  end if;

  select *
  into v_bet
  from public.bets
  where id = p_bet_id
  for update;

  if v_bet.id is null or v_bet.bet_type <> 'hidden_answer' then
    raise exception 'Hidden-answer bet not found.';
  end if;

  if v_bet.status <> 'active' then
    raise exception 'Accept this bet before submitting the real answer.';
  end if;

  select *
  into v_hidden
  from public.bet_hidden_answers
  where bet_hidden_answers.bet_id = p_bet_id
  for update;

  if v_hidden.id is null then
    raise exception 'The hidden answer is unavailable.';
  end if;

  if v_hidden.answerer_user_id <> v_user_id then
    raise exception 'Only the designated partner can submit the real answer.';
  end if;

  if v_hidden.status <> 'awaiting_answer' then
    raise exception 'The real answer has already been submitted and revealed.';
  end if;

  v_exact_match :=
    lower(regexp_replace(trim(v_hidden.secret_answer), '[[:space:]]+', ' ', 'g'))
    = lower(regexp_replace(trim(p_submitted_answer), '[[:space:]]+', ' ', 'g'));

  v_suggested_winner_id := case
    when v_exact_match then v_hidden.secret_owner_id
    else v_hidden.answerer_user_id
  end;

  update public.bet_hidden_answers
  set
    submitted_answer = trim(p_submitted_answer),
    status = 'revealed',
    exact_match = v_exact_match,
    submitted_at = now(),
    revealed_at = now()
  where id = v_hidden.id
  returning * into v_hidden;

  if exists (
    select 1
    from public.bet_settlements
    where bet_settlements.bet_id = p_bet_id
  ) then
    raise exception 'This hidden-answer bet already has a settlement in progress.';
  end if;

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
    v_suggested_winner_id,
    case
      when v_exact_match then
        'The hidden prediction exactly matched the submitted answer.'
      else
        'The hidden prediction did not exactly match the submitted answer.'
    end,
    'awaiting_confirmation'
  );

  return query
  select
    v_hidden.bet_id,
    v_hidden.secret_owner_id,
    v_hidden.answerer_user_id,
    v_hidden.status,
    v_hidden.secret_answer,
    v_hidden.submitted_answer,
    v_hidden.exact_match,
    false,
    v_hidden.submitted_at,
    v_hidden.revealed_at;
end;
$$;

-- =========================================================
-- PHASE 9 PUSH-NOTIFICATION INTEGRATION
-- =========================================================

alter table public.notification_jobs
  drop constraint if exists notification_jobs_notification_type_check;

alter table public.notification_jobs
  add constraint notification_jobs_notification_type_check
  check (
    notification_type in (
      'test',
      'date_reminder',
      'bet_invitation',
      'bet_accepted',
      'bet_rejected',
      'bet_cancelled',
      'hidden_answer_required',
      'settlement_proposed',
      'settlement_disputed',
      'settlement_confirmed',
      'settlement_draw',
      'outcome_revealed',
      'completion_requested',
      'completion_confirmed',
      'outcome_waived'
    )
  );

create or replace function public.queue_push_notification(
  p_user_id uuid,
  p_couple_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_route text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_scheduled_for timestamptz,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preferences public.notification_preferences;
  v_job_id uuid;
  v_scheduled_for timestamptz;
begin
  if p_notification_type = 'surprise_note' then
    raise exception 'Surprise notes cannot be queued as push notifications.';
  end if;

  if p_notification_type not in (
    'test',
    'date_reminder',
    'bet_invitation',
    'bet_accepted',
    'bet_rejected',
    'bet_cancelled',
    'hidden_answer_required',
    'settlement_proposed',
    'settlement_disputed',
    'settlement_confirmed',
    'settlement_draw',
    'outcome_revealed',
    'completion_requested',
    'completion_confirmed',
    'outcome_waived'
  ) then
    raise exception 'Unsupported notification type.';
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if v_preferences.user_id is null then
    return null;
  end if;

  if p_notification_type = 'date_reminder'
    and not v_preferences.event_reminders_enabled then
    return null;
  end if;

  if p_notification_type not in ('test', 'date_reminder')
    and not v_preferences.bet_updates_enabled then
    return null;
  end if;

  if not exists (
    select 1
    from public.push_subscriptions
    where user_id = p_user_id
      and is_active
  ) then
    return null;
  end if;

  v_scheduled_for := public.next_allowed_notification_time(
    p_user_id,
    coalesce(p_scheduled_for, now())
  );

  insert into public.notification_jobs (
    user_id,
    couple_id,
    notification_type,
    title,
    body,
    route,
    related_entity_type,
    related_entity_id,
    scheduled_for,
    dedupe_key
  )
  values (
    p_user_id,
    p_couple_id,
    p_notification_type,
    left(trim(p_title), 120),
    left(trim(p_body), 500),
    p_route,
    p_related_entity_type,
    p_related_entity_id,
    v_scheduled_for,
    p_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select id
    into v_job_id
    from public.notification_jobs
    where dedupe_key = p_dedupe_key;
  end if;

  return v_job_id;
end;
$$;

create or replace function public.queue_bet_lifecycle_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.queue_push_notification(
      new.opponent_id,
      new.couple_id,
      'bet_invitation',
      'New bet invitation',
      case
        when new.bet_type = 'hidden_answer'
          then 'Your partner sent a hidden-answer wager for “' || new.title || '”.'
        else 'Your partner invited you to review “' || new.title || '”.'
      end,
      '/bets',
      'bet',
      new.id,
      now(),
      'bet:' || new.id::text || ':invitation:' || new.opponent_id::text
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'active' then
      perform public.queue_push_notification(
        new.created_by,
        new.couple_id,
        'bet_accepted',
        'Bet accepted',
        'Your partner accepted “' || new.title || '”.',
        '/bets',
        'bet',
        new.id,
        now(),
        'bet:' || new.id::text || ':accepted:' || new.created_by::text
      );

      if new.bet_type = 'hidden_answer' then
        perform public.queue_push_notification(
          new.opponent_id,
          new.couple_id,
          'hidden_answer_required',
          'Your answer is needed',
          'Open Together when you are ready to enter the real answer for “'
            || new.title || '”.',
          '/bets',
          'bet',
          new.id,
          now(),
          'bet:' || new.id::text || ':hidden-answer-required:'
            || new.opponent_id::text
        );
      end if;
    elsif new.status = 'rejected' then
      perform public.queue_push_notification(
        new.created_by,
        new.couple_id,
        'bet_rejected',
        'Bet declined',
        'Your partner declined “' || new.title || '”.',
        '/bets',
        'bet',
        new.id,
        now(),
        'bet:' || new.id::text || ':rejected:' || new.created_by::text
      );
    elsif new.status = 'cancelled' then
      perform public.queue_push_notification(
        new.opponent_id,
        new.couple_id,
        'bet_cancelled',
        'Bet invitation cancelled',
        '“' || new.title || '” is no longer awaiting your response.',
        '/bets',
        'bet',
        new.id,
        now(),
        'bet:' || new.id::text || ':cancelled:' || new.opponent_id::text
      );
    end if;
  end if;

  return new;
end;
$$;

-- Existing trigger continues to call the replaced function.

revoke all on function public.create_hidden_answer_bet(
  uuid, uuid, text, text, text, text, timestamptz
) from public;
revoke all on function public.get_hidden_bet_states(uuid) from public;
revoke all on function public.submit_hidden_bet_answer(uuid, text) from public;

grant execute on function public.create_hidden_answer_bet(
  uuid, uuid, text, text, text, text, timestamptz
) to authenticated;
grant execute on function public.get_hidden_bet_states(uuid) to authenticated;
grant execute on function public.submit_hidden_bet_answer(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
