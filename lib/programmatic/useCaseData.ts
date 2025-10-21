import type { Metadata } from 'next';
import flashcardTaxonomyJson from '@/data/flashcard_taxonomy.json';
import { generatedFlashcardPages } from '@/lib/programmatic/generated/flashcardPages';
import { flashcardLinkMetadata } from '@/lib/programmatic/generated/flashcardLinkMetadata';

export type UseCaseLink = {
  slug: string;
  href: string;
  title: string;
  anchorText: string;
  description: string;
};

export type UseCaseSubhub = {
  name: string;
  slug: string;
  path: string;
  description: string;
  pageIntro: string;
  metaDescription: string;
  flashcards: UseCaseLink[];
};

export type UseCaseHub = {
  name: string;
  slug: string;
  path: string;
  menuDescription: string;
  pageIntro: string;
  metaDescription: string;
  subhubs: UseCaseSubhub[];
};

export type FlashcardBreadcrumbSegment = {
  label: string;
  href?: string;
};

type FlashcardTaxonomy = Record<string, Record<string, string[]>>;

const rawHubData = flashcardTaxonomyJson as FlashcardTaxonomy;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const humanize = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const buildHubPath = (slug: string): string => `/flashcards/${slug}`;

const buildSubhubPath = (hubSlug: string, subhubSlug: string): string =>
  `/flashcards/${hubSlug}/${subhubSlug}`;

const flashcardPageMap = new Map(
  generatedFlashcardPages.map((page) => [
    page.slug,
    {
      href: page.path ?? `/flashcards/${page.slug}`,
      title: page.metadata?.title ?? humanize(page.slug),
      description: page.metadata?.description,
    },
  ])
);

const getHubCopy = (hubName: string): HubCopy => {
  const copy = hubCopy[hubName];
  if (copy) {
    return copy;
  }
  return {
    menuDescription: `Explore ${hubName} study resources crafted with CogniGuide.`,
    pageIntro: `Discover flashcard workflows curated for ${hubName}.`,
    metaDescription: `Explore ${hubName} flashcard workflows on CogniGuide.`,
  };
};

const getSubhubCopy = (
  hubName: string,
  hubSlug: string,
  subhubName: string,
  subhubSlug: string
): SubhubCopy => {
  const key = makeSubhubKey(hubSlug, subhubSlug);
  const copy = subhubCopy[key];
  if (copy) {
    return copy;
  }
  return {
    description: `AI flashcards for ${subhubName} topics within ${hubName}.`,
    pageIntro: `Dive into ${subhubName} resources curated for the ${hubName} hub.`,
    metaDescription: `Explore ${subhubName} flashcards in the ${hubName} hub on CogniGuide.`,
  };
};

const buildFlashcardLinks = (slugs: string[]): UseCaseLink[] =>
  slugs.map((slug) => {
    const entry = flashcardPageMap.get(slug);
    const linkMetadata = flashcardLinkMetadata[slug];
    const title = entry?.title ?? humanize(slug);
    const anchorText =
      linkMetadata?.anchorTextVar1 ??
      linkMetadata?.anchorTextVar2 ??
      title;
    const description =
      linkMetadata?.description ??
      entry?.description ??
      title;

    return {
      slug,
      href: entry?.href ?? `/flashcards/${slug}`,
      title,
      anchorText,
      description,
    };
  });

export const useCaseHubs: UseCaseHub[] = Object.entries(rawHubData).map(([hubName, subhubMap]) => {
  const hubSlug = slugify(hubName);
  const hubMetadata = getHubCopy(hubName);

  return {
    name: hubName,
    slug: hubSlug,
    path: buildHubPath(hubSlug),
    menuDescription: hubMetadata.menuDescription,
    pageIntro: hubMetadata.pageIntro,
    metaDescription: hubMetadata.metaDescription,
    subhubs: Object.entries(subhubMap).map(([subhubName, slugs]) => {
      const subhubSlug = slugify(subhubName);
      const subhubMetadata = getSubhubCopy(hubName, hubSlug, subhubName, subhubSlug);
      return {
        name: subhubName,
        slug: subhubSlug,
        path: buildSubhubPath(hubSlug, subhubSlug),
        description: subhubMetadata.description,
        pageIntro: subhubMetadata.pageIntro,
        metaDescription: subhubMetadata.metaDescription,
        flashcards: buildFlashcardLinks(slugs),
      };
    }),
  };
});

export const useCaseHubMap = new Map(useCaseHubs.map((hub) => [hub.slug, hub]));

export const getHubBySlug = (slug: string): UseCaseHub | undefined => useCaseHubMap.get(slug);

export const getSubhubBySlugs = (
  hubSlug: string,
  subhubSlug: string
): { hub: UseCaseHub; subhub: UseCaseSubhub } | undefined => {
  const hub = getHubBySlug(hubSlug);
  if (!hub) return undefined;
  const subhub = hub.subhubs.find((item) => item.slug === subhubSlug);
  if (!subhub) return undefined;
  return { hub, subhub };
};

export const getFlashcardBreadcrumbs = (slug: string): FlashcardBreadcrumbSegment[] => {
  const segments: FlashcardBreadcrumbSegment[] = [
    { label: 'Home', href: '/' },
    { label: 'Flashcards', href: '/flashcards' },
  ];

  for (const hub of useCaseHubs) {
    const subhub = hub.subhubs.find((candidate) =>
      candidate.flashcards.some((flashcard) => flashcard.slug === slug)
    );

    if (!subhub) {
      continue;
    }

    const flashcard = subhub.flashcards.find((item) => item.slug === slug);

    segments.push({ label: hub.name, href: hub.path });
    segments.push({ label: subhub.name, href: subhub.path });
    segments.push({
      label: flashcard?.anchorText ?? flashcard?.title ?? humanize(slug),
    });

    return segments;
  }

  const fallbackTitle = flashcardPageMap.get(slug)?.title ?? humanize(slug);
  segments.push({ label: fallbackTitle });
  return segments;
};

export const flashcardsPillarMetadata: Metadata = {
  title: 'AI Flashcards & Study Generator | CogniGuide',
  description:
    'Learn how CogniGuide creates AI flashcards with spaced repetition, explore top study workflows, and jump into curated hubs for exams, languages, phonics, and K-5 skills.',
};

export const flashcardHierarchyMetadataBase: Metadata = {
  title: 'Flashcard Study Hubs | CogniGuide',
  description:
    'Browse AI flashcard hubs organized by exam prep, language learning, literacy, STEM, K-5 skills, and more specialized study goals.',
};

