import type { Metadata } from 'next';
import { siteMetadata } from '@/lib/siteMetadata';
import type { ProgrammaticFlashcardPage } from './flashcardPageSchema';
import type { ProgrammaticMindMapPage } from './mindMapPageSchema';

const absoluteUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${siteMetadata.url}${path.startsWith('/') ? path : `/${path}`}`;
};

export function buildProgrammaticMetadata(
  page: ProgrammaticFlashcardPage | ProgrammaticMindMapPage
): Metadata {
  const { metadata, path } = page;
  const canonical = metadata.canonical ?? absoluteUrl(path);
  const keywords = metadata.keywords?.length ? metadata.keywords : siteMetadata.keywords;

  return {
    title: metadata.title ?? siteMetadata.title,
    description: metadata.description ?? siteMetadata.description,
    keywords,
    alternates: {
      canonical,
    },
    robots: metadata.robots,
    openGraph: {
      title: metadata.title ?? siteMetadata.title,
      description: metadata.description ?? siteMetadata.description,
      url: canonical,
      siteName: siteMetadata.name,
      images: siteMetadata.ogImage ? [{ url: siteMetadata.ogImage }] : undefined,
    },
    twitter: {
      title: metadata.title ?? siteMetadata.title,
      description: metadata.description ?? siteMetadata.description,
      images: siteMetadata.ogImage ? [siteMetadata.ogImage] : undefined,
    },
  } satisfies Metadata;
}
