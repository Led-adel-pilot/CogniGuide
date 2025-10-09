'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Generator from '@/components/Generator';
import AuthModal from '@/components/AuthModal';
import EmbeddedMindMap from '@/components/EmbeddedMindMap';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { supabase } from '@/lib/supabaseClient';
import { mindMapGeneratorFaqs } from '@/lib/data/mindMapGeneratorFaqs';

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
  const router = useRouter();

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

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      if (signedIn) {
        setShowAuth(false);
      }
      syncAuthCookie(signedIn);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthModal open={showAuth} />

      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2">
            <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
            <Link href="/" className="text-2xl font-bold font-heading tracking-tighter">
              CogniGuide
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="hidden text-sm text-muted-foreground hover:underline sm:inline">
              Pricing
            </Link>
            {isAuthed ? (
              <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-muted/50">
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Try for Free
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden pt-6 pb-16 md:pt-12 md:pb-24">
          <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" aria-hidden="true" />
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
                <Generator redirectOnAuth showTitle={false} />
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
            <Link
              href="/ai-flashcard-generator"
              className="text-xs text-muted-foreground/70 hover:underline"
            >
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
  );
}
