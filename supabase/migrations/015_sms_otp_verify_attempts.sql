alter table public.sms_otp_codes
  add column if not exists failed_attempts int not null default 0;
