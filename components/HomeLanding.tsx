'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useCaseMenuHubs } from '@/lib/programmatic/useCaseMenuData';
import { broadcastAuthState, readSignedInFromCookies, writeCgAuthedCookie } from '@/lib/authCookie';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

const GeneratorWidget = dynamic(() => import('@/components/Generator'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-3xl border border-dashed border-muted/60 bg-muted/20">
      <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" aria-hidden="true" />
      <span className="sr-only">Loading generator…</span>
    </div>
  ),
});

const EmbeddedMindMap = dynamic(() => import('@/components/EmbeddedMindMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

const EmbeddedFlashcards = dynamic(() => import('@/components/EmbeddedFlashcards'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

const InteractiveMindMap = () => {
  const markdownData = "# Benefits of Reading from Mind Maps 🧠\n- **Enhanced Comprehension** 📖\n  - Visual layout clarifies relationships between concepts\n  - See the big picture and details simultaneously\n- **Improved Memory Retention** 💾\n  - Colors, branches, and keywords engage more of the brain\n  - Information is chunked into manageable parts\n- **Faster Learning** 🚀\n  - Quickly grasp complex topics\n  - Information is presented in a concise and organized manner\n- **Boosts Creativity** ✨\n  - Radiant structure encourages associative thinking\n  - Sparks new ideas and connections\n- **Effective Revision** ✅\n  - Condenses large amounts of information into a single page\n  - Easy to review and recall key points\n- **Engaging and Fun** 🎉\n  - More appealing than linear notes\n  - Makes studying a more active process";

  return <EmbeddedMindMap markdown={markdownData} />;
};

export default function HomeLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [useCasesOpen, setUseCasesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [embeddedFlashcardHeight, setEmbeddedFlashcardHeight] = useState<number | null>(null);
  const router = useRouter();
  const useCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileUseCaseMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement | null>(null);
  const lastMeasuredFlashcardHeightRef = useRef<number>(0);
  const lastSyncedAuthRef = useRef<boolean | null>(null);

  const computeFlashcardBaseHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const width = window.innerWidth;
    if (width >= 768) {
      return 600; // md:h-[600px]
    }
    return Math.round(window.innerHeight * 0.68); // h-[68vh]
  }, []);

  const handleEmbeddedFlashcardHeight = useCallback(
    (height: number) => {
      if (!height || !Number.isFinite(height)) return;
      lastMeasuredFlashcardHeightRef.current = height;
      const baseHeight = computeFlashcardBaseHeight();
      const nextHeight = Math.max(height, baseHeight);
      setEmbeddedFlashcardHeight((prev) => {
        if (prev === null) return nextHeight;
        return Math.abs(prev - nextHeight) > 1 ? nextHeight : prev;
      });
    },
    [computeFlashcardBaseHeight]
  );

  useEffect(() => {
    const handleResize = () => {
      const baseHeight = computeFlashcardBaseHeight();
      const measured = lastMeasuredFlashcardHeightRef.current;
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
  }, [computeFlashcardBaseHeight]);

  useEffect(() => {
    if (isAuthed) {
      setShowAuth(false);
    }
  }, [isAuthed]);

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
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading tracking-tighter md:leading-tight mb-4">
                      Learn Faster. Remember More. Ace Your Exams.
                    </h1>
                    <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                      Upload your PDFs, slides, or documents. Our AI creates clear mind maps and smart, spaced-repetition flashcards to help you learn 2x faster and ace your next test.
                    </p>
                    <div className="mt-6 flex justify-center lg:justify-start">
                      <div className="inline-flex flex-col items-center gap-1 sm:items-center">
                        <button
                          onClick={() => setShowAuth(true)}
                          className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 hover:shadow-primary/40 z-10 relative"
                        >
                          Try for Free
                        </button>
                        <p className="text-sm text-muted-foreground">No credit card required</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-[28rem]">
                  <GeneratorWidget redirectOnAuth showTitle={false} />
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10 md:pt-12 pb-16 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Visual Learning with Mind Maps</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  Mind maps reduce cognitive load by organizing information visually, making complex topics easier to understand and remember.
                </p>
              </div>
              <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                <div className="w-full h-[300px] md:h-[600px]">
                  <InteractiveMindMap />
                </div>
              </div>
            </div>
          </section>

          <section className="pt-16 md:pt-20 pb-16">
            <div className="container">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Active Recall with Spaced Repetition</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  Flashcards powered by spaced repetition help you retain information longer through active recall and scientifically-optimized review schedules.
                </p>
              </div>
              <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                <div
                  className="w-full h-[68vh] md:h-[600px]"
                  style={embeddedFlashcardHeight ? { height: `${embeddedFlashcardHeight}px` } : undefined}
                >
                  <EmbeddedFlashcards onHeightChange={handleEmbeddedFlashcardHeight} />
                </div>
              </div>
              <div className="text-center mt-12">
                <p className="text-muted-foreground mb-1">Our users have already generated countless study materials.</p>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-primary">800+</span> mind maps & flashcards generated this week.
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t bg-muted/40">
          <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Link
                href="/pricing"
                className="text-xs text-muted-foreground/70 hover:underline md:hidden"
              >
                Pricing
              </Link>
              <Link
                href="/ai-mind-map-generator"
                className="text-xs text-muted-foreground/70 hover:underline"
              >
                Mind Map Generator
              </Link>
              <Link href="/contact" className="text-xs text-muted-foreground/70 hover:underline">Contact</Link>
              <Link href="/legal/refund-policy" className="text-xs text-muted-foreground/70 hover:underline">Refund Policy</Link>
              <Link href="/legal/cancellation-policy" className="text-xs text-muted-foreground/70 hover:underline">Cancellation Policy</Link>
              <Link href="/legal/terms" className="text-xs text-muted-foreground/70 hover:underline">Terms of Service</Link>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
