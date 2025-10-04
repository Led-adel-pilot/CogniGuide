'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { supabase } from '@/lib/supabaseClient';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

const EmbeddedMindMap = dynamic(() => import('@/components/EmbeddedMindMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

const EmbeddedFlashcards = dynamic(() => import('@/components/EmbeddedFlashcards'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

const Generator = dynamic(() => import('@/components/Generator'), {
  ssr: false,
  loading: () => null,
});

const InteractiveMindMap = () => {
  const markdownData = "# Benefits of Reading from Mind Maps 🧠\n- **Enhanced Comprehension** 📖\n  - Visual layout clarifies relationships between concepts\n  - See the big picture and details simultaneously\n- **Improved Memory Retention** 💾\n  - Colors, branches, and keywords engage more of the brain\n  - Information is chunked into manageable parts\n- **Faster Learning** 🚀\n  - Quickly grasp complex topics\n  - Information is presented in a concise and organized manner\n- **Boosts Creativity** ✨\n  - Radiant structure encourages associative thinking\n  - Sparks new ideas and connections\n- **Effective Revision** ✅\n  - Condenses large amounts of information into a single page\n  - Easy to review and recall key points\n- **Engaging and Fun** 🎉\n  - More appealing than linear notes\n  - Makes studying a more active process";

  return <EmbeddedMindMap markdown={markdownData} />;
};

export default function HomeLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [shouldRenderGenerator, setShouldRenderGenerator] = useState(false);
  const [shouldRenderMindMap, setShouldRenderMindMap] = useState(false);
  const [shouldRenderFlashcards, setShouldRenderFlashcards] = useState(false);
  const router = useRouter();
  const mindMapSectionRef = useRef<HTMLDivElement | null>(null);
  const flashcardsSectionRef = useRef<HTMLDivElement | null>(null);

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
    const syncAuthCookie = (signedIn: boolean) => {
      try {
        if (typeof document !== 'undefined') {
          if (signedIn) {
            document.cookie = 'cg_authed=1; Path=/; Max-Age=2592000; SameSite=Lax; Secure';
          } else {
            document.cookie = 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
          }
        }
      } catch {}
    };
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
      syncAuthCookie(authed);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      if (signedIn) {
        setShowAuth(false);
      }
      syncAuthCookie(signedIn);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (shouldRenderGenerator) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let hasTriggered = false;

    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;
    let rafHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof window.setTimeout> | null = null;

    const cancelIdleCallbacks = () => {
      if (idleHandle !== null && win.cancelIdleCallback) {
        win.cancelIdleCallback(idleHandle);
      }
      if (rafHandle !== null) {
        window.cancelAnimationFrame(rafHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      idleHandle = null;
      rafHandle = null;
      timeoutHandle = null;
    };

    const handleUserInput = () => {
      void loadGenerator();
    };

    const removeUserInputListeners = () => {
      window.removeEventListener('pointerdown', handleUserInput);
      window.removeEventListener('keydown', handleUserInput);
    };

    async function loadGenerator() {
      if (hasTriggered) return;
      hasTriggered = true;
      cancelIdleCallbacks();
      removeUserInputListeners();

      try {
        await import('@/components/Generator');
        if (!cancelled) {
          setShouldRenderGenerator(true);
        }
      } catch (error) {
        hasTriggered = false;
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to load generator', error);
        }

        if (!cancelled) {
          window.addEventListener('pointerdown', handleUserInput, { passive: true });
          window.addEventListener('keydown', handleUserInput);

          if (win.requestIdleCallback) {
            idleHandle = win.requestIdleCallback(
              () => {
                void loadGenerator();
              },
              { timeout: 600 }
            );
          } else {
            rafHandle = window.requestAnimationFrame(() => {
              timeoutHandle = setTimeout(() => {
                void loadGenerator();
              }, 120);
            });
          }
        }
      }
    }

    window.addEventListener('pointerdown', handleUserInput, { passive: true });
    window.addEventListener('keydown', handleUserInput);

    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(
        () => {
          void loadGenerator();
        },
        { timeout: 600 }
      );
    } else {
      rafHandle = window.requestAnimationFrame(() => {
        timeoutHandle = setTimeout(() => {
          void loadGenerator();
        }, 120);
      });
    }

    return () => {
      cancelled = true;
      removeUserInputListeners();
      cancelIdleCallbacks();
    };
  }, [shouldRenderGenerator]);

  useEffect(() => {
    if (shouldRenderMindMap) return;

    const node = mindMapSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRenderMindMap(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px 0px 200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRenderMindMap]);

  useEffect(() => {
    if (shouldRenderFlashcards) return;

    const node = flashcardsSectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRenderFlashcards(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px 0px 200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRenderFlashcards]);

  return (
    <>
      <AuthModal open={showAuth} />
      <div className="flex flex-col min-h-screen font-sans bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/ai-mind-map-generator"
                className="hidden text-sm text-primary font-medium hover:underline sm:inline"
              >
                Mind Map Generator
              </Link>
              <Link
                href="/pricing"
                className="hidden text-sm text-muted-foreground hover:underline sm:inline"
              >
                Pricing
              </Link>
              {isAuthed ? (
                <>
                  <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-muted/50">Dashboard</button>
                </>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Try for Free</button>
              )}
            </div>
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
                  {shouldRenderGenerator ? <Generator redirectOnAuth showTitle={false} /> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10 md:pt-12 pb-16 bg-muted/30 border-y" ref={mindMapSectionRef}>
            <div className="container">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Visual Learning with Mind Maps</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  Mind maps reduce cognitive load by organizing information visually, making complex topics easier to understand and remember.
                </p>
              </div>
              <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                <div className="w-full h-[300px] md:h-[600px]">
                  {shouldRenderMindMap ? <InteractiveMindMap /> : <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-16 md:pt-20 pb-16" ref={flashcardsSectionRef}>
            <div className="container">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Active Recall with Spaced Repetition</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  Flashcards powered by spaced repetition help you retain information longer through active recall and scientifically-optimized review schedules.
                </p>
              </div>
              <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                <div className="w-full h-[68vh] md:h-[600px]">
                  {shouldRenderFlashcards ? (
                    <EmbeddedFlashcards />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />
                  )}
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
                href="/ai-mind-map-generator"
                className="text-xs text-muted-foreground/70 hover:underline md:hidden"
              >
                Mind Map Generator
              </Link>
              <Link
                href="/pricing"
                className="text-xs text-muted-foreground/70 hover:underline md:hidden"
              >
                Pricing
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
