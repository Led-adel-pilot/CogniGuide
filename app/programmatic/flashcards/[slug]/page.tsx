export { generateMetadata, generateStaticParams } from '@/app/flashcards/[slug]/page';

import { notFound, permanentRedirect } from 'next/navigation';
import { getProgrammaticFlashcardPage } from '@/lib/programmatic/flashcardPages';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LegacyProgrammaticFlashcardPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getProgrammaticFlashcardPage(slug);

  if (!page) {
    notFound();
  }

  permanentRedirect(page.path);
}
