'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ProgrammaticCTA, ProgrammaticFlashcardPage, RichTextBlock } from '@/lib/programmatic/flashcardPageSchema';
import CogniGuideLogo from '../CogniGuide_logo.png';
import type { Flashcard } from '@/components/FlashcardsModal';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';
import { broadcastAuthState, readSignedInFromCookies, writeCgAuthedCookie } from '@/lib/authCookie';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const EmbeddedFlashcards = dynamic(() => import('@/components/EmbeddedFlashcards'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

type FlashcardGeneratorLandingProps = {
  page: ProgrammaticFlashcardPage;
};

const CTAButton = ({
  cta,
  onOpenAuth,
  className,
}: {
  cta?: ProgrammaticCTA;
  onOpenAuth: () => void;
  className: string;
}) => {
  if (!cta) return null;

  if (cta.type === 'modal') {
    return (
      <button
        type="button"
        onClick={onOpenAuth}
        className={className}
        aria-label={cta.ariaLabel ?? cta.label}
      >
        {cta.label}
      </button>
    );
  }

  return (
    <Link
      href={cta.href}
      className={className}
      aria-label={cta.ariaLabel ?? cta.label}
      target={cta.target}
      rel={cta.rel}
    >
      {cta.label}
    </Link>
  );
};

const renderRichTextBlock = (block: RichTextBlock, index: number) => {
  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag key={`list-${index}`} className="mb-6 space-y-2 list-disc list-inside marker:text-primary">
        {block.items.map((item, itemIndex) => (
          <li key={`list-${index}-${itemIndex}`} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ListTag>
    );
  }

  return (
    <p key={`paragraph-${index}`} className="mb-6 last:mb-0" dangerouslySetInnerHTML={{ __html: block.html }} />
  );
};

export default function FlashcardGeneratorLanding({ page }: FlashcardGeneratorLandingProps) {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [embeddedFlashcardHeight, setEmbeddedFlashcardHeight] = useState<number | null>(null);
  const router = useRouter();
  const lastMeasuredEmbedHeightRef = useRef<number>(0);
  const lastSyncedAuthRef = useRef<boolean | null>(null);
  const useCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUseCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null);

  const computeEmbeddedBaseHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const width = window.innerWidth;
    if (width >= 1024) {
      return 30 * 16; // lg:h-[30rem]
    }
    if (width >= 768) {
      return 26 * 16; // md:h-[26rem]
    }
    return Math.round(window.innerHeight * 0.65); // h-[65vh]
  }, []);

  const handleEmbeddedFlashcardHeight = useCallback(
    (height: number) => {
      if (!height || !Number.isFinite(height)) return;
      lastMeasuredEmbedHeightRef.current = height;
      const baseHeight = computeEmbeddedBaseHeight();
      const nextHeight = Math.max(height, baseHeight);
      setEmbeddedFlashcardHeight((prev) => {
        if (prev === null) return nextHeight;
        return Math.abs(prev - nextHeight) > 1 ? nextHeight : prev;
      });
    },
    [computeEmbeddedBaseHeight]
  );

  useEffect(() => {
    const handleResize = () => {
      const baseHeight = computeEmbeddedBaseHeight();
      const measured = lastMeasuredEmbedHeightRef.current;
      if (!measured) {
        setEmbeddedFlashcardHeight(baseHeight > 0 ? baseHeight : null);
        return;
      }
      const nextHeight = Math.max(measured, baseHeight);
      setEmbeddedFlashcardHeight((prev) => {
        if (prev === null) return nextHeight;
        return Math.abs(prev - nextHeight) > 1 ? nextHeight : prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [computeEmbeddedBaseHeight]);

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

  const embeddedFlashcardDeck = useMemo<Flashcard[] | null>(() => {
    if (!Array.isArray(page.embeddedFlashcards)) {
      return null;
    }

    const sanitized = page.embeddedFlashcards
      .filter((card): card is { question: string; answer: string } => {
        return Boolean(card?.question?.trim() && card?.answer?.trim());
      })
      .map((card) => ({
        question: card.question.trim(),
        answer: card.answer.trim(),
      }));

    return sanitized.length > 0 ? sanitized : null;
  }, [page.embeddedFlashcards]);

  const headingFontSizes = useMemo(() => {
    const minChars = 51;
    const maxChars = 59;
    const maxFontSize = 3;
    const minFontSize = 2.8;
    const headingLength = page.hero.heading.length;

    let desktopRem = maxFontSize;

    if (headingLength >= maxChars) {
      desktopRem = minFontSize;
    } else if (headingLength > minChars) {
      const ratio = (headingLength - minChars) / (maxChars - minChars);
      desktopRem = maxFontSize - ratio * (maxFontSize - minFontSize);
    }

    const mobileRem = Math.max(1.9, Math.min(desktopRem - 0.3, 2.0));

    const desktop = Number(desktopRem.toFixed(3));
    const mobile = Number(mobileRem.toFixed(3));

    return {
      desktop: `${desktop}rem`,
      mobile: `${mobile}rem`,
    };
  }, [page.hero.heading]);

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
    setEmbeddedFlashcardHeight((prev) => prev ?? computeEmbeddedBaseHeight());
  }, [computeEmbeddedBaseHeight]);

  return (
    <>
      <AuthModal open={showAuth} />
      <div className="flex flex-col min-h-screen font-sans bg-background text-foreground">
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
                        {useCaseHubs.map((hub) => (
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
                          {useCaseHubs.map((hub) => (
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
          <section className="relative pt-4 pb-16 md:pt-9 md:pb-20 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            <div className="container">
              <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                <div className="w-full lg:w-[28rem] xl:w-[32rem]">
                  <div className="text-center lg:text-left">
                    {page.hero.eyebrow ? (
                      <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">{page.hero.eyebrow}</p>
                    ) : null}
                    <h1
                      className="font-bold font-heading tracking-tighter md:leading-tight mb-4 text-[length:var(--hero-heading-mobile)] md:text-[length:var(--hero-heading-desktop)]"
                      style={
                        {
                          '--hero-heading-desktop': headingFontSizes.desktop,
                          '--hero-heading-mobile': headingFontSizes.mobile,
                        } as CSSProperties
                      }
                    >
                      {page.hero.heading}
                    </h1>
                    <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                      {page.hero.subheading}
                    </p>
                    <div className="mt-6 flex justify-center lg:justify-start">
                      <div className="inline-flex flex-col items-center gap-1 sm:items-center">
                        <CTAButton
                          cta={page.hero.primaryCta}
                          onOpenAuth={() => setShowAuth(true)}
                          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 hover:shadow-primary/40 md:px-10 md:py-3.5 md:text-lg z-10 relative"
                        />
                        <p className="text-sm text-muted-foreground">No credit card required</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-[28rem]">
                  <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                    <div
                      className="w-full"
                      style={embeddedFlashcardHeight ? { height: `${embeddedFlashcardHeight}px` } : undefined}
                    >
                      <EmbeddedFlashcards
                        cards={embeddedFlashcardDeck}
                        title="AI Generated Samples"
                        onHeightChange={handleEmbeddedFlashcardHeight}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10 md:pt-12 pb-12 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">{page.featuresSection.heading}</h2>
                {page.featuresSection.subheading ? (
                  <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">{page.featuresSection.subheading}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {page.featuresSection.features.map((feature) => (
                  <div key={feature.title} className="bg-background rounded-2xl border p-6 shadow-sm">
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="pt-12 md:pt-16 pb-12">
            <div className="container px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">{page.howItWorksSection.heading}</h2>
                {page.howItWorksSection.subheading ? (
                  <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">{page.howItWorksSection.subheading}</p>
                ) : null}
              </div>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none">
                {page.howItWorksSection.steps.map((step, index) => (
                  <li key={step.title} className="bg-background rounded-2xl border p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold bg-background text-foreground">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {page.howItWorksSection.cta ? (
                <div className="text-center mt-8">
                  <CTAButton
                    cta={page.howItWorksSection.cta}
                    onOpenAuth={() => setShowAuth(true)}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                  />
                </div>
              ) : null}
            </div>
          </section>

          {page.seoSection ? (
            <section className="pt-8 md:pt-12 pb-16 bg-muted/20 border-t">
              <div className="container rich-text rich-text--full">
                <h2
                  id={page.slug.replace(/[^a-z0-9-]/gi, '-')}
                  className="text-2xl md:text-3xl font-bold font-heading tracking-tight mb-6"
                >
                  {page.seoSection.heading}
                </h2>
                {page.seoSection.body.map((block, index) => renderRichTextBlock(block, index))}
              </div>
            </section>
          ) : null}

          {page.relatedTopicsSection ? (
            <section className="pt-12 pb-16 border-t bg-background">
              <div className="container">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
                    {page.relatedTopicsSection.heading}
                  </h2>
                  {page.relatedTopicsSection.subheading ? (
                    <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                      {page.relatedTopicsSection.subheading}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {page.relatedTopicsSection.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex flex-col gap-2 rounded-2xl border bg-muted/20 p-6 transition-colors hover:bg-muted/40"
                    >
                      <span className="text-base font-semibold text-primary group-hover:underline">{link.label}</span>
                      {link.description ? (
                        <span className="text-sm text-muted-foreground">{link.description}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {page.faqSection ? (
            <section className="pt-12 md:pt-16 pb-20">
              <div className="container">
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">{page.faqSection.heading}</h2>
                  {page.faqSection.subheading ? (
                    <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">{page.faqSection.subheading}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  {page.faqSection.items.map((item) => (
                    <div key={item.question} className="bg-background rounded-2xl border p-6 shadow-sm">
                      <h3 className="text-lg font-semibold">{item.question}</h3>
                      <p className="mt-2 text-muted-foreground">{item.answer}</p>
                    </div>
                  ))}
                </div>
                {page.faqSection.cta ? (
                  <div className="text-center">
                    <CTAButton
                      cta={page.faqSection.cta}
                      onOpenAuth={() => setShowAuth(true)}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
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
              <Link href="/ai-flashcard-generator" className="text-xs text-muted-foreground/70 hover:underline">
                Flashcard Generator
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
    </>
  );
}
