-- Default trip planning preferences (vehicle, fuel, lodging, etc.)
alter table public.user_profiles
  add column if not exists plan_preferences jsonb not null default '{}'::jsonb;
