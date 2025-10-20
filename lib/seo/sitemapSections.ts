import { allFlashcardPages } from '@/lib/programmatic/flashcardPages';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';
import { ensureAbsoluteUrl, formatLastmod, SitemapEntry } from '@/lib/seo/sitemap';

const coreRoutes = [
  '/',
  '/ai-mind-map-generator',
  '/ai-flashcard-generator',
  '/pricing',
  '/contact',
  '/use-cases',
  '/blog/how-to-study-for-exams',
  '/blog/study-tips-for-high-school-students',
  '/legal/terms',
  '/legal/privacy-policy',
  '/legal/refund-policy',
  '/legal/cancellation-policy',
];

const sortByLocation = (entries: SitemapEntry[]): SitemapEntry[] =>
  [...entries].sort((a, b) => a.loc.localeCompare(b.loc));

export const getCoreSitemapEntries = (): SitemapEntry[] =>
  sortByLocation(
    coreRoutes.map((path) => ({
      loc: ensureAbsoluteUrl(path),
      lastmod: formatLastmod(),
    }))
  );

export const getHubSitemapEntries = (): SitemapEntry[] =>
  sortByLocation(
    useCaseHubs.map((hub) => ({
      loc: ensureAbsoluteUrl(`/use-cases/${hub.slug}`),
      lastmod: formatLastmod(),
    }))
  );

export const getSubhubSitemapEntries = (): SitemapEntry[] => {
  const entries: SitemapEntry[] = [];

  useCaseHubs.forEach((hub) => {
    hub.subhubs.forEach((subhub) => {
      entries.push({
        loc: ensureAbsoluteUrl(`/use-cases/${hub.slug}/${subhub.slug}`),
        lastmod: formatLastmod(),
      });
    });
  });

  return sortByLocation(entries);
};

export const getFlashcardLandingSitemapEntries = (): SitemapEntry[] => {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  allFlashcardPages.forEach((page) => {
    const canonical = page.metadata.canonical ?? page.path ?? `/flashcards/${page.slug}`;
    const loc = ensureAbsoluteUrl(canonical);

    if (seen.has(loc)) {
      return;
    }

    seen.add(loc);
    entries.push({
      loc,
      lastmod: formatLastmod(),
    });
  });

  return sortByLocation(entries);
};
