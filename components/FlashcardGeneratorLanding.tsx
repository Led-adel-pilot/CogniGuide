'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { supabase } from '@/lib/supabaseClient';

// Keep the hero/above-the-fold structure identical to HomeLanding
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const EmbeddedFlashcards = dynamic(() => import('@/components/EmbeddedFlashcards'), {
  ssr: false,
  loading: () => <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />,
});

export default function FlashcardGeneratorLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [shouldRenderFlashcards, setShouldRenderFlashcards] = useState(false);
  const router = useRouter();
  const flashcardsSectionRef = useRef<HTMLDivElement | null>(null);

  // Referral code persistence (same behavior as HomeLanding)
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

  // Auth sync + lightweight cookie mirror (same behavior as HomeLanding)
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
      if (signedIn) setShowAuth(false);
      syncAuthCookie(signedIn);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  // Lazy render embedded flashcards when in view (perf for new domain Core Web Vitals)
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
        {/* Header (copied layout from HomeLanding to keep consistency) */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/ai-mind-map-generator" className="hidden text-sm text-primary font-medium hover:underline sm:inline">Mind Map Generator</Link>
              <Link href="/pricing" className="hidden text-sm text-muted-foreground hover:underline sm:inline">Pricing</Link>
              {isAuthed ? (
                <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-muted/50">Dashboard</button>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Try for Free</button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* Above the fold — same structure as HomeLanding */}
          <section className="relative pt-4 pb-16 md:pt-9 md:pb-20 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            <div className="container">
              <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
                <div className="w-full lg:w-[28rem] xl:w-[32rem]">
                  <div className="text-center lg:text-left">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading tracking-tighter md:leading-tight mb-4">
                      AI Flashcard Generator — Master More in Less Time
                    </h1>
                    <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                      Upload your PDFs, slides, images, or notes. CogniGuide instantly creates high‑quality Q&A cards and schedules reviews with spaced repetition (FSRS) so you remember more with less study time.
                    </p>
                    <div className="mt-6 flex justify-center lg:justify-start">
                      <div className="inline-flex flex-col items-center gap-1 sm:items-center">
                        <button onClick={() => setShowAuth(true)} className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 hover:shadow-primary/40 z-10 relative">
                          Try for Free
                        </button>
                        <p className="text-sm text-muted-foreground">No credit card required</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-[28rem]" ref={flashcardsSectionRef}>
                  <div className="bg-background rounded-[2rem] border shadow-xl shadow-slate-200/50 dark:shadow-slate-700/50 overflow-hidden">
                    <div className="w-full h-[65vh] md:h-[26rem] lg:h-[30rem]">
                      {shouldRenderFlashcards ? (
                        <EmbeddedFlashcards />
                      ) : (
                        <div className="w-full h-full animate-pulse bg-muted/40" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Value Props */}
          <section className="pt-10 md:pt-12 pb-12 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Why choose an AI flashcard maker?</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  Stop spending hours making cards by hand. CogniGuide turns your study material into clean, effective flashcards and optimises your review plan automatically with spaced repetition.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Save hours every week',
                    desc: 'Automatically extract key facts and definitions from PDFs, lecture slides, and images.'
                  },
                  {
                    title: 'Remember longer with FSRS',
                    desc: 'Our scheduler uses a proven spaced‑repetition algorithm to time reviews for maximum retention.'
                  },
                  {
                    title: 'Study anywhere',
                    desc: 'Open decks on desktop or mobile. Resume where you left off—your progress stays in sync.'
                  },
                ].map((f) => (
                  <div key={f.title} className="bg-background rounded-2xl border p-6 shadow-sm">
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-muted-foreground">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="pt-12 md:pt-16 pb-12">
            <div className="container px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">How to create flashcards with AI</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">Three simple steps from upload to study.</p>
              </div>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none">
                {[{
                  title: 'Upload your material',
                  desc: 'Add PDFs, DOCX, PPTX, images, or paste notes. We’ll parse and prepare the content.'
                }, {
                  title: 'Generate your deck',
                  desc: 'Our AI creates clean question–answer cards. Saving you hours of manual work.'
                }, {
                  title: 'Study with spaced repetition',
                  desc: 'Review on an FSRS schedule tuned to your exam date for deeper long‑term memory.'
                }].map((s, i) => (
                  <li key={i} className="bg-background rounded-2xl border p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold bg-background text-foreground">{i+1}</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                        <p className="text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="text-center mt-8">
                <Link href="/pricing" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">Get started free</Link>
              </div>
            </div>
          </section>

          {/* SEO text section targeting secondary variants */}
          <section className="pt-8 md:pt-12 pb-16 bg-muted/20 border-t">
            <div className="container prose prose-slate dark:prose-invert max-w-none">
              <h2 id="ai-flashcard-generator-keywords" className="text-2xl md:text-3xl font-bold font-heading tracking-tight mb-6">AI flashcard generator & maker: who is this for?</h2>
              <p className="mb-6">
                CogniGuide is an <strong>AI flashcard generator</strong> built for medical and nursing students, engineers, language learners, and busy professionals preparing for certifications. If you’ve been searching for an <em>AI flashcard maker</em> or a faster alternative to manual card creation, this page is for you.
              </p>
              <ul className="mb-6 space-y-2">
                <li><strong>Students:</strong> Turn dense lecture slides into concise Q–A cards.</li>
                <li><strong>Professionals:</strong> Prep for AWS, PMP, CFA and more—without hand‑typing every card.</li>
                <li><strong>Language learners:</strong> Build vocab decks from readings and images with text.</li>
              </ul>
              <p className="mb-0">
                Prefer visual first? Try our <Link href="/ai-mind-map-generator" className="underline">AI mind map generator</Link> and then convert nodes into flashcards.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="pt-12 md:pt-16 pb-20">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">AI flashcard generator FAQs</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">Everything you need to know before your first deck.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {[{
                  q: 'What is an AI flashcard generator?',
                  a: 'It is a tool that creates question–answer study cards from your documents and notes using large language models, then schedules reviews with spaced repetition.'
                }, {
                  q: 'Can I upload PDFs or slides?',
                  a: 'Yes. Upload PDFs, DOCX, PPTX, plain text, or images with text—CogniGuide will parse them and generate cards.'
                }, {
                  q: 'How does spaced repetition work here?',
                  a: 'We use an FSRS-based scheduler to predict the best time to review each card so you retain information longer with fewer sessions.'
                }, {
                  q: 'Is there a free plan?',
                  a: 'You can try CogniGuide free—no credit card required. Upgrade anytime for larger decks and faster generation.'
                }].map((item) => (
                  <div key={item.q} className="bg-background rounded-2xl border p-6 shadow-sm">
                    <h3 className="text-lg font-semibold">{item.q}</h3>
                    <p className="mt-2 text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <button onClick={() => setShowAuth(true)} className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">Generate my first deck</button>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t bg-muted/40">
          <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Link href="/ai-mind-map-generator" className="text-xs text-muted-foreground/70 hover:underline md:hidden">Mind Map Generator</Link>
              <Link href="/pricing" className="text-xs text-muted-foreground/70 hover:underline md:hidden">Pricing</Link>
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
