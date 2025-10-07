'use client';

import * as React from 'react';
import { Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ShareTriggerButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  srLabel?: string;
  showText?: boolean;
};

export default function ShareTriggerButton({ srLabel = 'Share', className, type, showText = false, ...props }: ShareTriggerButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={props['aria-label'] ?? srLabel}
      {...props}
      className={cn(
        showText
          ? 'inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 disabled:pointer-events-none disabled:opacity-50'
          : 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <Share2 className="h-4 w-4" />
      {showText && <span className="text-sm font-medium">Share</span>}
    </button>
  );
}
