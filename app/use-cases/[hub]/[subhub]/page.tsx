import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSubhubBySlugs, useCaseHubs, useCasesMetadataBase } from '@/lib/programmatic/useCaseData';

type SubhubPageParams = {
  hub: string;
  subhub: string;
};

export function generateStaticParams() {
  const params: SubhubPageParams[] = [];
  for (const hub of useCaseHubs) {
    for (const subhub of hub.subhubs) {
      params.push({ hub: hub.slug, subhub: subhub.slug });
    }
  }
  return params;
}

export function generateMetadata({ params }: { params: SubhubPageParams }): Metadata {
  const resolved = getSubhubBySlugs(params.hub, params.subhub);
  if (!resolved) {
    return useCasesMetadataBase;
  }
  const { hub, subhub } = resolved;
  return {
    ...useCasesMetadataBase,
    title: `${subhub.name} Use Cases | ${hub.name} | CogniGuide`,
    description: subhub.metaDescription,
  };
}

export default function UseCaseSubhubPage({ params }: { params: SubhubPageParams }) {
  const resolved = getSubhubBySlugs(params.hub, params.subhub);
  if (!resolved) {
    notFound();
  }
  const { hub, subhub } = resolved;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-wider text-muted-foreground">{hub.name}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{subhub.name}</h1>
        <p className="text-muted-foreground">{subhub.pageIntro}</p>
      </header>
      <div className="grid gap-4">
        {subhub.flashcards.map((flashcard) => (
          <Link
            key={flashcard.slug}
            href={flashcard.href}
            className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <span className="font-medium text-primary">{flashcard.anchorText}</span>
            <span className="text-sm text-muted-foreground">{flashcard.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

