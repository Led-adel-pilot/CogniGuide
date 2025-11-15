import { allFlashcardPages } from '@/lib/programmatic/flashcardPages';
import { allMindMapPages } from '@/lib/programmatic/mindMapPages';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';
import { ensureAbsoluteUrl, formatLastmod, SitemapEntry } from '@/lib/seo/sitemap';

const coreRoutes = [
  '/',
  '/ai-mind-map-generator',
  '/ai-flashcard-generator',
  '/mind-maps',
  '/pricing',
  '/contact',
  '/flashcards',
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
      loc: ensureAbsoluteUrl(hub.path),
      lastmod: formatLastmod(),
    }))
  );

export const getSubhubSitemapEntries = (): SitemapEntry[] => {
  const entries: SitemapEntry[] = [];

  useCaseHubs.forEach((hub) => {
    hub.subhubs.forEach((subhub) => {
      entries.push({
        loc: ensureAbsoluteUrl(subhub.path),
        lastmod: formatLastmod(),
      });
    });
  });

  return sortByLocation(entries);
};

const addProgrammaticEntries = (
  pages: { slug: string; path?: string; metadata: { canonical?: string } }[],
  fallbackBase: string,
  entries: SitemapEntry[],
  seen: Set<string>
) => {
  pages.forEach((page) => {
    const canonical =
      page.metadata.canonical ??
      page.path ??
      `${fallbackBase}/${page.slug}`;
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
};

export const getProgrammaticLandingSitemapEntries = (): SitemapEntry[] => {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  addProgrammaticEntries(allFlashcardPages, '/flashcards', entries, seen);
  addProgrammaticEntries(allMindMapPages, '/mind-maps', entries, seen);

  return sortByLocation(entries);
};
