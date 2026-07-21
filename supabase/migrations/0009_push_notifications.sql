-- =========================================================
-- PWA PUSH NOTIFICATIONS
-- =========================================================
-- Adds per-device Web Push subscriptions, user preferences, private queued
-- notification jobs, scheduled date reminders, and bet lifecycle alerts.
--
-- Privacy rules:
-- - Surprise notes are explicitly unsupported by this queue.
-- - Hidden prize and punishment text is never placed in a notification.
-- - Push endpoints and encryption keys are readable only by their owner.
-- - Notification jobs are not directly readable by browser clients.
-- - Only the service-role Edge Function can claim or update queued jobs.

begin;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  event_reminders_enabled boolean not null default true,
  bet_updates_enabled boolean not null default true,
  reminder_minutes_before integer not null default 1440 check (
    reminder_minutes_before between 5 and 10080
  ),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '08:00',
  timezone text not null default 'America/Toronto' check (
    char_length(timezone) between 1 and 80
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4000),
  p256dh_key text not null check (char_length(p256dh_key) between 20 and 500),
  auth_key text not null check (char_length(auth_key) between 8 and 500),
  device_label text check (
    device_label is null or char_length(device_label) <= 120
  ),
  user_agent text check (
    user_agent is null or char_length(user_agent) <= 600
  ),
  is_active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'test',
      'date_reminder',
      'bet_invitation',
      'bet_accepted',
      'bet_rejected',
      'bet_cancelled',
      'settlement_proposed',
      'settlement_disputed',
      'settlement_confirmed',
      'settlement_draw',
      'outcome_revealed',
      'completion_requested',
      'completion_confirmed',
      'outcome_waived'
    )
  ),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  route text not null default '/' check (
    char_length(route) between 1 and 300 and route like '/%'
  ),
  related_entity_type text check (
    related_entity_type is null
    or related_entity_type in ('date_idea', 'bet', 'settlement', 'system')
  ),
  related_entity_id uuid,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'sent', 'cancelled', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 300),
  sent_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id, is_active, updated_at desc);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (status, scheduled_for, created_at)
  where status = 'pending';

create index if not exists notification_jobs_user_type_idx
  on public.notification_jobs (user_id, notification_type, created_at desc);

create index if not exists notification_jobs_related_idx
  on public.notification_jobs (related_entity_type, related_entity_id, status);

-- Reuse the existing project timestamp helper.
drop trigger if exists notification_preferences_set_updated_at
  on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at
  on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists notification_jobs_set_updated_at
  on public.notification_jobs;
create trigger notification_jobs_set_updated_at
before update on public.notification_jobs
for each row execute function public.set_updated_at();

-- Existing users receive a preference row immediately.
insert into public.notification_preferences (user_id)
select profiles.id
from public.profiles
on conflict (user_id) do nothing;

-- Future users receive one when handle_new_user() creates their profile.
create or replace function public.create_notification_preferences_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_create_notification_preferences
  on public.profiles;
create trigger profiles_create_notification_preferences
after insert on public.profiles
for each row execute function public.create_notification_preferences_for_profile();

-- =========================================================
-- ROW LEVEL SECURITY AND PRIVILEGES
-- =========================================================

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;

drop policy if exists "notification_preferences_select_own"
  on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_select_own"
  on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (user_id = (select auth.uid()));

-- Browser clients use security-definer RPCs for all writes. This prevents a
-- user from assigning a subscription to somebody else or editing delivery
-- failure bookkeeping owned by the Edge Function.
revoke all on public.notification_preferences from anon;
revoke all on public.push_subscriptions from anon;
revoke all on public.notification_jobs from anon;

revoke insert, update, delete on public.notification_preferences from authenticated;
revoke insert, update, delete on public.push_subscriptions from authenticated;
revoke all on public.notification_jobs from authenticated;

grant select on public.notification_preferences to authenticated;
grant select on public.push_subscriptions to authenticated;

-- =========================================================
-- QUIET-HOURS CALCULATION
-- =========================================================

create or replace function public.next_allowed_notification_time(
  p_user_id uuid,
  p_requested_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_preferences public.notification_preferences;
  v_local_requested timestamp;
  v_local_release timestamp;
  v_local_time time;
begin
  select *
  into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if v_preferences.user_id is null
    or not v_preferences.quiet_hours_enabled
    or v_preferences.quiet_hours_start = v_preferences.quiet_hours_end then
    return p_requested_at;
  end if;

  v_local_requested := p_requested_at at time zone v_preferences.timezone;
  v_local_time := v_local_requested::time;

  -- Quiet period contained within one calendar day.
  if v_preferences.quiet_hours_start < v_preferences.quiet_hours_end then
    if v_local_time >= v_preferences.quiet_hours_start
      and v_local_time < v_preferences.quiet_hours_end then
      v_local_release :=
        v_local_requested::date + v_preferences.quiet_hours_end;
      return v_local_release at time zone v_preferences.timezone;
    end if;

    return p_requested_at;
  end if;

  -- Quiet period crosses midnight, for example 22:00–08:00.
  if v_local_time >= v_preferences.quiet_hours_start then
    v_local_release :=
      (v_local_requested::date + 1) + v_preferences.quiet_hours_end;
    return v_local_release at time zone v_preferences.timezone;
  end if;

  if v_local_time < v_preferences.quiet_hours_end then
    v_local_release :=
      v_local_requested::date + v_preferences.quiet_hours_end;
    return v_local_release at time zone v_preferences.timezone;
  end if;

  return p_requested_at;
end;
$$;

-- =========================================================
-- PRIVATE QUEUE HELPER
-- =========================================================

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
  -- Surprise notes must never be converted into visible push notifications.
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

  -- Do not build a queue for users who have no enabled devices. When a device
  -- is later enabled, future date reminders are rebuilt automatically.
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

-- =========================================================
-- DATE REMINDER SCHEDULING
-- =========================================================

create or replace function public.rebuild_date_idea_notification_jobs(
  p_idea_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idea public.date_ideas;
  v_member record;
  v_requested_at timestamptz;
  v_local_label text;
begin
  -- Any not-yet-sent reminder for this idea is obsolete before rebuilding.
  update public.notification_jobs
  set
    status = 'cancelled',
    last_error = 'Reminder replaced by newer date settings.'
  where related_entity_type = 'date_idea'
    and related_entity_id = p_idea_id
    and status in ('pending', 'processing');

  select *
  into v_idea
  from public.date_ideas
  where id = p_idea_id;

  if v_idea.id is null
    or v_idea.status <> 'planned'
    or v_idea.planned_for is null
    or v_idea.planned_for <= now() then
    return;
  end if;

  for v_member in
    select
      members.user_id,
      preferences.reminder_minutes_before,
      preferences.timezone
    from public.couple_members as members
    join public.notification_preferences as preferences
      on preferences.user_id = members.user_id
    where members.couple_id = v_idea.couple_id
      and preferences.event_reminders_enabled
  loop
    v_requested_at := greatest(
      now(),
      v_idea.planned_for
        - make_interval(mins => v_member.reminder_minutes_before)
    );

    v_local_label := to_char(
      v_idea.planned_for at time zone v_member.timezone,
      'FMMon FMDD at FMHH12:MI AM'
    );

    perform public.queue_push_notification(
      v_member.user_id,
      v_idea.couple_id,
      'date_reminder',
      'Upcoming date',
      v_idea.title || ' · ' || v_local_label,
      '/ideas',
      'date_idea',
      v_idea.id,
      v_requested_at,
      'date:' || v_idea.id::text || ':' || v_member.user_id::text || ':'
        || extract(epoch from v_idea.planned_for)::bigint::text || ':'
        || v_member.reminder_minutes_before::text
    );
  end loop;
end;
$$;

create or replace function public.refresh_user_date_reminders(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idea_id uuid;
begin
  for v_idea_id in
    select date_ideas.id
    from public.date_ideas
    join public.couple_members
      on couple_members.couple_id = date_ideas.couple_id
    where couple_members.user_id = p_user_id
      and date_ideas.status = 'planned'
      and date_ideas.planned_for > now()
  loop
    perform public.rebuild_date_idea_notification_jobs(v_idea_id);
  end loop;
end;
$$;

create or replace function public.sync_date_idea_notification_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.notification_jobs
    set
      status = 'cancelled',
      last_error = 'The planned date was deleted.'
    where related_entity_type = 'date_idea'
      and related_entity_id = old.id
      and status in ('pending', 'processing');

    return old;
  end if;

  perform public.rebuild_date_idea_notification_jobs(new.id);
  return new;
end;
$$;

drop trigger if exists date_ideas_sync_notification_jobs
  on public.date_ideas;
create trigger date_ideas_sync_notification_jobs
after insert or update of title, status, planned_for on public.date_ideas
for each row execute function public.sync_date_idea_notification_jobs();

drop trigger if exists date_ideas_cancel_notification_jobs
  on public.date_ideas;
create trigger date_ideas_cancel_notification_jobs
after delete on public.date_ideas
for each row execute function public.sync_date_idea_notification_jobs();

-- =========================================================
-- BROWSER-SAFE SETTINGS AND SUBSCRIPTION RPCS
-- =========================================================

create or replace function public.set_notification_preferences(
  p_event_reminders_enabled boolean,
  p_bet_updates_enabled boolean,
  p_reminder_minutes_before integer,
  p_quiet_hours_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_timezone text
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_preferences public.notification_preferences;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_reminder_minutes_before not between 5 and 10080 then
    raise exception 'Choose a reminder between 5 minutes and 7 days.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Choose a valid timezone.';
  end if;

  insert into public.notification_preferences (
    user_id,
    event_reminders_enabled,
    bet_updates_enabled,
    reminder_minutes_before,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone
  )
  values (
    v_user_id,
    p_event_reminders_enabled,
    p_bet_updates_enabled,
    p_reminder_minutes_before,
    p_quiet_hours_enabled,
    p_quiet_hours_start,
    p_quiet_hours_end,
    p_timezone
  )
  on conflict (user_id) do update
  set
    event_reminders_enabled = excluded.event_reminders_enabled,
    bet_updates_enabled = excluded.bet_updates_enabled,
    reminder_minutes_before = excluded.reminder_minutes_before,
    quiet_hours_enabled = excluded.quiet_hours_enabled,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    timezone = excluded.timezone
  returning * into v_preferences;

  perform public.refresh_user_date_reminders(v_user_id);
  return v_preferences;
end;
$$;

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_device_label text default null,
  p_user_agent text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_subscription public.push_subscriptions;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh_key), '') is null
    or nullif(trim(p_auth_key), '') is null then
    raise exception 'The browser did not provide a complete push subscription.';
  end if;

  insert into public.notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh_key,
    auth_key,
    device_label,
    user_agent,
    is_active,
    failure_count,
    last_error
  )
  values (
    v_user_id,
    trim(p_endpoint),
    trim(p_p256dh_key),
    trim(p_auth_key),
    nullif(trim(p_device_label), ''),
    nullif(trim(p_user_agent), ''),
    true,
    0,
    null
  )
  on conflict (endpoint) do update
  set
    user_id = excluded.user_id,
    p256dh_key = excluded.p256dh_key,
    auth_key = excluded.auth_key,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    is_active = true,
    failure_count = 0,
    last_error = null
  returning * into v_subscription;

  perform public.refresh_user_date_reminders(v_user_id);
  return v_subscription;
end;
$$;

create or replace function public.disable_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  update public.push_subscriptions
  set is_active = false
  where endpoint = p_endpoint
    and user_id = v_user_id;

  if not exists (
    select 1
    from public.push_subscriptions
    where user_id = v_user_id
      and is_active
  ) then
    update public.notification_jobs
    set
      status = 'cancelled',
      last_error = 'Notifications are disabled on every registered device.'
    where user_id = v_user_id
      and status in ('pending', 'processing');
  end if;
end;
$$;

create or replace function public.enqueue_test_notification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_couple_id uuid;
  v_job_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.push_subscriptions
    where user_id = v_user_id
      and is_active
  ) then
    raise exception 'Enable notifications on this device first.';
  end if;

  select couple_id
  into v_couple_id
  from public.couple_members
  where user_id = v_user_id;

  v_job_id := public.queue_push_notification(
    v_user_id,
    v_couple_id,
    'test',
    'Together notifications are ready',
    'Date reminders and bet updates can now reach this device.',
    '/',
    'system',
    null,
    now(),
    'test:' || v_user_id::text || ':' || gen_random_uuid()::text
  );

  return v_job_id;
end;
$$;

-- =========================================================
-- BET LIFECYCLE NOTIFICATIONS
-- =========================================================

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
      'Your partner invited you to review “' || new.title || '”.',
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

drop trigger if exists bets_queue_lifecycle_notifications on public.bets;
create trigger bets_queue_lifecycle_notifications
after insert or update of status on public.bets
for each row execute function public.queue_bet_lifecycle_notifications();

create or replace function public.queue_settlement_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet public.bets;
  v_actor_user_id uuid;
  v_recipient_user_id uuid;
  v_spinner_user_id uuid;
  v_timestamp timestamptz;
begin
  select *
  into v_bet
  from public.bets
  where id = new.bet_id;

  if v_bet.id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_actor_user_id := new.proposed_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;
    v_timestamp := new.proposed_at;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'settlement_proposed',
      'Bet result proposed',
      'Your partner proposed a result for “' || v_bet.title || '”.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':proposed:'
        || extract(epoch from v_timestamp)::bigint::text || ':'
        || v_recipient_user_id::text
    );

    return new;
  end if;

  if new.status = 'awaiting_confirmation'
    and (
      old.status is distinct from new.status
      or old.proposed_at is distinct from new.proposed_at
    ) then
    v_actor_user_id := new.proposed_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;
    v_timestamp := new.proposed_at;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'settlement_proposed',
      'Bet result proposed',
      'Your partner proposed a result for “' || v_bet.title || '”.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':proposed:'
        || extract(epoch from v_timestamp)::bigint::text || ':'
        || v_recipient_user_id::text
    );

    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'disputed' then
    v_actor_user_id := new.responded_by;
    v_recipient_user_id := new.proposed_by;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'settlement_disputed',
      'Bet result disputed',
      'Your partner wants to revisit the result for “' || v_bet.title || '”.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':disputed:'
        || extract(epoch from new.disputed_at)::bigint::text || ':'
        || v_recipient_user_id::text
    );
  elsif new.status = 'draw' then
    v_actor_user_id := new.responded_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'settlement_draw',
      'Draw confirmed',
      '“' || v_bet.title || '” was settled as a draw.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':draw:' || v_recipient_user_id::text
    );
  elsif new.status = 'ready_to_reveal' then
    v_actor_user_id := new.responded_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;
    v_spinner_user_id := case
      when new.consequence_type = 'prize' then new.winner_user_id
      else new.loser_user_id
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'settlement_confirmed',
      case
        when v_recipient_user_id = v_spinner_user_id then 'Your wheel is ready'
        else 'Bet result confirmed'
      end,
      case
        when v_recipient_user_id = v_spinner_user_id
          then 'Open Together to spin the private wheel for “' || v_bet.title || '”.'
        else 'The result for “' || v_bet.title || '” is ready for your partner to reveal.'
      end,
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':confirmed:' || v_recipient_user_id::text
    );
  elsif new.status = 'revealed' then
    v_actor_user_id := case
      when new.consequence_type = 'prize' then new.winner_user_id
      else new.loser_user_id
    end;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'outcome_revealed',
      'Wheel result revealed',
      'Open Together to see the revealed result for “' || v_bet.title || '”.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':revealed:' || v_recipient_user_id::text
    );
  elsif new.status = 'completion_requested' then
    v_actor_user_id := new.completion_requested_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'completion_requested',
      'Completion confirmation requested',
      'Your partner marked the result for “' || v_bet.title || '” as complete.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':completion-request:'
        || v_recipient_user_id::text
    );
  elsif new.status = 'completed' then
    v_actor_user_id := new.completed_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'completion_confirmed',
      'Bet result completed',
      'The result for “' || v_bet.title || '” was confirmed complete.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':completed:' || v_recipient_user_id::text
    );
  elsif new.status = 'waived' then
    v_actor_user_id := new.waived_by;
    v_recipient_user_id := case
      when v_actor_user_id = v_bet.created_by then v_bet.opponent_id
      else v_bet.created_by
    end;

    perform public.queue_push_notification(
      v_recipient_user_id,
      new.couple_id,
      'outcome_waived',
      'Bet result waived',
      'Your partner waived the result for “' || v_bet.title || '”.',
      '/bets',
      'settlement',
      new.id,
      now(),
      'settlement:' || new.id::text || ':waived:' || v_recipient_user_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists bet_settlements_queue_notifications
  on public.bet_settlements;
create trigger bet_settlements_queue_notifications
after insert or update on public.bet_settlements
for each row execute function public.queue_settlement_notifications();

-- =========================================================
-- EDGE-FUNCTION JOB CLAIMING
-- =========================================================

create or replace function public.claim_notification_jobs(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  notification_type text,
  title text,
  body text,
  route text,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    select jobs.id
    from public.notification_jobs as jobs
    where jobs.status = 'pending'
      and jobs.scheduled_for <= now()
    order by jobs.scheduled_for, jobs.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_jobs as jobs
  set
    status = 'processing',
    attempts = jobs.attempts + 1,
    last_error = null
  from claimed
  where jobs.id = claimed.id
  returning
    jobs.id,
    jobs.user_id,
    jobs.notification_type,
    jobs.title,
    jobs.body,
    jobs.route,
    jobs.attempts;
end;
$$;

-- =========================================================
-- FUNCTION PRIVILEGES
-- =========================================================

revoke all on function public.next_allowed_notification_time(uuid, timestamptz)
  from public;
revoke all on function public.queue_push_notification(
  uuid, uuid, text, text, text, text, text, uuid, timestamptz, text
) from public;
revoke all on function public.rebuild_date_idea_notification_jobs(uuid)
  from public;
revoke all on function public.refresh_user_date_reminders(uuid)
  from public;
revoke all on function public.set_notification_preferences(
  boolean, boolean, integer, boolean, time, time, text
) from public;
revoke all on function public.upsert_push_subscription(
  text, text, text, text, text
) from public;
revoke all on function public.disable_push_subscription(text) from public;
revoke all on function public.enqueue_test_notification() from public;
revoke all on function public.claim_notification_jobs(integer) from public;

grant execute on function public.set_notification_preferences(
  boolean, boolean, integer, boolean, time, time, text
) to authenticated;
grant execute on function public.upsert_push_subscription(
  text, text, text, text, text
) to authenticated;
grant execute on function public.disable_push_subscription(text)
  to authenticated;
grant execute on function public.enqueue_test_notification()
  to authenticated;

grant execute on function public.claim_notification_jobs(integer)
  to service_role;

grant select, insert, update, delete on public.push_subscriptions
  to service_role;
grant select, insert, update, delete on public.notification_jobs
  to service_role;
grant select on public.notification_preferences
  to service_role;

notify pgrst, 'reload schema';

commit;
