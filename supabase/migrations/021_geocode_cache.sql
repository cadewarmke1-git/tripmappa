-- Reverse-geocode cache for corridor city fallback (server-side service role only)
create table if not exists public.geocode_cache (
  cache_key text primary key,
  lat double precision not null,
  lng double precision not null,
  city_state text,
  formatted_address text,
  cached_at timestamptz not null default now()
);

create index if not exists geocode_cache_cached_at_idx on public.geocode_cache (cached_at);

alter table public.geocode_cache enable row level security;
