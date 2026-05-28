-- TripMappa Phase 7: live location sharing

create table if not exists public.live_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  share_token text not null unique,
  latitude double precision,
  longitude double precision,
  last_updated timestamptz,
  origin text not null,
  destination text not null,
  eta text,
  eta_destination text,
  eta_next_stop text,
  next_stop_name text,
  is_active boolean not null default true,
  stops jsonb not null default '[]'::jsonb,
  route_info jsonb,
  traveler_display_name text,
  traveler_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_trips_user_id_idx on public.live_trips (user_id);
create index if not exists live_trips_share_token_idx on public.live_trips (share_token);
create index if not exists live_trips_active_idx on public.live_trips (is_active) where is_active = true;

alter table public.live_trips enable row level security;

drop policy if exists "Owner manages own live trips" on public.live_trips;
create policy "Owner manages own live trips"
  on public.live_trips
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Anyone can read active live trips" on public.live_trips;
create policy "Anyone can read active live trips"
  on public.live_trips
  for select
  to anon, authenticated
  using (is_active = true);

create or replace function public.set_live_trips_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists live_trips_updated_at on public.live_trips;
create trigger live_trips_updated_at
  before update on public.live_trips
  for each row execute function public.set_live_trips_updated_at();

grant select on table public.live_trips to anon, authenticated;
grant insert, update, delete on table public.live_trips to authenticated;
grant all on table public.live_trips to service_role;

alter publication supabase_realtime add table public.live_trips;
