-- Google Place Details cache keyed by place_id (7-day TTL, server-side service role only)

create table if not exists public.place_details_cache (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  details jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now()
);

create index if not exists place_details_cache_cached_at_idx
  on public.place_details_cache (cached_at desc);

alter table public.place_details_cache enable row level security;

grant all on table public.place_details_cache to service_role;
