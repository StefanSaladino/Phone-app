-- =========================================================
-- REALTIME SURPRISE NOTE DELIVERY
-- =========================================================
-- Enables INSERT events from public.notes for authenticated Realtime clients.
-- Existing Row Level Security continues to determine which users may receive
-- each row through Supabase Realtime.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end;
$$;

commit;
