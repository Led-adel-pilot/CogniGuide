import type { Metadata } from 'next';
import Link from 'next/link';

import { allMindMapPages } from '@/lib/programmatic/mindMapPages';
import { siteMetadata } from '@/lib/siteMetadata';

const pageTitle = 'AI Mind Map Templates & Programmatic Landings | CogniGuide';
const pageDescription =
  'Browse CogniGuide’s AI mind map landing pages by topic. Upload files or prompts to generate visual outlines, then edit, export, or convert to flashcards.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: `${siteMetadata.url}/mind-maps` },
  robots: { index: true, follow: true },
};

export default function MindMapIndexPage() {
  return (
    <div className="container py-16">
      <header className="max-w-3xl mx-auto text-center space-y-4 mb-12">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/70">AI mind map hub</p>
        <h1 className="text-3xl sm:text-4xl font-bold font-heading tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground">{pageDescription}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allMindMapPages.map((page) => (
          <Link
            key={page.slug}
            href={page.path}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/60 hover:bg-card/80"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">
              {page.hero.eyebrow ?? 'Mind Map Template'}
            </p>
            <h2 className="mt-3 text-xl font-semibold group-hover:text-primary">{page.hero.heading}</h2>
            {page.hero.subheading ? (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{page.hero.subheading}</p>
            ) : null}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              View landing
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
