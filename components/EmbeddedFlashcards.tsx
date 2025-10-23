'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Flashcard } from '@/components/FlashcardsModal';

const FlashcardsModal = dynamic(() => import('@/components/FlashcardsModal'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-28 w-full max-w-3xl animate-pulse rounded-3xl bg-muted/40" aria-hidden="true" />
    </div>
  ),
});

const fallbackFlashcards: Flashcard[] = [
  {
    question: 'What is Active Recall?',
    answer:
      'A learning method where you actively stimulate memory for information rather than rereading or highlighting notes.',
  },
  {
    question: 'Why pair Active Recall with Spaced Repetition?',
    answer:
      'Reviewing challenging prompts on a timed schedule strengthens long-term retention and prevents last-minute cramming.',
  },
  {
    question: 'Give an example of applying Active Recall.',
    answer: 'Look away from your notes and explain a concept out loud or answer a flashcard without seeing the solution.',
  },
];

type EmbeddedFlashcardsProps = {
  cards?: Flashcard[] | null;
  title?: string;
  onHeightChange?: (height: number) => void;
};

export default function EmbeddedFlashcards({ cards, title, onHeightChange }: EmbeddedFlashcardsProps) {
  const deck = cards && cards.length > 0 ? cards : fallbackFlashcards;
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const lastHeightRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const notifyHeight = () => {
      const rect = node.getBoundingClientRect();
      const height = Math.ceil(rect.height);
      if (!Number.isFinite(height) || height <= 0) return;
      if (lastHeightRef.current === height) return;
      lastHeightRef.current = height;
      onHeightChange?.(height);
    };

    notifyHeight();

    if (typeof ResizeObserver === 'undefined') {
      const id = window.setInterval(notifyHeight, 250);
      return () => {
        window.clearInterval(id);
      };
    }

    const observer = new ResizeObserver(() => {
      notifyHeight();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div className="flex w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-6 md:px-8">
      <div ref={contentRef} className="w-full max-w-4xl">
        <FlashcardsModal
          open={true}
          isEmbedded={true}
          cards={deck}
          title={title ?? 'AI Generated Samples'}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
