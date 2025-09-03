export const PAID_PLANS = {
  student: {
    name: 'Student',
    credits: 300,
    priceIds: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR,
    },
  },
  pro: {
    name: 'Pro',
    credits: 1000,
    priceIds: {
      month: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTH,
      year: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEAR,
    },
  },
};

export const FREE_PLAN_CREDITS = 100;
export const NON_AUTH_FREE_LIMIT = 3;

export type Plan = keyof typeof PAID_PLANS;

export function getPlanByPriceId(priceId: string): Plan | null {
  for (const plan in PAID_PLANS) {
    const typedPlan = plan as Plan;
    const planDetails = PAID_PLANS[typedPlan];
    if (Object.values(planDetails.priceIds).includes(priceId)) {
      return typedPlan;
    }
  }
  return null;
}

export function getCreditsByPriceId(priceId: string): number | null {
  const plan = getPlanByPriceId(priceId);
  if (plan) {
    return PAID_PLANS[plan].credits;
  }
  return null;
}
