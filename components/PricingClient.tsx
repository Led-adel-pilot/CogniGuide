'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import { User } from '@supabase/supabase-js';
import { PAID_PLANS, FREE_PLAN_GENERATIONS, MODEL_CREDIT_MULTIPLIERS } from '@/lib/plans';

type BillingCycle = 'month' | 'year';

type PriceValue = string | null;

type PricesState = {
  student: { month: PriceValue; year: PriceValue };
  pro: { month: PriceValue; year: PriceValue };
};

const INITIAL_PRICES: PricesState = {
  student: { month: null, year: null },
  pro: { month: null, year: null },
};

const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox';
const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || '';

interface PricingClientProps {
  onPurchaseComplete?: () => void;
}

export default function PricingClient({ onPurchaseComplete }: PricingClientProps = {}) {
  const [scriptReady, setScriptReady] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('month');
  const [prices, setPrices] = useState<PricesState>(INITIAL_PRICES);
  const [pricesLoading, setPricesLoading] = useState(false);
  const mountedRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [subscription, setSubscription] = useState<{ status: string | null; plan: string | null } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // This effect runs on mount and checks if Paddle was already loaded by another component.
    if ((window as any).Paddle) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
      // If user just authenticated from the pricing page upgrade flow, redirect once to the dashboard
      try {
        if (session?.user && typeof window !== 'undefined') {
          const hadUpgradeFlag = localStorage.getItem('cogniguide_upgrade_flow');
          if (hadUpgradeFlag) {
            // Signal the dashboard to open the pricing modal on first load
            localStorage.setItem('cogniguide_open_upgrade', 'true');
            localStorage.removeItem('cogniguide_upgrade_flow');
            // Only redirect when currently on a pricing route to avoid refresh loops when
            // this component is rendered inside the dashboard's modal.
            if (window.location.pathname.startsWith('/pricing')) {
              window.location.href = '/dashboard?upgrade=true';
            }
          }
        }
      } catch (redirectError) {
        console.error('Error handling redirect after auth:', redirectError);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    return () => {
      mountedRef.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const isConfigured = useMemo(() => {
    return (
      !!PADDLE_CLIENT_TOKEN &&
      !!PAID_PLANS.student.priceIds.month &&
      !!PAID_PLANS.student.priceIds.year &&
      !!PAID_PLANS.pro.priceIds.month &&
      !!PAID_PLANS.pro.priceIds.year
    );
  }, []);

  // Load current subscription for the authenticated user
  useEffect(() => {
    const loadSubscription = async (uid: string) => {
      try {
        const activeStatuses = ['active', 'trialing', 'past_due'];
        let { data, error } = await supabase
          .from('subscriptions')
          .select('status, plan')
          .eq('user_id', uid)
          .in('status', activeStatuses)
          .limit(1);

        if ((!data || data.length === 0) && !error) {
          const any = await supabase
            .from('subscriptions')
            .select('status, plan')
            .eq('user_id', uid)
            .limit(1);
          data = any.data || [];
        }
        if (data && data.length > 0) {
          setSubscription({ status: data[0].status || null, plan: data[0].plan || null });
        } else {
          setSubscription(null);
        }
      } catch (dbError) {
        console.error('Failed to load subscription:', dbError);
        setSubscription(null);
      }
    };

    if (user?.id) loadSubscription(user.id);
    else setSubscription(null);
  }, [user?.id]);

  const initializePaddle = useCallback(() => {
    try {
      const PaddleObj = (window as any).Paddle;
      if (!PaddleObj) return;
      if (hasInitializedRef.current || (window as any).__cgPaddleInitialized) {
        setPaddleReady(true);
        return;
      }
      if (PADDLE_ENV === 'sandbox') {
        PaddleObj.Environment.set('sandbox');
      }
      PaddleObj.Initialize({
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: function (event: any) {
          if (event?.name === 'checkout.completed' && onPurchaseComplete) {
            // Call the callback function to refresh credits after successful purchase
            setTimeout(() => onPurchaseComplete(), 1000); // Small delay to ensure webhook has processed
          }
        },
      });
      hasInitializedRef.current = true;
      (window as any).__cgPaddleInitialized = true;
      setPaddleReady(true);
    } catch (err) {
      console.error('Paddle init error', err);
    }
  }, [onPurchaseComplete]);

  const updatePrices = useCallback(
    async (cycle: BillingCycle) => {
      try {
        if (!paddleReady || !isConfigured) return;
        const PaddleObj = (window as any).Paddle;
        if (!PaddleObj || typeof PaddleObj.PricePreview !== 'function') return;
        const request = {
          items: [
            { quantity: 1, priceId: PAID_PLANS.student.priceIds[cycle] },
            { quantity: 1, priceId: PAID_PLANS.pro.priceIds[cycle] },
          ],
        } as const;
        const result = await PaddleObj.PricePreview(request);
        if (mountedRef.current && result?.data?.details?.lineItems) {
          setPrices(prev => {
            const next: PricesState = {
              student: { ...prev.student },
              pro: { ...prev.pro },
            };
            result.data.details.lineItems.forEach((item: any) => {
              const priceText = item.formattedTotals?.subtotal ?? null;
              if (!priceText) return;
              if (item.price?.id === PAID_PLANS.student.priceIds[cycle]) {
                next.student[cycle] = priceText;
              } else if (item.price?.id === PAID_PLANS.pro.priceIds[cycle]) {
                next.pro[cycle] = priceText;
              }
            });
            return next;
          });
        }
      } catch (error: any) {
        const friendly = error?.message || (typeof error?.toString === 'function' ? error.toString() : JSON.stringify(error));
        console.error('Error fetching prices:', friendly);
      }
    },
    [paddleReady, isConfigured]
  );

  const updateBothCycles = useCallback(async () => {
    if (!paddleReady || !isConfigured) return;
    if (mountedRef.current) {
      setPricesLoading(true);
    }
    try {
      await Promise.all([updatePrices('month'), updatePrices('year')]);
    } catch (e) {
      console.error('An unexpected error occurred while updating prices:', e);
    } finally {
      if (mountedRef.current) {
        setPricesLoading(false);
      }
    }
  }, [updatePrices, paddleReady, isConfigured]);

  // Derive current plan and cycle from the stored Paddle priceId
  const currentSubscription = useMemo(() => {
    const priceId = subscription?.plan || null;
    let plan: 'student' | 'pro' | null = null;
    let cycle: BillingCycle | null = null;
    if (priceId) {
      if (priceId === PAID_PLANS.student.priceIds.month) { plan = 'student'; cycle = 'month'; }
      else if (priceId === PAID_PLANS.student.priceIds.year) { plan = 'student'; cycle = 'year'; }
      else if (priceId === PAID_PLANS.pro.priceIds.month) { plan = 'pro'; cycle = 'month'; }
      else if (priceId === PAID_PLANS.pro.priceIds.year) { plan = 'pro'; cycle = 'year'; }
    }
    const status = subscription?.status || null;
    const isActive = Boolean(status && ['active', 'trialing', 'past_due'].includes(status));
    return { plan, cycle, status, isActive } as const;
  }, [subscription]);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const isCurrentPlanSelected = useCallback((planKey: 'student' | 'pro') => {
    return (
      currentSubscription.isActive &&
      currentSubscription.plan === planKey &&
      currentSubscription.cycle === billingCycle
    );
  }, [currentSubscription, billingCycle]);

  const getButtonLabel = useCallback((planKey: 'student' | 'pro') => {
    if (!user) return `Choose ${capitalize(planKey)}`;
    if (isCurrentPlanSelected(planKey)) return 'Current plan';
    if (currentSubscription.isActive && currentSubscription.plan === planKey) {
      if (currentSubscription.cycle !== billingCycle) {
        return `Switch to ${billingCycle === 'month' ? 'Monthly' : 'Yearly'}`;
      }
    }
    if (currentSubscription.isActive && currentSubscription.plan && currentSubscription.plan !== planKey) {
      return planKey === 'pro' ? 'Upgrade to Pro' : 'Downgrade to Student';
    }
    return `Choose ${capitalize(planKey)}`;
  }, [billingCycle, currentSubscription, isCurrentPlanSelected, user]);

  const renderPrimaryPrice = (planKey: 'student' | 'pro') => {
    const price = prices[planKey][billingCycle];
    if (!price) {
      return (
        <span
          className="inline-flex h-9 w-28 animate-pulse rounded bg-muted"
          aria-label="Loading price"
        />
      );
    }
    return (
      <>
        <span>{price}</span>
        <span className="text-base font-semibold text-muted-foreground">/ {billingCycle}</span>
      </>
    );
  };

  const renderSecondaryPrice = (planKey: 'student' | 'pro') => {
    const alternateCycle: BillingCycle = billingCycle === 'month' ? 'year' : 'month';
    const price = prices[planKey][alternateCycle];
    if (!price) {
      return <span className="inline-flex h-4 w-24 animate-pulse rounded bg-muted" aria-hidden="true" />;
    }
    return (
      <span>
        {price} / {alternateCycle}
      </span>
    );
  };

  const isButtonDisabled = useCallback(
    (planKey: 'student' | 'pro') => {
      if (!isConfigured || !paddleReady) return true;
      if (pricesLoading) return true;
      if (!prices[planKey][billingCycle]) return true;
      if (isCurrentPlanSelected(planKey)) return true;
      return false;
    },
    [billingCycle, isConfigured, paddleReady, prices, pricesLoading, isCurrentPlanSelected]
  );

  const openCheckout = useCallback(
    (plan: 'student' | 'pro', currentUser: User) => {
      if (!paddleReady || !isConfigured) return;
      try {
        const PaddleObj = (window as any).Paddle;
        PaddleObj.Checkout.open({
          items: [
            {
              priceId: PAID_PLANS[plan].priceIds[billingCycle],
              quantity: 1,
            },
          ],
          customData: {
            user_id: currentUser.id,
            plan_key: plan,
            billing_cycle: billingCycle,
          },
          settings: {
            theme: 'light',
            displayMode: 'overlay',
            variant: 'one-page',
          },
        });
      } catch (error: any) {
        console.error('Checkout error:', error?.message || error);
      }
    },
    [billingCycle, isConfigured, paddleReady]
  );

  const handleChoosePlan = (plan: 'student' | 'pro') => {
    if (!user) {
      localStorage.setItem('cogniguide_upgrade_flow', 'true');
      setAuthModalOpen(true);
    } else {
      openCheckout(plan, user);
    }
  };

  useEffect(() => {
    if (scriptReady && isConfigured) {
      initializePaddle();
    }
  }, [scriptReady, isConfigured, initializePaddle]);

  useEffect(() => {
    if (paddleReady) {
      updateBothCycles();
    }
  }, [paddleReady, updateBothCycles]);

  // Show loading state while determining authentication
  if (isLoadingAuth) {
    return (
      <section className="py-4 pb-16">
        <div className="container">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4 pb-16">
      {/* Load Paddle.js */}
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className="container">
        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center billing-toggle-bg rounded-full p-1">
            <button
              type="button"
              className={`px-4 py-2 text-sm rounded-full billing-toggle-button ${
                billingCycle === 'month' ? 'billing-toggle-active' : ''
              }`}
              onClick={() => setBillingCycle('month')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm rounded-full billing-toggle-button ${
                billingCycle === 'year' ? 'billing-toggle-active' : ''
              }`}
              onClick={() => setBillingCycle('year')}
            >
              Yearly (Save 2 months)
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Pro */}
          <div className="relative rounded-[1.25rem] border bg-background p-6 shadow-sm">
            <h3 className="text-xl font-bold font-heading mb-1">Pro</h3>
            <p className="text-muted-foreground mb-6">For heavy users.</p>
            <div className="mb-6">
              <div
                className="text-3xl font-extrabold flex items-baseline gap-2"
                aria-live="polite"
                aria-busy={pricesLoading || !prices.pro[billingCycle]}
              >
                {renderPrimaryPrice('pro')}
              </div>
              <div className="text-sm text-muted-foreground min-h-[1.25rem]">
                {renderSecondaryPrice('pro')}
              </div>
            </div>
            <button
              onClick={() => handleChoosePlan('pro')}
              disabled={isButtonDisabled('pro')}
              className={`mb-6 w-full rounded-full bg-primary py-2 text-sm font-semibold text-white shadow transition ${
                isButtonDisabled('pro') ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90'
              }`}
            >
              {getButtonLabel('pro')}
            </button>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {PAID_PLANS.pro.credits} monthly credits</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> AI Flashcard Explanations</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Advanced AI Model</li>
            </ul>
          </div>

          {/* Student (Most Popular) */}
          <div className="relative rounded-[1.25rem] border border-primary bg-primary/5 dark:bg-primary/10 p-6 shadow-sm ring-1 ring-primary/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold shadow">Most popular</div>
            <h3 className="text-xl font-bold font-heading mb-1">Student</h3>
            <p className="text-muted-foreground mb-6">Everything you need for real exam prep.</p>
            <div className="mb-6">
              <div
                className="text-3xl font-extrabold flex items-baseline gap-2"
                aria-live="polite"
                aria-busy={pricesLoading || !prices.student[billingCycle]}
              >
                {renderPrimaryPrice('student')}
              </div>
              <div className="text-sm text-muted-foreground min-h-[1.25rem]">
                {renderSecondaryPrice('student')}
              </div>
            </div>
            <button
              onClick={() => handleChoosePlan('student')}
              disabled={isButtonDisabled('student')}
              className={`mb-6 w-full rounded-full bg-primary py-2 text-sm font-semibold text-white shadow transition ${
                isButtonDisabled('student') ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90'
              }`}
            >
              {getButtonLabel('student')}
            </button>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {PAID_PLANS.student.credits} monthly credits</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> AI Flashcard Explanations</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Advanced AI Model</li>
            </ul>
          </div>

          {/* Free */}
          <div className="relative rounded-[1.25rem] border bg-background p-6 shadow-sm">
            <h3 className="text-xl font-bold font-heading mb-1">{user ? 'Free' : 'Free forever'}</h3>
            <p className="text-muted-foreground mb-6">Get started and try the core experience.</p>
            <div className="mb-6">
              <div className="text-3xl font-extrabold">$0</div>
              <div className="text-sm text-muted-foreground">$0 / year</div>
            </div>
            {user ? (
              <button disabled className="mb-6 w-full cursor-not-allowed rounded-full border py-2 text-sm text-gray-600">Current plan</button>
            ) : (
              <button
                onClick={() => {
                  localStorage.setItem('cogniguide_upgrade_flow', 'true');
                  setAuthModalOpen(true);
                }}
                className="mb-6 w-full rounded-full bg-primary py-2 text-sm font-semibold text-white shadow transition hover:bg-primary/90"
              >
                Sign up
              </button>
            )}
            <ul className="space-y-2 text-sm mb-6">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {FREE_PLAN_GENERATIONS} monthly generations</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <X className="h-4 w-4" />
                AI Flashcard Explanations
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <X className="h-4 w-4" />
                Advanced AI Model
              </li>
            </ul>
          </div>
        </div>

        {/* Credits explainer */}
        <div className="mt-12 rounded-[1.25rem] border bg-muted/30 p-6">
          <h2 className="text-lg font-bold font-heading mb-2">How credits work</h2>
          <p className="text-sm text-muted-foreground">
            A credit is a unit used to process your content with AI, longer text extracts from uploaded documents consume more credits. As a rule of thumb: 1 credit ≈ 10 slides, a 2-page PDF, or 2 images, and each generation consumes at least 1 credit.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            With {PAID_PLANS.student.credits} credits per month, you can upload over {PAID_PLANS.student.credits * 2} pages of text! Paid users can also access Smart Mode, which provides higher quality generation for {MODEL_CREDIT_MULTIPLIERS.smart}x the credit cost.
          </p>
        </div>


      </div>
      <AuthModal open={authModalOpen} />
    </section>
  );
}
