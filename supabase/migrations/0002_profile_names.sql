-- =========================================================
-- PROFILE FIRST AND LAST NAMES
-- =========================================================
-- Adds structured names to profiles, updates the two existing accounts,
-- and keeps display_name synchronized for places where a full name is useful.

alter table public.profiles
  add column first_name text,
  add column last_name text;

-- Populate the two existing private accounts.
update public.profiles as profile
set
  first_name = 'Stefan',
  last_name = 'Saladino',
  display_name = 'Stefan Saladino'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = 'stefan.saladino@gmail.com';

update public.profiles as profile
set
  first_name = 'Ashna',
  last_name = 'Samani',
  display_name = 'Ashna Samani'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = 'ashnasamani@gmail.com';

-- Safe fallback for any profile not covered by the two updates above.
update public.profiles
set
  first_name = coalesce(
    nullif(trim(first_name), ''),
    nullif(split_part(trim(display_name), ' ', 1), ''),
    'Partner'
  ),
  last_name = coalesce(nullif(trim(last_name), ''), '');

alter table public.profiles
  alter column first_name set default 'Partner',
  alter column first_name set not null,
  alter column last_name set default '',
  alter column last_name set not null;

alter table public.profiles
  add constraint profiles_first_name_length_check
    check (char_length(first_name) between 1 and 80),
  add constraint profiles_last_name_length_check
    check (char_length(last_name) <= 80);

-- Keep the compatibility display_name column aligned with structured names.
create or replace function public.sync_profile_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name = trim(new.first_name);
  new.last_name = trim(new.last_name);
  new.display_name = coalesce(
    nullif(trim(concat_ws(' ', new.first_name, nullif(new.last_name, ''))), ''),
    'Partner'
  );

  return new;
end;
$$;

create trigger profiles_sync_display_name
before insert or update of first_name, last_name on public.profiles
for each row execute function public.sync_profile_display_name();

-- Future manually-created users can also provide structured name metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata_first_name text;
  metadata_last_name text;
  metadata_display_name text;
begin
  metadata_first_name = nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  metadata_last_name = coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    ''
  );
  metadata_display_name = nullif(
    trim(new.raw_user_meta_data ->> 'display_name'),
    ''
  );

  insert into public.profiles (
    id,
    first_name,
    last_name,
    display_name
  )
  values (
    new.id,
    coalesce(
      metadata_first_name,
      nullif(split_part(coalesce(metadata_display_name, ''), ' ', 1), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Partner'
    ),
    metadata_last_name,
    coalesce(
      metadata_display_name,
      nullif(trim(concat_ws(' ', metadata_first_name, metadata_last_name)), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Partner'
    )
  );

  return new;
end;
$$;

-- Authenticated users may only edit the name fields on their own profile,
-- as still enforced by the existing profiles_update_self RLS policy.
grant update (first_name, last_name) on public.profiles to authenticated;
