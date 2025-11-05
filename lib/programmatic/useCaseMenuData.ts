import flashcardTaxonomyJson from '@/data/flashcard_taxonomy.json';

type FlashcardTaxonomy = Record<string, Record<string, string[]>>;

export type UseCaseMenuHub = {
  name: string;
  slug: string;
  path: string;
  menuDescription: string;
};

const rawHubData = flashcardTaxonomyJson as FlashcardTaxonomy;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildHubPath = (slug: string): string => `/flashcards/${slug}`;

const buildMenuDescription = (hubName: string): string =>
  // Mirrors the default string returned by getHubCopy in useCaseData.ts.
  `Explore ${hubName} study resources crafted with CogniGuide.`;

export const useCaseMenuHubs: UseCaseMenuHub[] = Object.entries(rawHubData).map(([hubName]) => {
  const slug = slugify(hubName);
  return {
    name: hubName,
    slug,
    path: buildHubPath(slug),
    menuDescription: buildMenuDescription(hubName),
  };
});
