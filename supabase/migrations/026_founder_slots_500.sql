-- Founder program cap: 1,000 → 500 public spots.
-- Existing founder-owned rows (slots 1–4) remain; check must still allow them.

alter table public.founding_members
  drop constraint if exists founding_members_slot_number_check;

alter table public.founding_members
  add constraint founding_members_slot_number_check
  check (slot_number >= 1 and slot_number <= 500);
