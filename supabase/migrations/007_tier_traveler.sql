-- TripMappa: add Traveler tier (highest plan — grocery delivery and related perks)

alter table public.user_profiles
  drop constraint if exists user_profiles_tier_check;

alter table public.user_profiles
  add constraint user_profiles_tier_check
  check (tier in ('free', 'premium', 'traveler'));
