-- Read-only itinerary snapshots for portable ?share= links (any device, no auth to view).

create table if not exists public.shared_itineraries (
  share_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  origin text not null,
  destination text not null,
  stop_count int not null default 0,
  day_count int not null default 1,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create index if not exists shared_itineraries_expires_at_idx
  on public.shared_itineraries (expires_at);

alter table public.shared_itineraries enable row level security;

revoke all on table public.shared_itineraries from anon, authenticated;
grant all on table public.shared_itineraries to service_role;
