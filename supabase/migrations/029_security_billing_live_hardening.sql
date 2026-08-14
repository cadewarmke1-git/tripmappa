-- Security hardening: lock billing columns, close live_trips overshare, revoke unused token RPCs.
-- Apply after review (service_role continues to write tiers/credits via admin client).

-- 1) Drop policy that lets any client read all completed live trips (incl. follower_phones).
drop policy if exists "Anyone can read completed live trips" on public.live_trips;

-- Keep owner policies only; public reads go through /api/live-trip (service_role) by token.

-- 2) Token RPCs are unused by the app (server API uses admin). Revoke client EXECUTE
-- so SECURITY DEFINER cannot leak follower_phones / user_id to anon/authenticated.
revoke all on function public.get_live_trip_by_share_token(text) from public;
revoke all on function public.get_live_trip_by_share_token(text) from anon, authenticated;
revoke all on function public.get_trip_collaboration_by_invite_token(text) from public;
revoke all on function public.get_trip_collaboration_by_invite_token(text) from anon, authenticated;
grant execute on function public.get_live_trip_by_share_token(text) to service_role;
grant execute on function public.get_trip_collaboration_by_invite_token(text) to service_role;

-- 3) Prevent authenticated clients from writing billing / credit / Stripe fields.
-- service_role (Vercel admin) bypasses; JWT role 'authenticated' is locked down.
create or replace function public.protect_user_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
begin
  if jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.tier := 'wanderer';
    new.generations_used := 0;
    new.credits_month := to_char(timezone('utc', now()), 'YYYY-MM');
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.premium_renewal_at := null;
    new.founder_expires_at := null;
    new.voyager_bonus_until := null;
    new.trailblazer_trial_ends_at := null;
    new.show_trial_ended_prompt := coalesce(new.show_trial_ended_prompt, false);
    -- referral_code may be set by server only; clear client-supplied codes on insert
    new.referral_code := null;
    if new.plan_preferences is null or jsonb_typeof(new.plan_preferences) <> 'object' then
      new.plan_preferences := '{}'::jsonb;
    end if;
    new.plan_preferences :=
      (new.plan_preferences - 'monthly_generation_count' - 'monthly_generation_reset_date' - 'monthly_generation_month')
      || jsonb_build_object(
        'monthly_generation_count', 0,
        'monthly_generation_reset_date',
          to_char((date_trunc('month', timezone('utc', now())) + interval '1 month')::date, 'YYYY-MM-DD')
      );
    return new;
  end if;

  -- UPDATE: force protected scalars from OLD
  new.tier := old.tier;
  new.generations_used := old.generations_used;
  new.credits_month := old.credits_month;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.premium_renewal_at := old.premium_renewal_at;
  new.founder_expires_at := old.founder_expires_at;
  new.voyager_bonus_until := old.voyager_bonus_until;
  new.trailblazer_trial_ends_at := old.trailblazer_trial_ends_at;
  new.referral_code := old.referral_code;
  new.show_trial_ended_prompt := old.show_trial_ended_prompt;

  -- Preserve monthly credit counters inside plan_preferences JSON
  if new.plan_preferences is null or jsonb_typeof(new.plan_preferences) <> 'object' then
    new.plan_preferences := coalesce(old.plan_preferences, '{}'::jsonb);
  else
    new.plan_preferences := new.plan_preferences
      || jsonb_strip_nulls(jsonb_build_object(
        'monthly_generation_count', old.plan_preferences->'monthly_generation_count',
        'monthly_generation_reset_date', old.plan_preferences->'monthly_generation_reset_date',
        'monthly_generation_month', old.plan_preferences->'monthly_generation_month'
      ));
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_profile_billing on public.user_profiles;
create trigger protect_user_profile_billing
  before insert or update on public.user_profiles
  for each row
  execute function public.protect_user_profile_billing_columns();

-- Defense in depth: anon should not have table DML grants (RLS already denies).
revoke all on table public.trips from anon;
revoke all on table public.user_profiles from anon;
