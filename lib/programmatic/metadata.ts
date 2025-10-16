import type { Metadata } from 'next';
import { siteMetadata } from '@/lib/siteMetadata';
import type { ProgrammaticFlashcardPage } from './flashcardPageSchema';

const absoluteUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${siteMetadata.url}${path.startsWith('/') ? path : `/${path}`}`;
};

export function buildProgrammaticMetadata(page: ProgrammaticFlashcardPage): Metadata {
  const { metadata, path } = page;
  const canonical = metadata.canonical ?? absoluteUrl(path);
  const keywords = metadata.keywords?.length ? metadata.keywords : siteMetadata.keywords;
  const openGraph = metadata.openGraph ?? {};
  const twitter = metadata.twitter ?? {};

  return {
    title: metadata.title ?? siteMetadata.title,
    description: metadata.description ?? siteMetadata.description,
    keywords,
    alternates: {
      canonical,
    },
    robots: metadata.robots,
    openGraph: {
      siteName: openGraph.siteName ?? siteMetadata.name,
      type: openGraph.type ?? 'website',
      url: openGraph.url ?? canonical,
      title: openGraph.title ?? metadata.title ?? siteMetadata.title,
      description: openGraph.description ?? metadata.description ?? siteMetadata.description,
      images: openGraph.images ?? (siteMetadata.ogImage ? [{ url: siteMetadata.ogImage }] : undefined),
    },
    twitter: {
      card: twitter.card ?? 'summary_large_image',
      title: twitter.title ?? metadata.title ?? siteMetadata.title,
      description: twitter.description ?? metadata.description ?? siteMetadata.description,
      images: twitter.images ?? (siteMetadata.ogImage ? [siteMetadata.ogImage] : undefined),
    },
  } satisfies Metadata;
}
