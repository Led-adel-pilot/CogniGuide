'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ProgrammaticCTA, ProgrammaticMindMapPage, RichTextBlock } from '@/lib/programmatic/mindMapPageSchema';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useCaseMenuHubs } from '@/lib/programmatic/useCaseMenuData';
import { broadcastAuthState, readSignedInFromCookies, writeCgAuthedCookie } from '@/lib/authCookie';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const MindMapLoading = () => (
  <div className="relative w-full h-full bg-background">
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
      <div
        className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"
        role="status"
        aria-label="Loading mind map"
      />
    </div>
  </div>
);
const EmbeddedMindMap = dynamic(() => import('@/components/EmbeddedMindMap'), {
  ssr: false,
  loading: MindMapLoading,
});

const HERO_PREVIEW_HEADING = 'AI Generated Preview';
const DEFAULT_MINDMAP_PREVIEW_MARKDOWN =
  '# Benefits of Reading from Mind Maps 🧠\n- **Enhanced Comprehension** 📖\n  - Visual layout clarifies relationships between concepts\n  - See the big picture and details simultaneously\n- **Improved Memory Retention** 💾\n  - Colors, branches, and keywords engage more of the brain\n  - Information is chunked into manageable parts\n- **Faster Learning** 🚀\n  - Quickly grasp complex topics\n  - Information is presented in a concise and organized manner\n- **Boosts Creativity** ✨\n  - Radiant structure encourages associative thinking\n  - Sparks new ideas and connections\n- **Effective Revision** ✅\n  - Condenses large amounts of information into a single page\n  - Easy to review and recall key points\n- **Engaging and Fun** 🎉\n  - More appealing than linear notes\n  - Makes studying a more active process';

type MindMapProgrammaticLandingProps = {
  page: ProgrammaticMindMapPage;
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

export default function MindMapProgrammaticLanding({ page }: MindMapProgrammaticLandingProps) {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const lastSyncedAuthRef = useRef<boolean | null>(null);
  const useCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUseCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null);

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

  const mindMapPreviewMarkdown = useMemo(() => {
    const markdown = page.embeddedMindMap?.markdown?.trim();
    if (!markdown) {
      return null;
    }

    return markdown;
  }, [page.embeddedMindMap]);

  const heroMindMapMarkdown = mindMapPreviewMarkdown ?? DEFAULT_MINDMAP_PREVIEW_MARKDOWN;

  const hasHeroSubheading = Boolean(page.hero.subheading?.trim());

  const heroTypography = useMemo(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const normalize = (value: number, lower: number, upper: number) => {
      if (upper <= lower) return 0;
      return clamp((upper - value) / (upper - lower), 0, 1);
    };

    const headingText = page.hero.heading.trim();
    const subheadingText = hasHeroSubheading ? page.hero.subheading!.trim() : '';

    const headingChars = headingText.length;
    const headingWords = headingText.split(/\s+/u).filter(Boolean).length || 1;
    const headingDensity = headingChars / Math.max(headingWords, 1);
    const headingCharRatio = normalize(headingChars, 30, 120);
    const headingWordRatio = normalize(headingWords, 6, 18);
    const headingBlend = headingCharRatio * 0.6 + headingWordRatio * 0.4;

    let desktopHeadingRem = 1.98 + headingBlend * 0.38;
    const densityPenalty = clamp((headingDensity - 5.3) / 3.2, 0, 0.22);
    desktopHeadingRem = clamp(desktopHeadingRem - densityPenalty * 0.82, 1.9, 2.36);
    const mobileHeadingRem = clamp(desktopHeadingRem - 0.24, 1.72, 2.0);

    const headingLineEstimate = clamp(headingChars / 22, 1.1, 3.6);
    const headingLineHeight =
      headingLineEstimate <= 1.6 ? 1.1 : headingLineEstimate <= 2.3 ? 1.16 : headingLineEstimate <= 3 ? 1.2 : 1.24;
    const headingMarginBottomRem = clamp(0.68 + (headingLineEstimate - 1.5) * 0.12, 0.64, 1.02);
    const headingMaxWidth = `${(27.5 - headingBlend * 6.2).toFixed(2)}ch`;

    const scaledDesktopHeadingRem = clamp(desktopHeadingRem * 1.6, 2.4, 3.9);
    const scaledMobileHeadingRem = clamp(mobileHeadingRem * 1.6, 2.1, 3.2);
    const scaledHeadingLineHeight = Number(Math.max(1.08, headingLineHeight - 0.06).toFixed(3));
    const scaledHeadingMarginBottom = `${clamp(headingMarginBottomRem * 1.05, 0.74, 1.18).toFixed(3)}rem`;

    const subheadingChars = subheadingText.length;
    const subheadingWords = subheadingText.split(/\s+/u).filter(Boolean).length || 1;
    const hasSubheading = hasHeroSubheading;

    let subheadingTypography:
      | {
          mobileSize: string;
          desktopSize: string;
          lineHeight: number;
          marginTop: string;
          maxWidth: string;
          ctaSpacing: number;
        }
      | null = null;

    if (hasSubheading) {
      const subCharRatio = normalize(subheadingChars, 110, 320);
      const subWordRatio = normalize(subheadingWords, 18, 60);
      const subBlend = subCharRatio * 0.55 + subWordRatio * 0.45;

      const subheadingDesktopRem = clamp(1.05 + subBlend * 0.18, 1.03, 1.2);
      const subheadingMobileRem = clamp(subheadingDesktopRem - 0.14, 0.92, 1.06);
      const subheadingLineHeight = Number((1.48 + (1 - subBlend) * 0.16).toFixed(3));
      const subheadingMarginTopRem = clamp(0.74 + subBlend * 0.22, 0.72, 1.0);
      const subheadingMaxWidth = `${(36 + subBlend * 6).toFixed(2)}rem`;
      const subheadingLineEstimate = clamp(subheadingChars / 38, 1.4, 4.6);
      const ctaSpacing = clamp(1.24 + Math.max(0, subheadingLineEstimate - 2.1) * 0.12, 1.24, 1.84);

      // Make subheading ~20% bigger than current
      const scaledSubheadingDesktop = clamp(subheadingDesktopRem * 1.6 * 0.84, 1.32, 1.78);
      const scaledSubheadingMobile = clamp(subheadingMobileRem * 1.6 * 0.84, 1.1, 1.45);
      const scaledSubheadingLineHeight = Number(Math.max(1.44, subheadingLineHeight - 0.08).toFixed(3));
      const scaledSubheadingMarginTop = `${clamp(parseFloat(subheadingMarginTopRem.toFixed(3)) * 1.05, 0.78, 1.1).toFixed(
        3
      )}rem`;
      const scaledSubheadingMaxWidth = `${Math.max(36, parseFloat(subheadingMaxWidth) * 0.98).toFixed(2)}rem`;
      const scaledCtaSpacing = clamp(ctaSpacing * 1.02, 1.24, 1.9);

      subheadingTypography = {
        mobileSize: `${scaledSubheadingMobile.toFixed(3)}rem`,
        desktopSize: `${scaledSubheadingDesktop.toFixed(3)}rem`,
        lineHeight: scaledSubheadingLineHeight,
        marginTop: scaledSubheadingMarginTop,
        maxWidth: scaledSubheadingMaxWidth,
        ctaSpacing: scaledCtaSpacing,
      };
    }

    const baseCtaMargin = subheadingTypography ? subheadingTypography.ctaSpacing : 1.16 * 1.1;
    const headingInfluence = clamp(1.18 + (headingLineEstimate - 1.5) * 0.08, 1.14, 1.74) * 1.08;
    const ctaMarginTopRem = clamp(
      subheadingTypography ? Math.max(baseCtaMargin, headingInfluence) : 1.14 + (headingLineEstimate - 1.5) * 0.14,
      subheadingTypography ? 1.2 : 1.1,
      subheadingTypography ? 1.9 : 1.84
    );

    return {
      heading: {
        mobileSize: `${scaledMobileHeadingRem.toFixed(3)}rem`,
        desktopSize: `${scaledDesktopHeadingRem.toFixed(3)}rem`,
        lineHeight: scaledHeadingLineHeight,
        marginBottom: scaledHeadingMarginBottom,
        maxWidth: headingMaxWidth,
      },
      subheading: subheadingTypography
        ? {
            mobileSize: subheadingTypography.mobileSize,
            desktopSize: subheadingTypography.desktopSize,
            lineHeight: subheadingTypography.lineHeight,
            marginTop: subheadingTypography.marginTop,
            maxWidth: subheadingTypography.maxWidth,
          }
        : null,
      cta: {
        marginTop: `${ctaMarginTopRem.toFixed(3)}rem`,
      },
    };
  }, [hasHeroSubheading, page.hero.heading, page.hero.subheading]);

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
          <section className="relative pt-4 pb-16 md:pt-9 md:pb-20 overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-5 pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            <div className="container">
              <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                <div className="w-full lg:w-[28rem] xl:w-[32rem]">
                  <div className="text-center lg:text-left">
                    {page.hero.eyebrow ? (
                      <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">{page.hero.eyebrow}</p>
                    ) : null}
                    <h1
                      className="font-bold font-heading tracking-tighter md:text-[length:var(--hero-heading-desktop)]"
                      style={
                        {
                          fontSize: heroTypography.heading.mobileSize,
                          '--hero-heading-desktop': heroTypography.heading.desktopSize,
                          lineHeight: heroTypography.heading.lineHeight,
                          marginBottom: heroTypography.heading.marginBottom,
                          textWrap: 'balance',
                          maxWidth: heroTypography.heading.maxWidth,
                        } as CSSProperties
                      }
                    >
                      {page.hero.heading}
                    </h1>
                    {hasHeroSubheading ? (
                      <p
                        className="text-muted-foreground md:text-[length:var(--hero-subheading-desktop)] leading-relaxed mx-auto lg:mx-0"
                        style={
                          {
                            fontSize: heroTypography.subheading?.mobileSize ?? '1.28rem',
                            '--hero-subheading-desktop': heroTypography.subheading?.desktopSize ?? '1.58rem',
                            lineHeight: heroTypography.subheading?.lineHeight ?? 1.5,
                            marginTop: heroTypography.subheading?.marginTop ?? '0.94rem',
                            maxWidth: heroTypography.subheading?.maxWidth ?? '38rem',
                            textWrap: 'balance',
                          } as CSSProperties
                        }
                      >
                        {page.hero.subheading}
                      </p>
                    ) : null}
                    <div
                      className="flex justify-center lg:justify-start"
                      style={
                        {
                          marginTop: heroTypography.cta.marginTop,
                        } as CSSProperties
                      }
                    >
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
                  <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 h-full flex flex-col overflow-hidden">
                    <div className="px-6 pt-4 pb-4">
                      <p className="text-sm font-semibold text-muted-foreground/85">
                        {HERO_PREVIEW_HEADING}
                      </p>
                    </div>
                    <div className="w-full h-[60vh] min-h-[22rem] md:h-[26rem] lg:h-[30rem]">
                      <EmbeddedMindMap
                        markdown={heroMindMapMarkdown}
                        initialAutoFitScaleMultiplier={1.65}
                        initialAutoFitCenterBias={{ x: -0.05 }}
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
              <Link href="/mind-maps" className="text-xs text-muted-foreground/70 hover:underline">
                Mind Map Use Cases
              </Link>
              <Link href="/ai-flashcard-generator" className="text-xs text-muted-foreground/70 hover:underline">
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
    </>
  );
}
