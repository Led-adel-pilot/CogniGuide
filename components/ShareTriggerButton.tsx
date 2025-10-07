'use client';

import * as React from 'react';
import { Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ShareTriggerButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  srLabel?: string;
};

export default function ShareTriggerButton({ srLabel = 'Share', className, type, ...props }: ShareTriggerButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={props['aria-label'] ?? srLabel}
      {...props}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}
