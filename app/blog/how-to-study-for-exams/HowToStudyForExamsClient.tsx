'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CogniGuideLogo from '@/CogniGuide_logo.png';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';
import { broadcastAuthState, readSignedInFromCookies, writeCgAuthedCookie } from '@/lib/authCookie';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

const UPDATED_AT = 'September 25, 2024';
const READING_TIME = '12 minute read';

const SectionHeading = ({
  number,
  children,
  className = 'mt-8 mb-4',
}: {
  number: string;
  children: ReactNode;
  className?: string;
}) => (
  <h2 className={`scroll-m-20 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl ${className}`}>
    <span className="mr-3 text-xl font-medium text-muted-foreground sm:text-2xl">{number}.</span>
    {children}
  </h2>
);

const HighlightCard = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) => {
  const toneStyles =
    tone === 'accent'
      ? 'border border-dashed border-primary/60 bg-primary/5'
      : 'border border-border/70 bg-muted/30';

  return (
    <div className={`mt-6 rounded-2xl p-6 shadow-sm backdrop-blur-sm ${toneStyles}`}>
      <p className="!m-0 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
};

export default function HowToStudyForExamsClient() {
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
    } catch {
      // Ignore storage failures.
    }
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
      <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="relative flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3 md:gap-6">
              <button
                type="button"
                ref={mobileMenuToggleRef}
                className="inline-flex items-center justify-center rounded-full border border-transparent p-2 text-sm text-foreground transition hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
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
                <span className="font-heading text-lg font-bold tracking-tighter md:text-2xl">CogniGuide</span>
              </div>
              <div className="hidden items-center gap-4 md:flex">
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
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Featured hubs
                      </div>
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
                <Link href="/pricing" className="text-sm text-muted-foreground hover:underline">
                  Pricing
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isAuthed ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="rounded-full border px-4 py-2 text-sm transition hover:bg-muted/50"
                >
                  Dashboard
                </button>
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Try for Free
                </button>
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
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-expanded={useCasesOpen}
                      aria-haspopup="true"
                    >
                      <span>Use-cases</span>
                      <span aria-hidden="true" className="text-xs text-muted-foreground">
                        {useCasesOpen ? '▴' : '▾'}
                      </span>
                    </button>
                    {useCasesOpen ? (
                      <div className="mt-2 space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow">
                        <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Featured hubs
                        </div>
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
          <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-0">
            <header className="mb-12 space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Study Skills</p>
              <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
                How to Study for Exams and Actually Remember What You Learned
              </h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>By the CogniGuide Editorial Team</span>
                <span>Updated {UPDATED_AT}</span>
                <span>{READING_TIME}</span>
              </div>
              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Exam weeks rarely arrive quietly. Notes pile up, deadlines press in, and the temptation to cram grows louder by
                the hour. The students who thrive do something different—they build repeatable habits that keep their knowledge
                fresh. These seven techniques can help you do the same, no marathon study session required.
              </p>
            </header>

            <div className="rich-text rich-text--lg rich-text--full">
              <blockquote>
                <p>
                  Studying is a craft. The more intentionally you design your process, the more your brain rewards you with
                  lasting memories.
                </p>
              </blockquote>

              <SectionHeading number="1">Start with a study game plan</SectionHeading>
              <p>
                Before touching your notes, take ten minutes to map the terrain. List the topics you expect to see, the formats
                you will encounter (multiple choice, essays, problem sets), and how confident you feel about each one. A quick
                plan keeps you from spending hours polishing what you already know while ignoring the material that still feels
                shaky.
              </p>
              <HighlightCard>
                <span className="font-semibold text-foreground">Try this:</span> Open a blank document and split it into three
                columns—topics, confidence, and next action. Revisit the list at the end of each day to mark progress and adjust
                priorities.
              </HighlightCard>

              <SectionHeading number="2">Lean on active recall instead of rereading</SectionHeading>
              <p>
                Rereading notes feels productive because it is familiar. Active recall, on the other hand, asks you to close the
                book and bring an answer forward from memory. The tiny moment of discomfort when you cannot remember something is
                the signal that the material matters.
              </p>
              <HighlightCard tone="accent">
                Keep a running question bank for each class. At the end of a study block, write three questions you could not
                answer immediately. Quiz yourself the next day, then again two days later. You will track your weak spots without
                rereading the same paragraph four times.
              </HighlightCard>

              <SectionHeading number="3">Build spaced repetition into your week</SectionHeading>
              <p>
                Spaced repetition fights the forgetting curve by scheduling encounters with difficult ideas just before your brain
                wants to let them go. Instead of waiting until a chapter fades completely, you revisit it quickly and keep the
                neurons firing together. Over time, the gaps between reviews can stretch longer because the material is sticking.
              </p>
              <p>
                Decide how many review sessions you can realistically complete this week. Then, on your calendar, schedule a
                10-minute revisit session for the material you studied today. Repeat this a few times for the same topic, adding a
                day or two between sessions. The goal is to meet the concept again before it slips away.
              </p>
              <HighlightCard>
                Pair spaced repetition with a checklist: include the date, topic, and any quick metrics (score on a self-quiz,
                a flashcard deck mastered, or a short written summary). Watching the chain of reviews grow keeps you accountable.
              </HighlightCard>

              <SectionHeading number="4">Chunk big topics into mini-milestones</SectionHeading>
              <p>
                Huge topics, like “Chapter 12: Thermodynamics,” feel unmanageable because the finish line is fuzzy. Break that
                chapter into mini-milestones—maybe each key formula, lab method, or vocabulary set becomes its own checklist item.
                Those micro-goals are easier to start and motivate you to keep going once you have finished one.
              </p>
              <p>
                This approach shines when you are tired or short on time. Ten minutes of focused effort on a single chunk is still
                progress. Cramming without structure rarely is.
              </p>

              <SectionHeading number="5">Switch study modes to keep energy up</SectionHeading>
              <p>
                Sticking with one study method for hours is a recipe for tuned-out eyes and little retention. Rotate through
                active recall, diagrams, explaining a concept out loud, and tightening up your notes. Each shift wakes up another
                part of your brain and reveals gaps you might have missed.
              </p>
              <HighlightCard tone="accent">
                The next time you feel yourself fading, switch media. If you are reading, sketch the concept on paper. If you are
                writing, record a two-minute voice memo summarizing the main idea. Later, listen back and check if you could still
                explain it clearly.
              </HighlightCard>

              <SectionHeading number="6">Use accountability and collaboration wisely</SectionHeading>
              <p>
                Study groups can keep you moving—when they are focused. Set a clear agenda and time limits for each topic. Rotate
                who leads each segment so everyone shows up prepared. When you teach or answer a question aloud, you discover
                whether you truly understand it.
              </p>
              <p>
                Accountability is not only about group work. A quick text to a friend at the start and end of a study block can be
                enough to keep you honest. Record what you plan to finish and what actually happened.
              </p>

              <SectionHeading number="7">Protect your recovery time</SectionHeading>
              <p>
                Sleep is not negotiable when you want to remember anything. Memory consolidation happens at night, and without it,
                your study blocks are just warm-up laps. Aim for consistent bedtimes the week before an exam, protect the hour
                before sleep from screens, and set a short review for the morning while your brain is fresh.
              </p>
              <HighlightCard>
                Ending the evening with a short, handwritten summary of the key ideas you covered that day locks them in place and
                gives your brain a clean slate for tomorrow.
              </HighlightCard>

              <SectionHeading number="8" className="mt-12 mb-6">
                Quick answers to common study questions
              </SectionHeading>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                    <span>How do I stay focused when studying?</span>
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Treat your study time like an appointment. Set a timer for 25–40 minutes, silence unnecessary notifications,
                      and commit to a single task. When distractions pop up, jot them down on a capture list and return once the
                      timer ends.
                    </p>
                  </div>
                </details>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                    <span>What is the 2-3-5-7 study method?</span>
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      It is a spaced repetition schedule that prompts you to review material seven, five, three, and two days
                      before a big assessment. The decreasing intervals keep topics active just before you need them most.
                    </p>
                  </div>
                </details>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                    <span>How many hours should I study each day?</span>
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Quality matters more than raw hours. Many college students aim for two to three hours of focused study per
                      credit hour each week, but the right number depends on the difficulty of the course and how efficiently you
                      can stay engaged during each block.
                    </p>
                  </div>
                </details>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                    <span>How do I study without forgetting everything later?</span>
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Pair spaced repetition with active recall. Review a topic before it slips away, test yourself without notes,
                      and protect your sleep—memory consolidation happens overnight, not during the final cram session.
                    </p>
                  </div>
                </details>
              </div>
            </div>

            <section className="mt-16 rounded-3xl border border-border bg-muted/40 p-10">
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Keep your momentum going</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Studying well is rarely about a single dramatic shift. It is the combination of small, repeatable systems—recall
                prompts, spaced reviews, tidy notes, and focused time—that make exam week feel manageable. CogniGuide was built to
                support that routine by turning your documents into flashcards, maps, and review plans with just a few clicks.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                When you are ready to lighten the administrative load of studying, keep your focus on learning—not logistics.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  Explore CogniGuide
                </Link>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://goodaitools.com"
                  className="inline-flex justify-center"
                >
                  <img src="https://goodaitools.com/assets/images/badge.png" alt="Good AI Tools" height="54" />
                </a>
              </div>
            </section>
          </article>
        </main>

        <footer className="border-t bg-muted/40">
          <div className="container flex flex-col items-center justify-between gap-2 py-3 md:flex-row">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Link href="/pricing" className="text-xs text-muted-foreground/70 hover:underline md:hidden">
                Pricing
              </Link>
              <Link href="/ai-mind-map-generator" className="text-xs text-muted-foreground/70 hover:underline">
                Mind Map Generator
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
