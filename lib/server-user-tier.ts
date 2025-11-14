import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FREE_PLAN_GENERATIONS,
  PAID_SUBSCRIPTION_STATUSES,
  REVERSE_TRIAL,
  type UserTier,
} from '@/lib/plans';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = REVERSE_TRIAL.durationDays * DAY_IN_MS;
const PAID_STATUS_SET = new Set(PAID_SUBSCRIPTION_STATUSES);

type NullableSupabase = SupabaseClient<any, 'public', any> | null;

function coerceNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function isTrialActiveTimestamp(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false;
  const expiresAt = Date.parse(trialEndsAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function fetchLatestSubscriptionStatus(
  supabaseAdmin: NullableSupabase,
  userId: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('Failed to fetch subscription status:', error);
      return null;
    }
    const latest = Array.isArray(data) && data.length > 0 ? (data[0] as { status?: string | null }) : null;
    return latest?.status ?? null;
  } catch (err) {
    console.error('Subscription lookup failed:', err);
    return null;
  }
}

export interface EnsureCreditsResult {
  credits: number;
  trialEndsAt: string | null;
  tierHint: 'paid' | 'trial' | 'free';
}

export async function ensureFreeCreditsWithTrial(
  supabaseAdmin: NullableSupabase,
  userId: string
): Promise<EnsureCreditsResult> {
  if (!supabaseAdmin) {
    return { credits: FREE_PLAN_GENERATIONS, trialEndsAt: null, tierHint: 'free' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const status = await fetchLatestSubscriptionStatus(supabaseAdmin, userId);

  if (status && PAID_STATUS_SET.has(status)) {
    const { data } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .maybeSingle();
    const credits = coerceNumber((data as { credits?: number } | null)?.credits, FREE_PLAN_GENERATIONS);
    return { credits, trialEndsAt: null, tierHint: 'paid' };
  }

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits, last_refilled_at, trial_started_at, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    const trialStart = nowIso;
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_MS).toISOString();
    await supabaseAdmin.from('user_credits').insert({
      user_id: userId,
      credits: REVERSE_TRIAL.credits,
      last_refilled_at: nowIso,
      trial_started_at: trialStart,
      trial_ends_at: trialEndsAt,
      trial_plan_hint: REVERSE_TRIAL.planKey,
    });
    return { credits: REVERSE_TRIAL.credits, trialEndsAt, tierHint: 'trial' };
  }

  const row = data as {
    credits: number | null;
    last_refilled_at: string | null;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
  };
  const trialEndsAt = row.trial_ends_at ?? null;

  if (isTrialActiveTimestamp(trialEndsAt)) {
    const credits = coerceNumber(row.credits, REVERSE_TRIAL.credits);
    return { credits, trialEndsAt, tierHint: 'trial' };
  }

  const currentCredits = coerceNumber(row.credits, 0);
  const lastRefilledAt = row.last_refilled_at ? new Date(row.last_refilled_at) : null;

  if (trialEndsAt) {
    await supabaseAdmin
      .from('user_credits')
      .update({
        credits: FREE_PLAN_GENERATIONS,
        last_refilled_at: nowIso,
        updated_at: nowIso,
        trial_started_at: null,
        trial_ends_at: null,
      })
      .eq('user_id', userId);
    return { credits: FREE_PLAN_GENERATIONS, trialEndsAt: null, tierHint: 'free' };
  }

  if (!lastRefilledAt) {
    const baseline = currentCredits >= FREE_PLAN_GENERATIONS
      ? currentCredits
      : currentCredits + FREE_PLAN_GENERATIONS;
    await supabaseAdmin
      .from('user_credits')
      .update({
        credits: baseline,
        last_refilled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', userId);
    return { credits: baseline, trialEndsAt: null, tierHint: 'free' };
  }

  if (!isSameUtcMonth(lastRefilledAt, now)) {
    await supabaseAdmin
      .from('user_credits')
      .update({
        credits: FREE_PLAN_GENERATIONS,
        last_refilled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', userId);
    return { credits: FREE_PLAN_GENERATIONS, trialEndsAt: null, tierHint: 'free' };
  }

  return {
    credits: currentCredits,
    trialEndsAt: null,
    tierHint: 'free',
  };
}

export interface TierLookupResult {
  tier: UserTier;
  trialEndsAt: string | null;
}

export async function determineUserTier(
  supabaseAdmin: NullableSupabase,
  userId: string | null
): Promise<TierLookupResult> {
  if (!userId) {
    return { tier: 'non-auth', trialEndsAt: null };
  }
  if (!supabaseAdmin) {
    return { tier: 'free', trialEndsAt: null };
  }

  const status = await fetchLatestSubscriptionStatus(supabaseAdmin, userId);
  if (status && PAID_STATUS_SET.has(status)) {
    return { tier: 'paid', trialEndsAt: null };
  }

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  const trialEndsAt = (data as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null;
  if (isTrialActiveTimestamp(trialEndsAt)) {
    return { tier: 'trial', trialEndsAt };
  }

  return { tier: 'free', trialEndsAt: null };
}
