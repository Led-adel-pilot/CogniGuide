'use client';

import { Clock3, Sparkles, Zap, GraduationCap, Coins, X } from 'lucide-react';
import { REVERSE_TRIAL } from '@/lib/plans';

interface ReverseTrialModalProps {
  open: boolean;
  onClose: () => void;
  trialEndsAt: string | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function formatTimeRemaining(trialEndsAt: string | null): string {
  if (!trialEndsAt) {
    return `${REVERSE_TRIAL.durationDays} days remaining`;
  }
  const endsAt = Date.parse(trialEndsAt);
  if (!Number.isFinite(endsAt)) {
    return `${REVERSE_TRIAL.durationDays} days remaining`;
  }
  const diffMs = endsAt - Date.now();
  if (diffMs <= 0) {
    return 'Trial ending soon';
  }
  const wholeDays = Math.floor(diffMs / DAY_IN_MS);
  if (wholeDays >= 1) {
    return `${wholeDays} day${wholeDays === 1 ? '' : 's'} remaining`;
  }
  const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
  return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
}

export default function ReverseTrialModal({ open, onClose, trialEndsAt }: ReverseTrialModalProps) {
  if (!open) return null;

  const timeRemaining = formatTimeRemaining(trialEndsAt);

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
          Reverse trial unlocked
        </div>
        <h2 className="mt-2 text-2xl font-bold text-foreground">
          Enjoy {REVERSE_TRIAL.credits.toLocaleString()} credits on the Student plan for 7 days
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You can use Smart Mode and AI flashcard explanations just like a paid subscriber. Explore uploads,
          shareable mind maps, and flashcard sessions without limits while the trial lasts.
        </p>
        <div className="mt-5 rounded-2xl bg-muted/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            <span>{timeRemaining}</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Coins className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">{REVERSE_TRIAL.credits.toLocaleString()} credits</p>
                <p>Upload PDFs, decks, prompts, and more without worrying about limits.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Zap className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">Smart Mode access</p>
                <p>Run the high-accuracy Gemini model for richer mind maps and flashcards.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">AI flashcard explanations</p>
                <p>Tap “Explain” on any card to get instant reasoning and study tips.</p>
              </div>
            </li>
          </ul>
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
