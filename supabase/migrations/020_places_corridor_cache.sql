-- Google Places corridor nearby-search cache for /api/places-nearby (server-side service role only)

create table if not exists public.places_corridor_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  lat double precision not null,
  lng double precision not null,
  search_type text,
  keyword text,
  radius_m integer not null default 1609,
  places jsonb not null default '[]'::jsonb,
  cached_at timestamptz not null default now()
);

create index if not exists places_corridor_cache_cached_at_idx
  on public.places_corridor_cache (cached_at desc);

alter table public.places_corridor_cache enable row level security;

grant all on table public.places_corridor_cache to service_role;
