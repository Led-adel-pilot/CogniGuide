'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { type Flashcard } from '@/components/FlashcardsModal';

type ShareViewerProps =
  | {
      type: 'mindmap';
      markdown: string;
      title?: string | null;
    }
  | {
      type: 'flashcards';
      cards: Flashcard[];
      title?: string | null;
      deckId?: string;
    };

export default function ShareViewer(props: ShareViewerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      router.push('/');
    }
  }, [isOpen, router]);

  if (props.type === 'mindmap') {
    return (
      <MindMapModal
        markdown={isOpen ? props.markdown : null}
        onClose={() => setIsOpen(false)}
      />
    );
  }

  return (
    <FlashcardsModal
      open={isOpen}
      title={props.title}
      cards={props.cards}
      isGenerating={false}
      error={null}
      onClose={() => setIsOpen(false)}
      deckId={props.deckId}
    />
  );
}
