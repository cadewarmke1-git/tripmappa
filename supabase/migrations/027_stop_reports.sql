-- Lightweight stop quality reports from trip results / itinerary cards.

create table if not exists public.stop_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  trip_id uuid,
  place_id text,
  stop_name text not null,
  category text,
  source_kind text not null,
  lat double precision,
  lng double precision,
  reason text not null,
  details text,
  page_url text,
  created_at timestamptz not null default now(),
  constraint stop_reports_reason_check check (
    reason in (
      'closed',
      'wrong_location',
      'inaccurate_description',
      'inappropriate',
      'other'
    )
  ),
  constraint stop_reports_source_kind_check check (
    source_kind in ('road', 'restaurant', 'lodging', 'fuel', 'activity')
  )
);

create index if not exists stop_reports_created_at_idx
  on public.stop_reports (created_at desc);

create index if not exists stop_reports_user_id_created_at_idx
  on public.stop_reports (user_id, created_at desc);

create index if not exists stop_reports_trip_id_idx
  on public.stop_reports (trip_id)
  where trip_id is not null;

alter table public.stop_reports enable row level security;

drop policy if exists "Users read own stop reports" on public.stop_reports;
create policy "Users read own stop reports"
  on public.stop_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.stop_reports to authenticated;
grant all on table public.stop_reports to service_role;
