import type { Metadata } from 'next';
import Link from 'next/link';
import { useCaseHubs, useCasesMetadataBase } from '@/lib/programmatic/useCaseData';

export const metadata: Metadata = {
  ...useCasesMetadataBase,
};

export default function UseCasesIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Explore Use Cases</h1>
        <p className="text-muted-foreground">
          Browse AI flashcard workflows organized by study goal. Jump into a hub to discover curated subtopics and related flashcard
          experiences.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {useCaseHubs.map((hub) => (
          <Link
            key={hub.slug}
            href={`/use-cases/${hub.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/60 hover:bg-card/80"
          >
            <h2 className="text-xl font-semibold group-hover:text-primary">{hub.name}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {hub.subhubs.map((subhub) => subhub.name).join(' • ')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

