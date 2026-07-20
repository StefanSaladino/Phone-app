-- =========================================================
-- PRIVATE COUPLES APP: INITIAL DATABASE SCHEMA
-- =========================================================
-- Run this in the Supabase SQL Editor once for a new project.
-- The schema supports exactly two members per couple and uses
-- Row Level Security to isolate every couple's shared content.

create extension if not exists pgcrypto;

-- =========================================================
-- CORE TABLES
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Partner',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Us',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'partner' check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

create table public.date_ideas (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  status text not null default 'idea' check (status in ('idea', 'planned', 'done')),
  planned_for timestamptz,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 140),
  category text not null check (
    category in ('food', 'coffee', 'drinks', 'dessert', 'recreation')
  ),
  address text,
  website_url text,
  maps_url text,
  notes text,
  visited boolean not null default false,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  delivery_mode text not null default 'inbox' check (
    delivery_mode in ('inbox', 'next_login')
  ),
  seen_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  check (author_id <> recipient_id)
);

create index date_ideas_couple_created_idx
  on public.date_ideas (couple_id, created_at desc);

create index places_couple_category_idx
  on public.places (couple_id, category, created_at desc);

create index notes_recipient_unseen_idx
  on public.notes (recipient_id, created_at desc)
  where seen_at is null;

-- =========================================================
-- AUTOMATIC PROFILE AND TIMESTAMP HELPERS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger couples_set_updated_at
before update on public.couples
for each row execute function public.set_updated_at();

create trigger date_ideas_set_updated_at
before update on public.date_ideas
for each row execute function public.set_updated_at();

create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Partner'
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep each account in one couple and each couple at two members maximum.
create or replace function public.enforce_two_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.couple_members
    where couple_id = new.couple_id
  ) >= 2 then
    raise exception 'A couple can contain no more than two members.';
  end if;

  return new;
end;
$$;

create trigger couple_members_limit
before insert on public.couple_members
for each row execute function public.enforce_two_member_limit();

-- =========================================================
-- SECURITY-DEFINER AUTHORIZATION HELPERS
-- =========================================================
-- These avoid recursive RLS checks against couple_members.

create or replace function public.is_couple_member(check_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = check_couple_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_couple_creator(check_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couples
    where id = check_couple_id
      and created_by = (select auth.uid())
  );
$$;

create or replace function public.is_user_in_couple(
  check_couple_id uuid,
  check_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members
    where couple_id = check_couple_id
      and user_id = check_user_id
  );
$$;

create or replace function public.shares_couple_with(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members as me
    join public.couple_members as partner
      on partner.couple_id = me.couple_id
    where me.user_id = (select auth.uid())
      and partner.user_id = check_user_id
  );
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.date_ideas enable row level security;
alter table public.places enable row level security;
alter table public.notes enable row level security;

-- Profiles: each user can see themself and the person sharing their couple.
create policy "profiles_select_shared_couple"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    id = (select auth.uid())
    or public.shares_couple_with(id)
  )
);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Couples: both linked members may read and rename their couple.
create policy "couples_select_members"
on public.couples
for select
to authenticated
using (public.is_couple_member(id));

create policy "couples_insert_creator"
on public.couples
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "couples_update_members"
on public.couples
for update
to authenticated
using (public.is_couple_member(id))
with check (public.is_couple_member(id));

-- Memberships: members may see their own two-person membership list.
create policy "couple_members_select_members"
on public.couple_members
for select
to authenticated
using (public.is_couple_member(couple_id));

create policy "couple_members_insert_creator"
on public.couple_members
for insert
to authenticated
with check (public.is_couple_creator(couple_id));

-- Date ideas: both members have full access to their shared list.
create policy "date_ideas_select_members"
on public.date_ideas
for select
to authenticated
using (public.is_couple_member(couple_id));

create policy "date_ideas_insert_members"
on public.date_ideas
for insert
to authenticated
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
);

create policy "date_ideas_update_members"
on public.date_ideas
for update
to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "date_ideas_delete_members"
on public.date_ideas
for delete
to authenticated
using (public.is_couple_member(couple_id));

-- Places: both members have full access to their shared place list.
create policy "places_select_members"
on public.places
for select
to authenticated
using (public.is_couple_member(couple_id));

create policy "places_insert_members"
on public.places
for insert
to authenticated
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
);

create policy "places_update_members"
on public.places
for update
to authenticated
using (public.is_couple_member(couple_id))
with check (public.is_couple_member(couple_id));

create policy "places_delete_members"
on public.places
for delete
to authenticated
using (public.is_couple_member(couple_id));

-- Notes: sender and recipient can read and delete their own participating notes.
-- Seen/dismissed changes are intentionally deferred to restricted database
-- functions in the notes phase so recipients can never edit message content.
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

create policy "notes_insert_sender"
on public.notes
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and recipient_id <> (select auth.uid())
  and public.is_couple_member(couple_id)
  and public.is_user_in_couple(couple_id, recipient_id)
);

create policy "notes_delete_participants"
on public.notes
for delete
to authenticated
using (
  public.is_couple_member(couple_id)
  and (
    author_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  )
);

-- =========================================================
-- DATA API PRIVILEGES
-- =========================================================

revoke all on public.profiles from anon;
revoke all on public.couples from anon;
revoke all on public.couple_members from anon;
revoke all on public.date_ideas from anon;
revoke all on public.places from anon;
revoke all on public.notes from anon;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select, insert on public.couples to authenticated;
grant update (name) on public.couples to authenticated;

grant select, insert on public.couple_members to authenticated;

grant select, insert, delete on public.date_ideas to authenticated;
grant update (title, description, status, planned_for, is_favorite)
  on public.date_ideas to authenticated;

grant select, insert, delete on public.places to authenticated;
grant update (
  name,
  category,
  address,
  website_url,
  maps_url,
  notes,
  visited,
  is_favorite
) on public.places to authenticated;

grant select, insert, delete on public.notes to authenticated;


-- Limit direct execution of helper functions to the authenticated application role.
revoke all on function public.is_couple_member(uuid) from public;
revoke all on function public.is_couple_creator(uuid) from public;
revoke all on function public.is_user_in_couple(uuid, uuid) from public;
revoke all on function public.shares_couple_with(uuid) from public;

grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.is_couple_creator(uuid) to authenticated;
grant execute on function public.is_user_in_couple(uuid, uuid) to authenticated;
grant execute on function public.shares_couple_with(uuid) to authenticated;
