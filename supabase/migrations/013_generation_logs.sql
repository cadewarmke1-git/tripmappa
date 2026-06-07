-- Lightweight Anthropic generation usage logs for token tier validation

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  route_distance_miles numeric,
  trip_category text,
  overnight_count int,
  is_simplified boolean not null default false,
  max_tokens_tier text,
  created_at timestamptz not null default now()
);

create index if not exists generation_logs_user_id_created_at_idx
  on public.generation_logs (user_id, created_at desc);

alter table public.generation_logs enable row level security;

drop policy if exists "Users read own generation logs" on public.generation_logs;
create policy "Users read own generation logs"
  on public.generation_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.generation_logs to authenticated;
grant all on table public.generation_logs to service_role;
