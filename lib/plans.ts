export const PAID_PLANS = {
  student: {
    name: 'Student',
    credits: 5000,
    priceIds: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR,
    },
  },
  pro: {
    name: 'Pro',
    credits: 7500,
    priceIds: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTH,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEAR,
    },
  },
};

export const FREE_PLAN_GENERATIONS = 8;
export const NON_AUTH_FREE_LIMIT = 3;

export type Plan = keyof typeof PAID_PLANS;
export type UserTier = 'non-auth' | 'free' | 'trial' | 'paid';

export const MODEL_CREDIT_MULTIPLIERS = {
  fast: 1,
  smart: 5.2,
} as const;

export const MODEL_REQUIRED_TIER = {
  fast: 'free',
  smart: 'paid',
} as const;

export const FEATURE_REQUIRED_TIER = {
  explain: 'paid',
} as const;

export type ModelChoice = keyof typeof MODEL_CREDIT_MULTIPLIERS;

export const REVERSE_TRIAL = {
  name: 'Reverse Trial',
  planKey: 'student',
  credits: 1000,
  durationDays: 7,
} as const;

export const PAID_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

export function isPaidTier(tier: UserTier | 'free' | 'paid'): boolean {
  return tier === 'paid' || tier === 'trial';
}

export function getPlanByPriceId(priceId: string): Plan | null {
  if (!priceId) return null;
  for (const plan in PAID_PLANS) {
    const typedPlan = plan as Plan;
    const planDetails = PAID_PLANS[typedPlan];
    if (Object.values(planDetails.priceIds).includes(priceId)) {
      return typedPlan;
    }
  }
  return null;
}

function isPlanKey(value: string): value is Plan {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(PAID_PLANS, value);
}

export function getCreditsByPriceId(identifier: string): number | null {
  if (!identifier) return null;
  const plan = getPlanByPriceId(identifier);
  if (plan) {
    return PAID_PLANS[plan].credits;
  }
  if (isPlanKey(identifier)) {
    return PAID_PLANS[identifier].credits;
  }
  return null;
}

