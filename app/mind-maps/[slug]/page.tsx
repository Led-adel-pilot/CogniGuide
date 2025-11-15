import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import MindMapProgrammaticLanding from '@/components/MindMapProgrammaticLanding';
import {
  generatedMindMapPages,
  getProgrammaticMindMapPage,
} from '@/lib/programmatic/mindMapPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';

export function generateStaticParams(): Array<{ slug: string }> {
  return generatedMindMapPages.map((page) => ({ slug: page.slug }));
}

type PageParams = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticMindMapPage(slug);

  if (!page) {
    return {};
  }

  return buildProgrammaticMetadata(page);
}

export default async function MindMapProgrammaticPage({ params }: PageParams) {
  const { slug } = await params;
  const page = getProgrammaticMindMapPage(slug);

  if (!page) {
    notFound();
  }

  return <MindMapProgrammaticLanding page={page} />;
}
