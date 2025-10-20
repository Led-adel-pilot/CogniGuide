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

export async function generateMetadata({ params }: { params: Promise<HubPageParams> }): Promise<Metadata> {
  const { hub: hubSlug } = await params;
  const hub = getHubBySlug(hubSlug);
  if (!hub) {
    return useCasesMetadataBase;
  }
  return {
    ...useCasesMetadataBase,
    title: `${hub.name} Use Cases | CogniGuide`,
    description: hub.metaDescription,
  };
}

export default async function UseCaseHubPage({ params }: { params: Promise<HubPageParams> }) {
  const { hub: hubSlug } = await params;
  const hub = getHubBySlug(hubSlug);
  if (!hub) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{hub.name}</h1>
        <p className="text-muted-foreground">{hub.pageIntro}</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        {hub.subhubs.map((subhub) => (
          <Link
            key={subhub.slug}
            href={`/use-cases/${hub.slug}/${subhub.slug}`}
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <h2 className="text-lg font-semibold group-hover:text-primary">{subhub.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{subhub.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

