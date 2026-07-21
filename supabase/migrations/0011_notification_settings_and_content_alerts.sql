-- =========================================================
-- PHASE 9 REFINEMENT:
-- SETTINGS, CONTENT ALERTS, AND BADGE SUPPORT
-- =========================================================

begin;

-- ---------------------------------------------------------
-- Per-user opt-in preferences
-- ---------------------------------------------------------

alter table public.notification_preferences
  add column if not exists new_ideas_enabled boolean not null default false,
  add column if not exists new_places_enabled boolean not null default false;

-- ---------------------------------------------------------
-- Keep notification type constraints forward-compatible.
--
-- Surprise notes remain explicitly prohibited from the push queue.
-- ---------------------------------------------------------

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        select constraint_name
        from information_schema.constraint_column_usage
        where table_schema = 'public'
          and table_name = 'notification_jobs'
          and column_name = 'notification_type'
      )
  loop
    execute format(
      'alter table public.notification_jobs drop constraint if exists %I',
      v_constraint.constraint_name
    );
  end loop;
end;
$$;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_notification_type_format_check;

alter table public.notification_jobs
  add constraint notification_jobs_notification_type_format_check
  check (
    notification_type ~ '^[a-z][a-z0-9_]{0,63}$'
    and notification_type <> 'surprise_note'
  );

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        select constraint_name
        from information_schema.constraint_column_usage
        where table_schema = 'public'
          and table_name = 'notification_jobs'
          and column_name = 'related_entity_type'
      )
  loop
    execute format(
      'alter table public.notification_jobs drop constraint if exists %I',
      v_constraint.constraint_name
    );
  end loop;
end;
$$;

alter table public.notification_jobs
  drop constraint if exists notification_jobs_related_entity_type_format_check;

alter table public.notification_jobs
  add constraint notification_jobs_related_entity_type_format_check
  check (
    related_entity_type is null
    or related_entity_type ~ '^[a-z][a-z0-9_]{0,63}$'
  );

-- ---------------------------------------------------------
-- Safe preference readers and writers
-- ---------------------------------------------------------

create or replace function public.get_content_notification_preferences()
returns table (
  new_ideas_enabled boolean,
  new_places_enabled boolean
)
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

  insert into public.notification_preferences (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return query
  select
    preferences.new_ideas_enabled,
    preferences.new_places_enabled
  from public.notification_preferences as preferences
  where preferences.user_id = v_user_id;
end;
$$;

create or replace function public.set_content_notification_preferences(
  p_new_ideas_enabled boolean,
  p_new_places_enabled boolean
)
returns table (
  new_ideas_enabled boolean,
  new_places_enabled boolean
)
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

  insert into public.notification_preferences (
    user_id,
    new_ideas_enabled,
    new_places_enabled,
    updated_at
  )
  values (
    v_user_id,
    coalesce(p_new_ideas_enabled, false),
    coalesce(p_new_places_enabled, false),
    now()
  )
  on conflict (user_id)
  do update set
    new_ideas_enabled = excluded.new_ideas_enabled,
    new_places_enabled = excluded.new_places_enabled,
    updated_at = now();

  return query
  select
    preferences.new_ideas_enabled,
    preferences.new_places_enabled
  from public.notification_preferences as preferences
  where preferences.user_id = v_user_id;
end;
$$;

revoke all
on function public.get_content_notification_preferences()
from public;

revoke all
on function public.set_content_notification_preferences(boolean, boolean)
from public;

grant execute
on function public.get_content_notification_preferences()
to authenticated;

grant execute
on function public.set_content_notification_preferences(boolean, boolean)
to authenticated;

-- ---------------------------------------------------------
-- Internal content-alert queue helper
-- ---------------------------------------------------------

create or replace function public.queue_content_notification(
  p_user_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_route text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preferences public.notification_preferences%rowtype;
  v_local_now timestamp without time zone;
  v_local_time time without time zone;
  v_target_date date;
  v_scheduled_for timestamptz := now();
  v_is_enabled boolean := false;
begin
  if p_notification_type not in ('new_idea', 'new_place') then
    raise exception 'Unsupported content notification type.';
  end if;

  select *
  into v_preferences
  from public.notification_preferences
  where user_id = p_user_id;

  if not found then
    return;
  end if;

  if p_notification_type = 'new_idea' then
    v_is_enabled := v_preferences.new_ideas_enabled;
  elsif p_notification_type = 'new_place' then
    v_is_enabled := v_preferences.new_places_enabled;
  end if;

  if not v_is_enabled then
    return;
  end if;

  -- Respect this user's existing quiet-hour preferences.
  if v_preferences.quiet_hours_enabled
    and v_preferences.quiet_hours_start is distinct from
      v_preferences.quiet_hours_end then

    v_local_now := timezone(
      coalesce(v_preferences.timezone, 'America/Toronto'),
      now()
    );

    v_local_time := v_local_now::time;
    v_target_date := v_local_now::date;

    if v_preferences.quiet_hours_start
      < v_preferences.quiet_hours_end then

      if v_local_time >= v_preferences.quiet_hours_start
        and v_local_time < v_preferences.quiet_hours_end then

        v_scheduled_for := (
          v_target_date + v_preferences.quiet_hours_end
        ) at time zone coalesce(
          v_preferences.timezone,
          'America/Toronto'
        );
      end if;

    elsif v_local_time >= v_preferences.quiet_hours_start then

      v_scheduled_for := (
        (v_target_date + 1) + v_preferences.quiet_hours_end
      ) at time zone coalesce(
        v_preferences.timezone,
        'America/Toronto'
      );

    elsif v_local_time < v_preferences.quiet_hours_end then

      v_scheduled_for := (
        v_target_date + v_preferences.quiet_hours_end
      ) at time zone coalesce(
        v_preferences.timezone,
        'America/Toronto'
      );

    end if;
  end if;

  insert into public.notification_jobs (
    user_id,
    notification_type,
    title,
    body,
    route,
    related_entity_type,
    related_entity_id,
    dedupe_key,
    scheduled_for
  )
  values (
    p_user_id,
    p_notification_type,
    left(p_title, 120),
    left(p_body, 240),
    p_route,
    p_related_entity_type,
    p_related_entity_id,
    p_dedupe_key,
    v_scheduled_for
  )
  on conflict do nothing;
end;
$$;

revoke all
on function public.queue_content_notification(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
)
from public;

-- ---------------------------------------------------------
-- New date-idea alerts
-- ---------------------------------------------------------

create or replace function public.queue_new_date_idea_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  for v_recipient in
    select members.user_id
    from public.couple_members as members
    where members.couple_id = new.couple_id
      and members.user_id <> new.created_by
  loop
    perform public.queue_content_notification(
      v_recipient.user_id,
      'new_idea',
      'New date idea',
      'Your partner added "' ||
        left(coalesce(new.title, 'a new idea'), 120) ||
        '".',
      '/ideas',
      'date_idea',
      new.id,
      'content:new_idea:' ||
        new.id::text ||
        ':' ||
        v_recipient.user_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists date_ideas_queue_partner_notification
on public.date_ideas;

create trigger date_ideas_queue_partner_notification
after insert
on public.date_ideas
for each row
execute function public.queue_new_date_idea_notifications();

-- ---------------------------------------------------------
-- New saved-place alerts
-- ---------------------------------------------------------

create or replace function public.queue_new_place_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient record;
begin
  for v_recipient in
    select members.user_id
    from public.couple_members as members
    where members.couple_id = new.couple_id
      and members.user_id <> new.created_by
  loop
    perform public.queue_content_notification(
      v_recipient.user_id,
      'new_place',
      'New saved place',
      'Your partner saved "' ||
        left(coalesce(new.name, 'a new place'), 120) ||
        '".',
      '/places',
      'place',
      new.id,
      'content:new_place:' ||
        new.id::text ||
        ':' ||
        v_recipient.user_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists places_queue_partner_notification
on public.places;

create trigger places_queue_partner_notification
after insert
on public.places
for each row
execute function public.queue_new_place_notifications();

notify pgrst, 'reload schema';

commit;