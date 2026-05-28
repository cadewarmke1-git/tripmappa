-- Phase 7 enhancements: convoy, breadcrumbs, ETA notifications, arrival, followers

alter table public.live_trips
  add column if not exists convoy_mode boolean not null default false,
  add column if not exists convoy_members jsonb not null default '[]'::jsonb,
  add column if not exists breadcrumbs jsonb not null default '[]'::jsonb,
  add column if not exists eta_notifications_sent jsonb not null default '{}'::jsonb,
  add column if not exists last_notification jsonb,
  add column if not exists follower_phones jsonb not null default '[]'::jsonb,
  add column if not exists arrived_at timestamptz,
  add column if not exists trip_started_at timestamptz,
  add column if not exists total_distance_miles double precision default 0,
  add column if not exists owner_speed_mph int,
  add column if not exists owner_distance_to_dest text;

alter table public.user_profiles
  add column if not exists emergency_contact_phone text;

drop policy if exists "Anyone can read completed live trips" on public.live_trips;
create policy "Anyone can read completed live trips"
  on public.live_trips
  for select
  to anon, authenticated
  using (arrived_at is not null);
