-- =========================================================
-- PHASE 10
-- Shared recipes, owner-only private-wheel editing, and place locations
--
-- This is the only Phase 10 migration. The earlier draft migration 0012 was
-- never run and is intentionally replaced by this file.
-- =========================================================

begin;

-- =========================================================
-- SHARED RECIPES
-- =========================================================

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 140),
  date_tried date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_couple_name_idx
  on public.recipes (couple_id, lower(name));

create index if not exists recipes_couple_date_tried_idx
  on public.recipes (couple_id, date_tried desc nulls last);

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "recipes_select_members" on public.recipes;
create policy "recipes_select_members"
on public.recipes
for select
to authenticated
using (public.is_couple_member(couple_id));

drop policy if exists "recipes_insert_members" on public.recipes;
create policy "recipes_insert_members"
on public.recipes
for insert
to authenticated
with check (
  public.is_couple_member(couple_id)
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "recipes_update_members" on public.recipes;
create policy "recipes_update_members"
on public.recipes
for update
to authenticated
using (public.is_couple_member(couple_id))
with check (
  public.is_couple_member(couple_id)
  and updated_by = (select auth.uid())
);

drop policy if exists "recipes_delete_members" on public.recipes;
create policy "recipes_delete_members"
on public.recipes
for delete
to authenticated
using (public.is_couple_member(couple_id));

revoke all on public.recipes from anon;
revoke update on public.recipes from authenticated;

grant select, insert, delete on public.recipes to authenticated;
grant update (name, date_tried, updated_by)
  on public.recipes
  to authenticated;

-- Add recipes to Realtime once, without failing on a repeated local reset.
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table public.recipes;
  end if;
end;
$$;

-- =========================================================
-- OWNER-ONLY PRIVATE WHEEL EDITING
-- =========================================================

/*
 * Wheel-item rows remain selectable only by their creator. This update policy
 * adds no partner visibility: it merely permits the creator to change the
 * title and description of an active item they already own.
 */
drop policy if exists "wheel_items_update_creator" on public.wheel_items;
create policy "wheel_items_update_creator"
on public.wheel_items
for update
to authenticated
using (
  created_by = (select auth.uid())
  and status = 'active'
  and public.is_couple_member(couple_id)
)
with check (
  created_by = (select auth.uid())
  and status = 'active'
  and public.is_couple_member(couple_id)
);

-- Item type, target, creator, couple, and status remain immutable to the client.
grant update (title, description)
  on public.wheel_items
  to authenticated;

-- =========================================================
-- PLACE LOCATIONS
-- =========================================================

alter table public.places
  add column if not exists location text;

-- Existing rows intentionally remain null. The interface presents those rows
-- as "Unknown location" until either partner adds a city, province, state,
-- country, or another location label that is useful to them.
update public.places
set location = null
where location is not null
  and trim(location) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'places_location_length_check'
      and conrelid = 'public.places'::regclass
  ) then
    alter table public.places
      add constraint places_location_length_check
      check (
        location is null
        or char_length(trim(location)) between 1 and 120
      );
  end if;
end;
$$;

create index if not exists places_couple_location_idx
  on public.places (couple_id, lower(location));

grant update (location)
  on public.places
  to authenticated;

notify pgrst, 'reload schema';

commit;
