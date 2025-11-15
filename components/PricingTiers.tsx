'use client';

import React from 'react';
import { Check } from 'lucide-react';

type BillingCycle = 'month' | 'year';

type PricesState = {
  student: { month: string; year: string };
  pro: { month: string; year: string };
};

interface PricingTiersProps {
  billingCycle: BillingCycle;
  prices: PricesState;
  isConfigured: boolean;
  paddleReady: boolean;
  onCheckout: (plan: 'student' | 'pro') => void;
}

export default function PricingTiers({
  billingCycle,
  prices,
  isConfigured,
  paddleReady,
  onCheckout,
}: PricingTiersProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Free */}
      <div className="relative rounded-[1.25rem] border bg-background p-6 shadow-sm">
        <h3 className="text-xl font-bold font-heading mb-1">Free</h3>
        <p className="text-muted-foreground mb-6">Get started and try the core experience.</p>
        <div className="mb-6">
          <div className="text-3xl font-extrabold">$0</div>
          <div className="text-sm text-muted-foreground">$0 / year</div>
        </div>
        <ul className="space-y-2 text-sm mb-6">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 8 monthly credits</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
        </ul>
        <button disabled className="w-full cursor-not-allowed rounded-full border py-2 text-sm text-gray-600">Current plan</button>
      </div>

      {/* Student (Most Popular) */}
      <div className="relative rounded-[1.25rem] border bg-background p-6 shadow-sm ring-1 ring-primary/10">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border bg-primary text-white px-3 py-1 text-xs font-semibold shadow">Recommended</div>
        <h3 className="text-xl font-bold font-heading mb-1">Student</h3>
        <p className="text-muted-foreground mb-6">Plenty of credits for regular study and exam prep.</p>
        <div className="mb-6">
          <div className="text-3xl font-extrabold">
            {billingCycle === 'month' ? prices.student.month : prices.student.year}{' '}
            <span className="text-base font-semibold text-muted-foreground">/ {billingCycle}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {billingCycle === 'month' ? prices.student.year : prices.student.month} / {billingCycle === 'month' ? 'year' : 'month'}
          </div>
        </div>
        <ul className="space-y-2 text-sm mb-6">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 300 monthly credits</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
        </ul>
        <button
          onClick={() => onCheckout('student')}
          disabled={!isConfigured || !paddleReady}
          className={`w-full rounded-full bg-primary py-2 text-sm font-semibold text-white shadow transition ${
            !isConfigured || !paddleReady ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90'
          }`}
        >
          Choose Student
        </button>
      </div>

      {/* Pro */}
      <div className="relative rounded-[1.25rem] border bg-background p-6 shadow-sm">
        <h3 className="text-xl font-bold font-heading mb-1">Pro</h3>
        <p className="text-muted-foreground mb-6">For power users with high-volume needs.</p>
        <div className="mb-6">
          <div className="text-3xl font-extrabold">
            {billingCycle === 'month' ? prices.pro.month : prices.pro.year}{' '}
            <span className="text-base font-semibold text-muted-foreground">/ {billingCycle}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {billingCycle === 'month' ? prices.pro.year : prices.pro.month} / {billingCycle === 'month' ? 'year' : 'month'}
          </div>
        </div>
        <ul className="space-y-2 text-sm mb-6">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 1,000 monthly credits</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mind maps + flashcards</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Spaced repetition</li>
        </ul>
        <button
          onClick={() => onCheckout('pro')}
          disabled={!isConfigured || !paddleReady}
          className={`w-full rounded-full bg-primary py-2 text-sm font-semibold text-white shadow transition ${
            !isConfigured || !paddleReady ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/90'
          }`}
        >
          Choose Pro
        </button>
      </div>
    </div>
  );
}
