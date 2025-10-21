import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import {
  generatedFlashcardPages,
  getProgrammaticFlashcardPage,
} from '@/lib/programmatic/flashcardPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';

export function generateStaticParams(): Array<{ slug: string }> {
  return generatedFlashcardPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticFlashcardPage(slug);

  if (!page) {
    return {};
  }

  return buildProgrammaticMetadata(page);
}

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
