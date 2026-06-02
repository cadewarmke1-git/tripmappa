-- Tier rename (wanderer / voyager / trailblazer) + Founder program
-- Drop tier check BEFORE renaming values (old constraint only allows free/premium/traveler).

alter table public.user_profiles
  add column if not exists founder_expires_at timestamptz;

alter table public.user_profiles drop constraint if exists user_profiles_tier_check;

update public.user_profiles set tier = 'wanderer' where tier = 'free';
update public.user_profiles set tier = 'trailblazer' where tier = 'premium';
update public.user_profiles set tier = 'voyager' where tier = 'traveler';

alter table public.user_profiles
  add constraint user_profiles_tier_check
  check (tier in ('wanderer', 'voyager', 'trailblazer', 'founder'));

create table if not exists public.founding_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  slot_number int not null check (slot_number >= 1 and slot_number <= 1000),
  claimed_at timestamptz not null default now()
);

create unique index if not exists founding_members_slot_number_idx
  on public.founding_members (slot_number);

alter table public.founding_members enable row level security;

drop policy if exists "Users read own founding row" on public.founding_members;
create policy "Users read own founding row"
  on public.founding_members
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.founding_members to authenticated;
grant all on table public.founding_members to service_role;
