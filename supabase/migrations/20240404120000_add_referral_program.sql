-- Create tables for referral program
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamp with time zone not null default now()
);

create table public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referral_code text not null references public.referral_codes (code) on delete cascade,
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  reward_credits numeric(12, 6) not null default 30,
  created_at timestamp with time zone not null default now(),
  constraint referral_redemptions_referred_user_id_key unique (referred_user_id),
  constraint referral_redemptions_reward_positive check (reward_credits > 0)
);

create index referral_redemptions_referrer_created_idx
  on public.referral_redemptions (referrer_id, created_at);

-- Function to increment user credits atomically without mutating last_refilled_at
create or replace function public.increment_user_credits(
  p_user_id uuid,
  p_amount numeric
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_credits numeric(12, 6);
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  loop
    update public.user_credits
    set credits = credits + p_amount,
        updated_at = now()
    where user_id = p_user_id
    returning credits into v_new_credits;

    if found then
      return v_new_credits;
    end if;

    begin
      insert into public.user_credits (user_id, credits, updated_at)
      values (p_user_id, p_amount, now())
      returning credits into v_new_credits;
      return v_new_credits;
    exception
      when unique_violation then
        -- Retry the update if another transaction inserted first
        null;
    end;
  end loop;
end;
$$;
