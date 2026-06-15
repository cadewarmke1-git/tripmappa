-- First-time traveler onboarding profile (dietary, interests, default vehicle)
alter table public.user_profiles
  add column if not exists traveler_profile jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_complete boolean not null default false;

-- Existing accounts skip onboarding; only new signups after this migration see it
update public.user_profiles set onboarding_complete = true where onboarding_complete = false;
