'use client';

import { CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { FREE_PLAN_GENERATIONS } from '@/lib/plans';

interface ReverseTrialEndModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  stats: {
    mindmaps: number;
    flashcards: number;
    explanations: number;
  };
}

export default function ReverseTrialEndModal({ open, onClose, onUpgrade, stats }: ReverseTrialEndModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-background/95 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl flex flex-col max-h-[95vh]">
        <div className="p-5 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
            <Sparkles className="h-4 w-4" />
            Your Student trial ends today
          </div>

          <div className="mt-3 w-full rounded-xl border border-border/60 bg-muted/30 p-3 text-left">
            <h2 className="text-xl font-bold text-foreground">In 7 days you’ve:</h2>
            <p className="mt-1 text-sm text-foreground leading-relaxed">
              Created <span className="font-semibold text-primary">{stats.mindmaps}</span> mind maps, generated <span className="font-semibold text-primary">{stats.flashcards}</span> flashcards, and got <span className="font-semibold text-primary">{stats.explanations}</span> AI explanations.
            </p>
          </div>
        </div>

        <div className="px-5 py-2 overflow-y-auto min-h-0 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            {/* Free Plan Column */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 flex flex-col h-full justify-start">
              <div className="text-sm font-bold text-foreground mb-3">If you continue on Free (default):</div>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Keep existing maps & cards</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Manual editing</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">New generations limited to {FREE_PLAN_GENERATIONS}/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Smart Mode disabled (basic AI only)</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">“Explain in simpler terms” disabled</span>
                </li>
              </ul>
            </div>

            {/* Upgrade Column */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col h-full justify-start relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 blur-2xl rounded-full -mr-8 -mt-8"></div>
              <div className="text-sm font-bold text-primary mb-3 relative z-10">If you upgrade today:</div>
              <ul className="space-y-2.5 text-xs sm:text-sm relative z-10">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">Nearly Unlimited generations across all subjects</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">AI Flashcard Explanations on every card</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span className="font-medium text-foreground">Higher-quality generations with Smart Mode</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 pt-1 shrink-0 bg-gradient-to-t from-card to-transparent">
          <div className="mx-auto flex w-fit max-w-full items-start gap-4">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1 px-2 mt-1"
            >
              Continue with Free plan
            </button>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <button
                type="button"
                onClick={onUpgrade}
                className="flex rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-[1.01] active:scale-[0.99] max-w-[260px] justify-center whitespace-nowrap"
              >
                Upgrade & Keep Momentum
              </button>
              <span className="text-[11px] leading-tight text-muted-foreground tracking-wide font-medium">Cancel anytime • No hidden fees</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
