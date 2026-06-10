-- Security hardening: revoke anon table scans, add token RPCs, Stripe webhook idempotency

-- Prevent anon users from listing all active live trips or collaborations
revoke select on table public.live_trips from anon;
revoke select on table public.trip_collaborations from anon;

drop policy if exists "Anyone can read active live trips" on public.live_trips;
drop policy if exists "Anyone reads active collaboration by token" on public.trip_collaborations;

create or replace function public.get_live_trip_by_share_token(p_share_token text)
returns setof public.live_trips
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.live_trips
  where share_token = p_share_token
    and (is_active = true or arrived_at is not null)
  limit 1;
$$;

revoke all on function public.get_live_trip_by_share_token(text) from public;
grant execute on function public.get_live_trip_by_share_token(text) to anon, authenticated;

create or replace function public.get_trip_collaboration_by_invite_token(p_invite_token text)
returns setof public.trip_collaborations
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.trip_collaborations
  where invite_token = p_invite_token
    and status = 'active'
  limit 1;
$$;

revoke all on function public.get_trip_collaboration_by_invite_token(text) from public;
grant execute on function public.get_trip_collaboration_by_invite_token(text) to anon, authenticated;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;
