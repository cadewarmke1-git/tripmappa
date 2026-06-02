-- Referrals, Trailblazer trial, Voyager referral bonuses

alter table public.user_profiles
  add column if not exists referral_code text,
  add column if not exists voyager_bonus_until timestamptz,
  add column if not exists trailblazer_trial_ends_at timestamptz,
  add column if not exists trial_reminder_sent_at timestamptz,
  add column if not exists show_trial_ended_prompt boolean not null default false;

create unique index if not exists user_profiles_referral_code_idx
  on public.user_profiles (referral_code)
  where referral_code is not null;

create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users (id) on delete cascade,
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_user_id_idx
  on public.referrals (referrer_user_id);

alter table public.referrals enable row level security;

drop policy if exists "Users read own referrals" on public.referrals;
create policy "Users read own referrals"
  on public.referrals
  for select
  to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

grant select on table public.referrals to authenticated;
grant all on table public.referrals to service_role;
