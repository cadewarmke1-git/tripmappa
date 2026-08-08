-- Permanent OSM node → Google place_id map (place_id may be stored indefinitely per Google ToS).
-- No TTL — once resolved, the same OSM node never pays Nearby again for re-resolve.

create table if not exists public.osm_place_id_map (
  osm_id text primary key,
  place_id text not null,
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists osm_place_id_map_place_id_idx
  on public.osm_place_id_map (place_id);

alter table public.osm_place_id_map enable row level security;

grant all on table public.osm_place_id_map to service_role;
