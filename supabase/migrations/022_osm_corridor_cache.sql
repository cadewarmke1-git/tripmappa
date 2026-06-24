-- OSM corridor POI cache for /api/corridor-osm (fuel, restaurants, lodging, truck stops)

create table if not exists public.osm_corridor_cache (
  id uuid primary key default gen_random_uuid(),
  bbox_key text not null unique,
  north double precision not null,
  south double precision not null,
  east double precision not null,
  west double precision not null,
  places jsonb not null default '[]'::jsonb,
  cached_at timestamptz not null default now()
);

create index if not exists osm_corridor_cache_cached_at_idx
  on public.osm_corridor_cache (cached_at desc);

alter table public.osm_corridor_cache enable row level security;

grant all on table public.osm_corridor_cache to service_role;
