'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { type Flashcard } from '@/components/FlashcardsModal';
import { supabase } from '@/lib/supabaseClient';

type ShareViewerProps =
  | {
      type: 'mindmap';
      markdown: string;
      title?: string | null;
      token: string;
    }
  | {
      type: 'flashcards';
      cards: Flashcard[];
      title?: string | null;
      deckId?: string;
      token: string;
    };

function isFlashcardsProps(props: ShareViewerProps): props is ShareViewerProps & { type: 'flashcards' } {
  return props.type === 'flashcards';
}

export default function ShareViewer(props: ShareViewerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [deckId, setDeckId] = useState(
    props.type === 'flashcards' ? props.deckId : undefined
  );
  const hasImportedRef = useRef(false);

  useEffect(() => {
    hasImportedRef.current = false;
  }, [props.token]);

  useEffect(() => {
    if (!isOpen) {
      router.push('/');
    }
  }, [isOpen, router]);

  useEffect(() => {
    if (isFlashcardsProps(props) && props.deckId) {
      setDeckId(props.deckId);
    }
  }, [props]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const ensureImported = async (accessToken: string) => {
      if (hasImportedRef.current || !props.token) return;
      hasImportedRef.current = true;
      try {
        const response = await fetch('/api/share-link/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: props.token }),
        });
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && result?.ok) {
          if (props.type === 'flashcards') {
            if (typeof result?.recordId === 'string' && result.recordId.length > 0) {
              setDeckId(result.recordId);
            }
          }
        } else {
          hasImportedRef.current = false;
        }
      } catch (error) {
        console.error('Failed to import shared resource:', error);
        hasImportedRef.current = false;
      }
    };

    const resolveAndImport = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (accessToken) {
          await ensureImported(accessToken);
        }
      } catch (error) {
        console.error('Unable to resolve Supabase session for shared resource:', error);
      }
    };

    resolveAndImport();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const accessToken = session?.access_token;
      if (accessToken) {
        ensureImported(accessToken);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, [isOpen, props.token, props.type]);

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
      deckId={deckId}
    />
  );
}
