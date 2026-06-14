-- OSM rest stop cache for /api/rest-stops (server-side service role only)

create table if not exists public.rest_stop_cache (
  id uuid primary key default gen_random_uuid(),
  bbox_key text not null unique,
  north double precision not null,
  south double precision not null,
  east double precision not null,
  west double precision not null,
  vehicle_type text,
  stops jsonb not null default '[]'::jsonb,
  cached_at timestamptz not null default now()
);

create index if not exists rest_stop_cache_cached_at_idx
  on public.rest_stop_cache (cached_at desc);

alter table public.rest_stop_cache enable row level security;

grant all on table public.rest_stop_cache to service_role;
