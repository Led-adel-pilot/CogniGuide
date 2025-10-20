import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getHubBySlug, useCaseHubs, useCasesMetadataBase } from '@/lib/programmatic/useCaseData';

type HubPageParams = {
  hub: string;
};

export function generateStaticParams() {
  return useCaseHubs.map((hub) => ({ hub: hub.slug }));
}

export function generateMetadata({ params }: { params: HubPageParams }): Metadata {
  const hub = getHubBySlug(params.hub);
  if (!hub) {
    return useCasesMetadataBase;
  }
  return {
    ...useCasesMetadataBase,
    title: `${hub.name} Use Cases | CogniGuide`,
    description: `Explore flashcard workflows and subtopics within the ${hub.name} hub on CogniGuide.`,
  };
}

export default function UseCaseHubPage({ params }: { params: HubPageParams }) {
  const hub = getHubBySlug(params.hub);
  if (!hub) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{hub.name}</h1>
        <p className="text-muted-foreground">
          Dive into focused study paths tailored to this hub. Choose a subhub to view curated flashcard topics and content experie
ces.
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        {hub.subhubs.map((subhub) => (
          <Link
            key={subhub.slug}
            href={`/use-cases/${hub.slug}/${subhub.slug}`}
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <h2 className="text-lg font-semibold group-hover:text-primary">{subhub.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {subhub.flashcards
                .slice(0, 4)
                .map((link) => link.title)
                .join(' • ')}
              {subhub.flashcards.length > 4 ? ' • …' : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

