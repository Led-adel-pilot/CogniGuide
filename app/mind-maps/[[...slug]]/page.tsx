import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import MindMapProgrammaticLanding from '@/components/MindMapProgrammaticLanding';
import {
  generatedMindMapPages,
  getProgrammaticMindMapPage,
} from '@/lib/programmatic/mindMapPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';
import {
  getMindMapHubBySlug,
  getMindMapSubhubBySlugs,
  mindMapHierarchyMetadataBase,
  mindMapUseCaseHubs,
  mindMapsPillarMetadata,
  type MindMapBreadcrumbSegment,
  type MindMapUseCaseHub,
  type MindMapUseCaseSubhub,
} from '@/lib/programmatic/mindMapUseCaseData';
import { ensureAbsoluteUrl } from '@/lib/seo/sitemap';

const defaultBreadcrumbs: MindMapBreadcrumbSegment[] = [
  { label: 'Home', href: '/' },
  { label: 'Mind Maps', href: '/mind-maps' },
];

type MindMapCatchAllParams = {
  slug?: string[];
};

const withCanonical = (metadata: Metadata, path: string): Metadata => ({
  ...metadata,
  alternates: {
    ...(metadata.alternates ?? {}),
    canonical: ensureAbsoluteUrl(path),
  },
});

const buildBreadcrumbs = (
  segments: MindMapBreadcrumbSegment[]
): MindMapBreadcrumbSegment[] => [...defaultBreadcrumbs, ...segments];

function Breadcrumbs({ segments }: { segments: MindMapBreadcrumbSegment[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
        {segments.map((segment, index) => (
          <li key={`${segment.label}-${index}`} className="flex items-center gap-2">
            {segment.href ? (
              <Link href={segment.href} className="hover:text-foreground">
                {segment.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
                {segment.label}
              </span>
            )}
            {index < segments.length - 1 ? <span aria-hidden="true">›</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function HubPage({ hub }: { hub: MindMapUseCaseHub }) {
  if (!hub) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
      <Breadcrumbs segments={buildBreadcrumbs([{ label: hub.name }])} />
      <header className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{hub.name}</h1>
        <p className="text-muted-foreground">{hub.pageIntro}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {hub.subhubs.map((subhub) => (
          <Link
            key={subhub.slug}
            href={subhub.path}
            className="group rounded-xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <h2 className="text-lg font-semibold group-hover:text-primary">{subhub.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{subhub.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SubhubPage({ hub, subhub }: { hub: MindMapUseCaseHub; subhub: MindMapUseCaseSubhub }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
      <Breadcrumbs
        segments={buildBreadcrumbs([
          { label: hub.name, href: hub.path },
          { label: subhub.name },
        ])}
      />
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{subhub.name}</h1>
        <p className="text-muted-foreground">{subhub.pageIntro}</p>
      </header>
      <div className="grid gap-4">
        {subhub.mindMaps.map((mindMap) => (
          <Link
            key={mindMap.slug}
            href={mindMap.href}
            className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <span className="font-medium text-primary">{mindMap.anchorText}</span>
            <span className="text-sm text-muted-foreground">{mindMap.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MindMapsPillarPage() {
  const heading =
    typeof mindMapsPillarMetadata.title === 'string'
      ? mindMapsPillarMetadata.title
      : 'AI Mind Map Templates & Programmatic Landings | CogniGuide';
  const description =
    mindMapsPillarMetadata.description ??
    'Browse CogniGuide’s AI mind map landing pages by topic. Upload files or prompts to generate visual outlines, then edit, export, or convert to flashcards.';

  return (
    <div className="container py-16">
      <header className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/70">
          AI mind map hub
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mindMapUseCaseHubs.map((hub) => (
          <Link
            key={hub.slug}
            href={hub.path}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Mind map hub</p>
            <h2 className="mt-3 text-xl font-semibold group-hover:text-primary">{hub.name}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{hub.menuDescription}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Explore subhubs
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.22 5.22a.75.75 0 0 1 1.06 0L13 11.94V7a.75.75 0 0 1 1.5 0v6.75a.75.75 0 0 1-.75.75H7a.75.75 0 0 1 0-1.5h4.94L4.16 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const buildStaticParams = (): MindMapCatchAllParams[] => {
  const params: MindMapCatchAllParams[] = [{ slug: [] }];
  const seen = new Set<string>();

  mindMapUseCaseHubs.forEach((hub) => {
    params.push({ slug: [hub.slug] });
    hub.subhubs.forEach((subhub) => {
      params.push({ slug: [hub.slug, subhub.slug] });
    });
    seen.add(hub.slug);
  });

  generatedMindMapPages.forEach((page) => {
    if (seen.has(page.slug)) {
      return;
    }
    seen.add(page.slug);
    params.push({ slug: [page.slug] });
  });

  return params;
};

export function generateStaticParams(): MindMapCatchAllParams[] {
  return buildStaticParams();
}

const getSegments = async (params: Promise<MindMapCatchAllParams>): Promise<string[]> => {
  const resolved = await params;
  return resolved.slug ?? [];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<MindMapCatchAllParams>;
}): Promise<Metadata> {
  const segments = await getSegments(params);

  if (segments.length === 0) {
    return withCanonical(mindMapsPillarMetadata, '/mind-maps');
  }

  if (segments.length === 1) {
    const [slug] = segments;
    const landing = getProgrammaticMindMapPage(slug);
    if (landing) {
      return buildProgrammaticMetadata(landing);
    }

    const hub = getMindMapHubBySlug(slug);
    if (hub) {
      const baseMetadata = withCanonical(mindMapHierarchyMetadataBase, hub.path);
      return {
        ...baseMetadata,
        title: `${hub.name} Mind Map Hub`,
        description: hub.metaDescription,
      };
    }

    return withCanonical(mindMapHierarchyMetadataBase, '/mind-maps');
  }

  if (segments.length === 2) {
    const [hubSlug, subhubSlug] = segments;
    const resolved = getMindMapSubhubBySlugs(hubSlug, subhubSlug);
    if (resolved) {
      const baseMetadata = withCanonical(mindMapHierarchyMetadataBase, resolved.subhub.path);
      return {
        ...baseMetadata,
        title: `${resolved.subhub.name} Mind Maps | ${resolved.hub.name}`,
        description: resolved.subhub.metaDescription,
      };
    }

    return withCanonical(mindMapHierarchyMetadataBase, '/mind-maps');
  }

  return withCanonical(mindMapHierarchyMetadataBase, '/mind-maps');
}

export default async function MindMapsCatchAllPage({
  params,
}: {
  params: Promise<MindMapCatchAllParams>;
}) {
  const segments = await getSegments(params);

  if (segments.length === 0) {
    return <MindMapsPillarPage />;
  }

  if (segments.length === 1) {
    const [slug] = segments;
    const landing = getProgrammaticMindMapPage(slug);

    if (landing) {
      return (
        <>
          <MindMapProgrammaticLanding page={landing} />
          {landing.structuredData ? (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(landing.structuredData) }}
            />
          ) : null}
        </>
      );
    }

    const hub = getMindMapHubBySlug(slug);
    if (hub) {
      return <HubPage hub={hub} />;
    }

    notFound();
  }

  if (segments.length === 2) {
    const [hubSlug, subhubSlug] = segments;
    const resolved = getMindMapSubhubBySlugs(hubSlug, subhubSlug);
    if (resolved) {
      return <SubhubPage {...resolved} />;
    }
    notFound();
  }

  notFound();
}
