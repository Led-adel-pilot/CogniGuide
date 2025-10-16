import FlashcardGeneratorLanding from '@/components/FlashcardGeneratorLanding';
import { generatedFlashcardPages, getProgrammaticFlashcardPage } from '@/lib/programmatic/flashcardPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return generatedFlashcardPages.map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const page = getProgrammaticFlashcardPage(params.slug);
  if (!page) {
    return {};
  }

  return buildProgrammaticMetadata(page);
}

export default function ProgrammaticFlashcardPage({ params }: PageProps) {
  const page = getProgrammaticFlashcardPage(params.slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <FlashcardGeneratorLanding page={page} />
      {page.structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(page.structuredData) }} />
      ) : null}
    </>
  );
}
