import { allFlashcardPages } from '@/lib/programmatic/flashcardPages';
import { allMindMapPages } from '@/lib/programmatic/mindMapPages';
import { mindMapUseCaseHubs } from '@/lib/programmatic/mindMapUseCaseData';
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

const dedupeEntries = (entries: SitemapEntry[]): SitemapEntry[] => {
  const byUrl = new Map<string, SitemapEntry>();
  entries.forEach((entry) => byUrl.set(entry.loc, entry));
  return [...byUrl.values()];
};

export const getCoreSitemapEntries = (): SitemapEntry[] =>
  sortByLocation(
    coreRoutes.map((path) => ({
      loc: ensureAbsoluteUrl(path),
      lastmod: formatLastmod(),
    }))
  );

export const getHubSitemapEntries = (): SitemapEntry[] => {
  const buildEntries = (hubs: { path: string }[]) =>
    hubs.map((hub) => ({
      loc: ensureAbsoluteUrl(hub.path),
      lastmod: formatLastmod(),
    }));

  return sortByLocation(
    dedupeEntries([...buildEntries(useCaseHubs), ...buildEntries(mindMapUseCaseHubs)])
  );
};

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

  mindMapUseCaseHubs.forEach((hub) => {
    hub.subhubs.forEach((subhub) => {
      entries.push({
        loc: ensureAbsoluteUrl(subhub.path),
        lastmod: formatLastmod(),
      });
    });
  });

  return sortByLocation(dedupeEntries(entries));
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
