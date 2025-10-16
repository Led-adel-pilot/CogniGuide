// app/sitemap.ts
import { MetadataRoute } from 'next';
import { allFlashcardPages } from '@/lib/programmatic/flashcardPages';

const SITE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.cogniguide.app';

const staticRoutes = [
  '/',
  '/ai-mind-map-generator',
  '/pricing',
  '/contact',
  '/legal/terms',
  '/legal/privacy-policy',
  '/legal/refund-policy',
  '/legal/cancellation-policy',
  '/blog/how-to-study-for-exams',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const timestamp = new Date();
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const path of staticRoutes) {
    const url = `${SITE}${path === '/' ? '' : path}`;
    entries.set(url, {
      url,
      lastModified: timestamp,
      changeFrequency: 'weekly',
      priority: path === '/' ? 1 : path.startsWith('/pricing') ? 0.9 : 0.6,
    });
  }

  for (const page of allFlashcardPages) {
    const url = page.metadata.canonical ?? `${SITE}${page.path}`;
    entries.set(url, {
      url,
      lastModified: timestamp,
      changeFrequency: 'weekly',
      priority: page.path === '/ai-flashcard-generator' ? 0.9 : 0.5,
    });
  }

  return Array.from(entries.values());
}
