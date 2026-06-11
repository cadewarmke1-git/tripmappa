-- Fix tier default (was 'free' after 010 tier rename — partial upserts hit CHECK 23514)
alter table public.user_profiles
  alter column tier set default 'wanderer';

-- user_trip_preferences: grants were missing from 008; ensure authenticated + service_role access
grant select, insert, update, delete on table public.user_trip_preferences to authenticated;
grant all on table public.user_trip_preferences to service_role;
revoke all on table public.user_trip_preferences from anon;

drop policy if exists "Users read own trip preferences" on public.user_trip_preferences;
drop policy if exists "Users upsert own trip preferences" on public.user_trip_preferences;
drop policy if exists "Users update own trip preferences" on public.user_trip_preferences;

create policy "Users read own trip preferences"
  on public.user_trip_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own trip preferences"
  on public.user_trip_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own trip preferences"
  on public.user_trip_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
