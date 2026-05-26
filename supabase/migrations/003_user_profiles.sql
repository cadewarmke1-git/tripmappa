-- TripMappa: user profiles (home address, tier, AI generation credits)

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_address text,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  generations_used int not null default 0,
  credits_month text not null default to_char(now() at time zone 'utc', 'YYYY-MM'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);

alter table public.user_profiles enable row level security;

drop policy if exists "Users manage own profile" on public.user_profiles;
create policy "Users manage own profile"
  on public.user_profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_user_profiles_updated_at();

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on table public.user_profiles to authenticated;
grant all on table public.user_profiles to service_role;
