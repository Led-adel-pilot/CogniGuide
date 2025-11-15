'use client';

import { Clock3, Sparkles, Zap, GraduationCap, Coins, X } from 'lucide-react';
import { FREE_PLAN_GENERATIONS, REVERSE_TRIAL } from '@/lib/plans';

interface ReverseTrialModalProps {
  open: boolean;
  onClose: () => void;
  trialEndsAt: string | null;
}

function formatTrialEndDate(trialEndsAt: string | null): string {
  if (!trialEndsAt) {
    return '7 days from today';
  }
  const date = new Date(trialEndsAt);
  if (Number.isNaN(date.getTime())) {
    return '7 days from today';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function ReverseTrialModal({ open, onClose, trialEndsAt }: ReverseTrialModalProps) {
  if (!open) return null;

  const trialEndDateCopy = formatTrialEndDate(trialEndsAt);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-background/95 px-4 py-10 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-3xl border border-border/60 bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss reverse trial welcome"
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
          <Sparkles className="h-4 w-4" />
          Student trial unlocked
        </div>
        <h2 className="mt-2 text-2xl font-bold text-foreground">You've unlocked 7 days of full access 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Make this week the one where you actually get ahead on exams.
        </p>
        <div className="mt-5 rounded-2xl bg-muted/60 p-4">
          <p className="text-sm font-medium text-foreground">For the next 7 days you get:</p>
          <ul className="mt-2 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Coins className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">{REVERSE_TRIAL.credits.toLocaleString()} credits</p>
                <p>Much higher generation limit so you can cover full courses, not just a chapter.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Zap className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">AI explanations on your cards</p>
                <p>Get instant help whenever something doesn't click.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">Smart AI model</p>
                <p>Higher-quality mind maps & flashcards on demand.</p>
              </div>
            </li>
          </ul>
          <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Your trial ends on <span className="font-medium text-foreground">{trialEndDateCopy}</span>. After that,
              you'll go back to the Free plan - everything you create stays saved.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-primary px-4 py-2.5 text-base font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          Start creating
        </button>
      </div>
    </div>
  );
}
