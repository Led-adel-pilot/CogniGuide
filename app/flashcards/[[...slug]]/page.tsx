import FlashcardGeneratorLanding from '@/components/FlashcardGeneratorLanding';
import FlashcardsPillarPage from '@/components/FlashcardsPillarPage';
import {
  generatedFlashcardPages,
  getProgrammaticFlashcardPage,
} from '@/lib/programmatic/flashcardPages';
import { buildProgrammaticMetadata } from '@/lib/programmatic/metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FlashcardBreadcrumbSegment,
  flashcardHierarchyMetadataBase,
  flashcardsPillarMetadata,
  getHubBySlug,
  getSubhubBySlugs,
  useCaseHubs,
  type UseCaseHub,
  type UseCaseSubhub,
} from '@/lib/programmatic/useCaseData';

const defaultBreadcrumbs: FlashcardBreadcrumbSegment[] = [
  { label: 'Home', href: '/' },
  { label: 'Flashcards', href: '/flashcards' },
];

type FlashcardsCatchAllParams = {
  slug?: string[];
};

const buildBreadcrumbs = (
  segments: FlashcardBreadcrumbSegment[]
): FlashcardBreadcrumbSegment[] => [...defaultBreadcrumbs, ...segments];

function Breadcrumbs({ segments }: { segments: FlashcardBreadcrumbSegment[] }) {
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

function HubPage({ hub }: { hub: UseCaseHub }) {
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

function SubhubPage({ hub, subhub }: { hub: UseCaseHub; subhub: UseCaseSubhub }) {
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
        {subhub.flashcards.map((flashcard) => (
          <Link
            key={flashcard.slug}
            href={flashcard.href}
            className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <span className="font-medium text-primary">{flashcard.anchorText}</span>
            <span className="text-sm text-muted-foreground">{flashcard.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const buildStaticParams = (): FlashcardsCatchAllParams[] => {
  const params: FlashcardsCatchAllParams[] = [{ slug: [] }];
  const seen = new Set<string>();

  useCaseHubs.forEach((hub) => {
    params.push({ slug: [hub.slug] });
    hub.subhubs.forEach((subhub) => {
      params.push({ slug: [hub.slug, subhub.slug] });
    });
    seen.add(hub.slug);
  });

  generatedFlashcardPages.forEach((page) => {
    if (seen.has(page.slug)) {
      return;
    }
    seen.add(page.slug);
    params.push({ slug: [page.slug] });
  });

  return params;
};

export function generateStaticParams(): FlashcardsCatchAllParams[] {
  return buildStaticParams();
}

const getSegments = async (
  params: Promise<FlashcardsCatchAllParams>
): Promise<string[]> => {
  const resolved = await params;
  return resolved.slug ?? [];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<FlashcardsCatchAllParams>;
}): Promise<Metadata> {
  const segments = await getSegments(params);

  if (segments.length === 0) {
    return flashcardsPillarMetadata;
  }

  if (segments.length === 1) {
    const [slug] = segments;
    const landing = getProgrammaticFlashcardPage(slug);
    if (landing) {
      return buildProgrammaticMetadata(landing);
    }

    const hub = getHubBySlug(slug);
    if (hub) {
      return {
        ...flashcardHierarchyMetadataBase,
        title: `${hub.name} Flashcard Hub | CogniGuide`,
        description: hub.metaDescription,
      };
    }

    return flashcardHierarchyMetadataBase;
  }

  if (segments.length === 2) {
    const [hubSlug, subhubSlug] = segments;
    const resolved = getSubhubBySlugs(hubSlug, subhubSlug);
    if (resolved) {
      return {
        ...flashcardHierarchyMetadataBase,
        title: `${resolved.subhub.name} Flashcards | ${resolved.hub.name} | CogniGuide`,
        description: resolved.subhub.metaDescription,
      };
    }

    return flashcardHierarchyMetadataBase;
  }

  return flashcardHierarchyMetadataBase;
}

export default async function FlashcardsCatchAllPage({
  params,
}: {
  params: Promise<FlashcardsCatchAllParams>;
}) {
  const segments = await getSegments(params);

  if (segments.length === 0) {
    return <FlashcardsPillarPage />;
  }

  if (segments.length === 1) {
    const [slug] = segments;
    const landing = getProgrammaticFlashcardPage(slug);

    if (landing) {
      return (
        <>
          <FlashcardGeneratorLanding page={landing} />
          {landing.structuredData ? (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landing.structuredData) }} />
          ) : null}
        </>
      );
    }

    const hub = getHubBySlug(slug);
    if (hub) {
      return <HubPage hub={hub} />;
    }

    notFound();
  }

  if (segments.length === 2) {
    const [hubSlug, subhubSlug] = segments;
    const resolved = getSubhubBySlugs(hubSlug, subhubSlug);
    if (resolved) {
      return <SubhubPage {...resolved} />;
    }
    notFound();
  }

  notFound();
}
