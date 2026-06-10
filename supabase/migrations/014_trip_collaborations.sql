-- Trip collaboration: group voting, suggestions, and preferences for shared trips

create table if not exists public.trip_collaborations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  invite_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  trip_snapshot jsonb not null default '{}'::jsonb,
  invitees jsonb not null default '[]'::jsonb,
  votes jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_collaborations_organizer_idx
  on public.trip_collaborations (organizer_id, created_at desc);

create index if not exists trip_collaborations_token_idx
  on public.trip_collaborations (invite_token);

alter table public.trip_collaborations enable row level security;

drop policy if exists "Organizers manage own collaborations" on public.trip_collaborations;
create policy "Organizers manage own collaborations"
  on public.trip_collaborations
  for all
  to authenticated
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

drop policy if exists "Anyone reads active collaboration by token" on public.trip_collaborations;
create policy "Anyone reads active collaboration by token"
  on public.trip_collaborations
  for select
  to anon, authenticated
  using (status = 'active');

create or replace function public.set_trip_collaborations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trip_collaborations_updated_at on public.trip_collaborations;
create trigger trip_collaborations_updated_at
  before update on public.trip_collaborations
  for each row execute function public.set_trip_collaborations_updated_at();

alter publication supabase_realtime add table public.trip_collaborations;

grant select, insert, update, delete on table public.trip_collaborations to anon, authenticated, service_role;
