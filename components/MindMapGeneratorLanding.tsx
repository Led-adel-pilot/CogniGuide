'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { mindMapGeneratorFaqs } from '@/lib/data/mindMapGeneratorFaqs';
import { useCaseMenuHubs } from '@/lib/programmatic/useCaseMenuData';
import { broadcastAuthState, readSignedInFromCookies, writeCgAuthedCookie } from '@/lib/authCookie';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

const EmbeddedMindMap = dynamic(() => import('@/components/EmbeddedMindMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

const GeneratorWidget = dynamic(() => import('@/components/Generator'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-3xl border border-dashed border-muted/60 bg-muted/20">
      <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
      <span className="sr-only">Loading generator…</span>
    </div>
  ),
});

const mapTypes = [
  'Concept maps',
  'Semantic maps',
  'Idea maps',
  'Mental models',
  'Brainstorm diagrams',
  'Project outlines',
];

const useCases = [
  {
    title: 'For Students',
    description:
      'Create revision mind maps, organize lecture notes, and build stronger recall for exams in minutes.',
  },
  {
    title: 'For Brainstorming',
    description: 'Quickly visualize ideas, uncover relationships, and move from chaos to clarity during ideation sessions.',
  },
  {
    title: 'For Content Creation',
    description:
      'Structure articles, videos, and presentations with AI-generated outlines and ready-to-share mind maps.',
  },
];

const demoMarkdown = `# How AI Generates Mind Maps\n- Upload your notes, PDFs, or text files\n  - CogniGuide understands complex course material\n- AI highlights the core ideas\n  - Extracts topics, subtopics, and supporting facts\n- Instantly visualize connections\n  - Drag, expand, and customize every branch\n- Share or export with one click\n  - Keep teammates and classmates in sync`;

export default function MindMapGeneratorLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const useCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUseCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null);
  const lastSyncedAuthRef = useRef<boolean | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const rawCode = params.get('ref');
        if (rawCode && /^[A-Za-z0-9_-]{6,}$/u.test(rawCode)) {
          localStorage.setItem('cogniguide_pending_referral', rawCode);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthed) {
      setShowAuth(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    const syncAuthState = (signedIn: boolean) => {
      if (lastSyncedAuthRef.current === signedIn) {
        return;
      }
      lastSyncedAuthRef.current = signedIn;
      writeCgAuthedCookie(signedIn);
      broadcastAuthState(signedIn);
    };

    const evaluateAuth = () => {
      const signedIn = readSignedInFromCookies();
      setIsAuthed(signedIn);
      if (signedIn) {
        setShowAuth(false);
      }
      syncAuthState(signedIn);
    };

    const handleFocus = () => evaluateAuth();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        evaluateAuth();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'cg_auth_sync') {
        evaluateAuth();
      }
    };

    evaluateAuth();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!useCasesOpen) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const desktopMenu = useCaseMenuRef.current;
      const mobileMenu = mobileUseCaseMenuRef.current;

      if ((desktopMenu && desktopMenu.contains(target)) || (mobileMenu && mobileMenu.contains(target))) {
        return;
      }

      if (desktopMenu || mobileMenu) {
        setUseCasesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [useCasesOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return undefined;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const toggleButton = mobileMenuToggleRef.current;
      if (toggleButton && toggleButton.contains(target)) {
        return;
      }

      if (mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setUseCasesOpen(false);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUseCasesOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthModal open={showAuth} />

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10 relative">
          <div className="flex items-center gap-3 md:gap-6">
            <button
              type="button"
              ref={mobileMenuToggleRef}
              className="md:hidden inline-flex items-center justify-center rounded-full border border-transparent p-2 text-sm text-foreground transition hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4A1 1 0 0 1 3 5Zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H4Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <Image
                src={CogniGuideLogo}
                alt="CogniGuide Logo"
                width={28}
                height={28}
                className="h-7 w-7 text-primary md:h-10 md:w-10"
              />
              <h1 className="text-lg font-bold font-heading tracking-tighter md:text-2xl">CogniGuide</h1>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="relative" ref={useCaseMenuRef}>
                <button
                  type="button"
                  onClick={() => setUseCasesOpen((prev) => !prev)}
                  className="flex items-center gap-1 rounded-full border border-transparent px-3 py-2 text-sm text-foreground transition hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={useCasesOpen}
                  aria-haspopup="true"
                >
                  Use-cases
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    {useCasesOpen ? '▴' : '▾'}
                  </span>
                </button>
                {useCasesOpen ? (
                  <div className="absolute left-0 z-50 mt-3 w-screen max-w-3xl rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Featured hubs</div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {useCaseMenuHubs.map((hub) => (
                        <Link
                          key={hub.slug}
                          href={hub.path}
                          onClick={() => setUseCasesOpen(false)}
                          className="group flex h-full flex-col rounded-xl border border-transparent bg-muted/30 p-4 transition hover:border-primary/60 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="text-base font-semibold group-hover:text-primary">{hub.name}</span>
                          <span className="mt-2 text-sm text-muted-foreground">{hub.menuDescription}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground hover:underline"
              >
                Pricing
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAuthed ? (
              <>
                <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-muted/50">Dashboard</button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Try for Free</button>
            )}
          </div>
          {mobileMenuOpen ? (
            <div
              ref={mobileMenuRef}
              className="absolute left-0 top-full w-full border-b border-border bg-background/95 shadow-lg md:hidden"
            >
              <nav className="flex flex-col gap-1 p-4">
                <div className="relative" ref={mobileUseCaseMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUseCasesOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm text-foreground transition hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-expanded={useCasesOpen}
                    aria-haspopup="true"
                  >
                    Use-cases
                    <span aria-hidden="true" className="text-xs text-muted-foreground">
                      {useCasesOpen ? '▴' : '▾'}
                    </span>
                  </button>
                  {useCasesOpen ? (
                    <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Featured hubs</div>
                      <div className="grid gap-2">
                        {useCaseMenuHubs.map((hub) => (
                          <Link
                            key={hub.slug}
                            href={hub.path}
                            onClick={() => {
                              setUseCasesOpen(false);
                              setMobileMenuOpen(false);
                            }}
                            className="group flex flex-col rounded-lg border border-transparent bg-muted/30 p-3 text-left transition hover:border-primary/60 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="text-sm font-semibold group-hover:text-primary">{hub.name}</span>
                            <span className="mt-1 text-xs text-muted-foreground">{hub.menuDescription}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  Pricing
                </Link>
              </nav>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden pt-6 pb-16 md:pt-12 md:pb-24">
          <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-5 pointer-events-none" aria-hidden="true" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" aria-hidden="true" />
          <div className="container">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
              <div className="w-full lg:w-[30rem] xl:w-[34rem]">
                <div className="text-center lg:text-left">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading tracking-tighter md:leading-tight mb-4">
                    Free AI Mind Map Generator & Maker
                  </h1>
                  <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    The best online tool to create mind maps, concept maps, and brainstorm diagrams automatically. Turn your notes and ideas into clear visuals in seconds.
                  </p>
                  <div className="mt-6 flex justify-center lg:justify-start">
                    <div className="inline-flex flex-col items-center gap-1">
                      <button
                        onClick={() => (isAuthed ? router.push('/dashboard') : setShowAuth(true))}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 hover:shadow-primary/40"
                      >
                        Create a map now
                      </button>
                      <p className="text-sm text-muted-foreground">Free account. No credit card required.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full">
                <GeneratorWidget redirectOnAuth showTitle={false} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-8">
          <div className="container">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-base md:text-lg text-muted-foreground">
                Join our community of students who have generated over <span className="font-semibold text-foreground">200+</span> mind maps in just the last few weeks.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Free & Online
              </div>
            </div>
          </div>
        </section>

        <section className="pt-16 pb-16 md:pt-20 md:pb-20">
          <div className="container grid gap-12 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_28rem)] lg:items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Go from Text to Mind Map with AI</h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Upload a document or paste your notes and let CogniGuide&apos;s AI mind map generator analyze the content, surface the key concepts, and build an interactive map automatically.
              </p>
              <ul className="mt-6 space-y-4 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Instant structure from raw notes</p>
                    <p>Save hours of manual formatting with branching that appears the moment you submit your source.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Turn PDFs, notes &amp; slides into visual maps</p>
                    <p>Handle everything from lecture notes to research PDFs with one streamlined workflow.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">Interactive editing and sharing</p>
                    <p>Customize branches, add context, and share or export your mind map instantly.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-background rounded-3xl border shadow-xl shadow-primary/10 overflow-hidden">
              <div className="h-[320px] md:h-[420px]">
                <EmbeddedMindMap markdown={demoMarkdown} />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-muted/20 border-y">
          <div className="container">
            <div className="max-w-3xl">
              <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
                Concept Maps, Outlines &amp; Diagrams — Auto-Generated
              </h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Whether you call it a concept map, idea map, or semantic map, CogniGuide adapts the layout to fit the information you need to organize.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {mapTypes.map((type) => (
                  <div key={type} className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Who Uses CogniGuide</h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Discover how different teams and learners use CogniGuide to stay organized, communicate ideas, and accelerate progress.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {useCases.map((useCase) => (
                <div key={useCase.title} className="rounded-3xl border bg-background p-6 text-left shadow-sm">
                  <h3 className="text-xl font-semibold text-foreground">{useCase.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 border-y bg-muted/10">
          <div className="container grid gap-10 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_28rem)] lg:items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Remember more with spaced repetition</h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                CogniGuide doesn&apos;t stop at visualizing ideas. Every node can become a flashcard that feeds into an adaptive spaced-repetition schedule, so you retain concepts long after the brainstorming session ends.
              </p>
              <ul className="mt-6 space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span>Generate flashcard decks directly from your mind maps.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span>Review with science-backed spacing intervals tailored to your progress.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                  <span>Sync study sessions across devices so you never lose momentum.</span>
                </li>
              </ul>
            </div>
            <div className="rounded-3xl border bg-background p-8 shadow-xl shadow-primary/10">
              <h3 className="text-2xl font-semibold text-foreground">Study smarter after mapping</h3>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Once your structure is mapped, tap the flashcard mode to surface prompts, definitions, and supporting facts. CogniGuide spaces your reviews to lock information into long-term memory.
              </p>
              <button
                onClick={() => (isAuthed ? router.push('/dashboard') : setShowAuth(true))}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Try flashcards with your next map
              </button>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-muted/20 border-t">
          <div className="container max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Frequently Asked Questions</h2>
            <div className="mt-8 space-y-4">
              {mindMapGeneratorFaqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border bg-background p-6"
                  open={faq.question === mindMapGeneratorFaqs[0].question}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-left text-lg font-semibold text-foreground">
                    <span>{faq.question}</span>
                    <svg
                      className="ml-4 h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="mt-4 text-base leading-relaxed text-muted-foreground">{faq.answer}</div>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center">
              <button
                onClick={() => (isAuthed ? router.push('/dashboard') : setShowAuth(true))}
                className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Start building with CogniGuide
              </button>
              <p className="mt-2 text-sm text-muted-foreground">Experience the AI mind map maker trusted by learners worldwide.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/40">
        <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
          <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <Link href="/pricing" className="text-xs text-muted-foreground/70 hover:underline md:hidden">
              Pricing
            </Link>
            <Link href="/ai-mind-map-generator" className="text-xs text-muted-foreground/70 hover:underline">
              Mind Map Generator
            </Link>
            <Link href="/mind-maps" className="text-xs text-muted-foreground/70 hover:underline">
              Mind Map Use Cases
            </Link>
            <Link
              href="/ai-flashcard-generator"
              className="text-xs text-muted-foreground/70 hover:underline"
            >
              Flashcard Generator
            </Link>
            <Link href="/flashcards" className="text-xs text-muted-foreground/70 hover:underline">
              Flashcards Use Cases
            </Link>
            <Link href="/contact" className="text-xs text-muted-foreground/70 hover:underline">
              Contact
            </Link>
            <Link href="/legal/refund-policy" className="text-xs text-muted-foreground/70 hover:underline">
              Refund Policy
            </Link>
            <Link href="/legal/cancellation-policy" className="text-xs text-muted-foreground/70 hover:underline">
              Cancellation Policy
            </Link>
            <Link href="/legal/terms" className="text-xs text-muted-foreground/70 hover:underline">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
