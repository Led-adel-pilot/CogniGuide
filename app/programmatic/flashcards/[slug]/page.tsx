import FlashcardGeneratorLanding from '@/components/FlashcardGeneratorLanding';
import { generatedFlashcardPages, getProgrammaticFlashcardPage } from '@/lib/programmatic/flashcardPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return generatedFlashcardPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticFlashcardPage(slug);
  if (!page) {
    return {};
  }

  return buildProgrammaticMetadata(page);
}

export default async function ProgrammaticFlashcardPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getProgrammaticFlashcardPage(slug);

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
