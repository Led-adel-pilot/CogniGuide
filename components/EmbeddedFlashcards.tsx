'use client';

import FlashcardsModal, { type Flashcard } from '@/components/FlashcardsModal';

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
};

export default function EmbeddedFlashcards({ cards, title }: EmbeddedFlashcardsProps) {
  const deck = cards && cards.length > 0 ? cards : fallbackFlashcards;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-6 md:px-8">
      <div className="h-full w-full max-w-4xl">
        <FlashcardsModal
          open={true}
          isEmbedded={true}
          cards={deck}
          title={title ?? 'Sample Flashcards'}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
