import FlashcardGeneratorLanding from '@/components/FlashcardGeneratorLanding';
import { defaultFlashcardLanding } from '@/lib/programmatic/flashcardPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';
import type { Metadata } from 'next';

export function generateMetadata(): Metadata {
  return buildProgrammaticMetadata(defaultFlashcardLanding);
}

export default function Page() {
  return (
    <>
      <FlashcardGeneratorLanding page={defaultFlashcardLanding} />
      {defaultFlashcardLanding.structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(defaultFlashcardLanding.structuredData) }}
        />
      ) : null}
    </>
  );
}
