import type { Metadata } from 'next';
import mindmapTaxonomyJson from '@/data/mindmap_taxonomy.json';
import { generatedMindMapPages } from '@/lib/programmatic/generated/mindMapPages';

export type MindMapLink = {
  slug: string;
  href: string;
  title: string;
  anchorText: string;
  description: string;
};

export type MindMapUseCaseSubhub = {
  name: string;
  slug: string;
  path: string;
  description: string;
  pageIntro: string;
  metaDescription: string;
  mindMaps: MindMapLink[];
};

export type MindMapUseCaseHub = {
  name: string;
  slug: string;
  path: string;
  menuDescription: string;
  pageIntro: string;
  metaDescription: string;
  subhubs: MindMapUseCaseSubhub[];
};

export type MindMapBreadcrumbSegment = {
  label: string;
  href?: string;
};

type MindMapTaxonomy = Record<string, Record<string, string[]>>;

const rawHubData = mindmapTaxonomyJson as MindMapTaxonomy;

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

const buildHubPath = (slug: string): string => `/mind-maps/${slug}`;

const buildSubhubPath = (hubSlug: string, subhubSlug: string): string =>
  `/mind-maps/${hubSlug}/${subhubSlug}`;

type MindMapLinkMetadata = {
  href: string;
  title?: string;
  description?: string;
  anchorTextVar1?: string;
  anchorTextVar2?: string;
  linkDescription?: string;
};

const mindMapPageMap = new Map<string, MindMapLinkMetadata>(
  generatedMindMapPages.map((page) => [
    page.slug,
    {
      href: page.path ?? `/mind-maps/${page.slug}`,
      title: page.hero.heading ?? humanize(page.slug),
      description: page.metadata?.description ?? page.hero.subheading,
      anchorTextVar1: page.linkingRecommendations?.anchorTextVar1,
      anchorTextVar2: page.linkingRecommendations?.anchorTextVar2,
      linkDescription: page.linkingRecommendations?.description,
    },
  ])
);

type HubCopyEntry = {
  menuDescription: string;
  pageIntro: string;
  metaDescription: string;
};

type HubCopy = Record<string, HubCopyEntry>;

type SubhubCopyEntry = {
  description: string;
  pageIntro: string;
  metaDescription: string;
};

type SubhubCopyMap = Record<string, SubhubCopyEntry>;

const hubCopy: HubCopy = {};

const makeSubhubKey = (hubSlug: string, subhubSlug: string): string =>
  `${hubSlug}::${subhubSlug}`;

const subhubCopy: SubhubCopyMap = {};

const getHubCopy = (hubName: string): HubCopyEntry => {
  const copy = hubCopy[hubName];
  if (copy) {
    return copy;
  }
  return {
    menuDescription: `Explore ${hubName} mind map templates crafted with CogniGuide.`,
    pageIntro: `Discover AI mind maps curated for ${hubName} topics.`,
    metaDescription: `Browse ${hubName} mind map hubs generated with CogniGuide.`,
  };
};

const getSubhubCopy = (
  hubName: string,
  hubSlug: string,
  subhubName: string,
  subhubSlug: string
): SubhubCopyEntry => {
  const key = makeSubhubKey(hubSlug, subhubSlug);
  const copy = subhubCopy[key];
  if (copy) {
    return copy;
  }
  return {
    description: `AI mind map templates for ${subhubName} topics within ${hubName}.`,
    pageIntro: `Dive into ${subhubName} mind map workflows in the ${hubName} hub.`,
    metaDescription: `Explore ${subhubName} mind map resources in the ${hubName} hub on CogniGuide.`,
  };
};

const buildMindMapLinks = (slugs: string[]): MindMapLink[] =>
  slugs
    .map((slug) => {
      const entry = mindMapPageMap.get(slug);
      if (!entry) {
        // Only surface links for slugs that exist in generated mind map pages.
        return null;
      }

      const fallbackTitle = humanize(slug);
      const anchorText =
        entry.anchorTextVar1 ??
        entry.anchorTextVar2 ??
        entry.title ??
        fallbackTitle;
      const description =
        entry.linkDescription ??
        entry.description ??
        entry.title ??
        fallbackTitle;

      return {
        slug,
        href: entry.href ?? `/mind-maps/${slug}`,
        title: entry.title ?? fallbackTitle,
        anchorText,
        description,
      };
    })
    .filter((link): link is MindMapLink => Boolean(link));

export const mindMapUseCaseHubs: MindMapUseCaseHub[] = Object.entries(rawHubData).map(
  ([hubName, subhubMap]) => {
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
          mindMaps: buildMindMapLinks(slugs),
        };
      }),
    };
  }
);

export const mindMapUseCaseHubMap = new Map(mindMapUseCaseHubs.map((hub) => [hub.slug, hub]));

export const getMindMapHubBySlug = (slug: string): MindMapUseCaseHub | undefined =>
  mindMapUseCaseHubMap.get(slug);

export const getMindMapSubhubBySlugs = (
  hubSlug: string,
  subhubSlug: string
): { hub: MindMapUseCaseHub; subhub: MindMapUseCaseSubhub } | undefined => {
  const hub = getMindMapHubBySlug(hubSlug);
  if (!hub) return undefined;
  const subhub = hub.subhubs.find((item) => item.slug === subhubSlug);
  if (!subhub) return undefined;
  return { hub, subhub };
};

export const getMindMapBreadcrumbs = (slug: string): MindMapBreadcrumbSegment[] => {
  const segments: MindMapBreadcrumbSegment[] = [
    { label: 'Home', href: '/' },
    { label: 'Mind Maps', href: '/mind-maps' },
  ];

  for (const hub of mindMapUseCaseHubs) {
    const subhub = hub.subhubs.find((candidate) =>
      candidate.mindMaps.some((mindMap) => mindMap.slug === slug)
    );

    if (!subhub) {
      continue;
    }

    const mindMap = subhub.mindMaps.find((item) => item.slug === slug);

    segments.push({ label: hub.name, href: hub.path });
    segments.push({ label: subhub.name, href: subhub.path });
    segments.push({
      label: mindMap?.anchorText ?? mindMap?.title ?? humanize(slug),
    });

    return segments;
  }

  const fallbackTitle = mindMapPageMap.get(slug)?.title ?? humanize(slug);
  segments.push({ label: fallbackTitle });
  return segments;
};

export const mindMapsPillarMetadata: Metadata = {
  title: 'AI Mind Map Templates & Programmatic Landings | CogniGuide',
  description:
    'Browse CogniGuide’s AI mind map landing pages by topic. Upload files or prompts to generate visual outlines, then edit, export, or convert to flashcards.',
};

export const mindMapHierarchyMetadataBase: Metadata = {
  title: 'Mind Map Study Hubs | CogniGuide',
  description:
    'Explore AI mind map hubs organized by study skills, academic subjects, and professional workflows.',
};
