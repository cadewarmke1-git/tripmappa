-- TripMappa Phase 6: saved trips (run in Supabase SQL Editor)

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null,
  dest text not null,
  trip_date text,
  stops jsonb not null default '[]'::jsonb,
  road_stops jsonb not null default '[]'::jsonb,
  trip_tips jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  route_info jsonb,
  selected_lodging jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_created_at_idx
  on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;

drop policy if exists "Users manage own trips" on public.trips;
create policy "Users manage own trips"
  on public.trips
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_trips_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_trips_updated_at();

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.trips to anon, authenticated, service_role;
