alter table public.user_credits
  add column if not exists trial_started_at timestamp with time zone null,
  add column if not exists trial_ends_at timestamp with time zone null,
  add column if not exists trial_plan_hint text null;

