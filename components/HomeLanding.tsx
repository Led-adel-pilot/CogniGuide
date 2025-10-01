'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Generator from '@/components/Generator';
import Link from 'next/link';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import EmbeddedMindMap from '@/components/EmbeddedMindMap';
import EmbeddedFlashcards from '@/components/EmbeddedFlashcards';
import Script from 'next/script';

const InteractiveMindMap = () => {
  const markdownData = "# Benefits of Reading from Mind Maps 🧠\n- **Enhanced Comprehension** 📖\n  - Visual layout clarifies relationships between concepts\n  - See the big picture and details simultaneously\n- **Improved Memory Retention** 💾\n  - Colors, branches, and keywords engage more of the brain\n  - Information is chunked into manageable parts\n- **Faster Learning** 🚀\n  - Quickly grasp complex topics\n  - Information is presented in a concise and organized manner\n- **Boosts Creativity** ✨\n  - Radiant structure encourages associative thinking\n  - Sparks new ideas and connections\n- **Effective Revision** ✅\n  - Condenses large amounts of information into a single page\n  - Easy to review and recall key points\n- **Engaging and Fun** 🎉\n  - More appealing than linear notes\n  - Makes studying a more active process";

  return <EmbeddedMindMap markdown={markdownData} />;
};

export default function HomeLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();

  const faqJsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is CogniGuide?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'CogniGuide is an AI-powered study assistant that converts PDFs, slides, and lecture notes into interactive mind maps and spaced-repetition flashcards so you can learn faster and retain more.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does CogniGuide improve exam prep?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'CogniGuide applies evidence-backed learning techniques including active recall, spaced repetition, and visual organization to help students review complex topics efficiently and feel confident going into exams.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which file types can I upload to CogniGuide?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'You can upload PDF, DOCX, PPTX, and common image files. Our AI extracts the key ideas from each document and turns them into bite-sized study guides.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is CogniGuide suitable for teams or classrooms?',
          acceptedAnswer: {
            '@type': 'Answer',
            text:
              'Yes. Study groups, tutors, and classrooms use CogniGuide to align on the same learning materials, generate revision resources instantly, and share interactive decks with students anywhere.',
          },
        },
      ],
    }),
    []
  );

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

  return (
    <>
      <Script
        id="faq-structured-data"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <AuthModal open={showAuth} />
      <div className="flex flex-col min-h-screen font-sans bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:underline">Pricing</Link>
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
                      Learn Faster with AI-Powered Study Guides.
                    </h1>
                    <p className="mt-6 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                      Upload your PDFs, slides, or lecture notes and CogniGuide instantly creates SEO-friendly mind maps and smart, spaced-repetition flashcards that help students, teachers, and knowledge workers learn faster and ace the next exam.
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

                <div className="flex-1 w-full">
                  <Generator redirectOnAuth showTitle={false} />
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
                <div className="w-full h-[68vh] md:h-[600px]">
                  <EmbeddedFlashcards />
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

          <section className="py-16 bg-muted/30 border-t">
            <div className="container">
              <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
                    AI Study Tools Designed for High-Impact Learning
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    CogniGuide combines proven learning science with search-friendly content structuring. Each study guide is designed to rank for the academic keywords you research most and includes:
                  </p>
                  <ul className="mt-6 space-y-4 text-left">
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      <div>
                        <h3 className="font-semibold text-lg">Keyword-Optimized Mind Maps</h3>
                        <p className="text-muted-foreground">
                          Turn dense textbook chapters into SEO-friendly outlines that mirror how students search for help on Google.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      <div>
                        <h3 className="font-semibold text-lg">Smart Flashcard Scheduling</h3>
                        <p className="text-muted-foreground">
                          Automatically surface critical facts using adaptive spaced repetition tuned to your mastery level.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      <div>
                        <h3 className="font-semibold text-lg">Collaboration &amp; Sharing</h3>
                        <p className="text-muted-foreground">
                          Invite classmates or coaching clients to collaborate on study decks and embed resources in your LMS or website.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="rounded-3xl border bg-background p-6 shadow-lg">
                  <h3 className="text-2xl font-semibold font-heading tracking-tight">Why Students Trust CogniGuide</h3>
                  <p className="mt-4 text-muted-foreground">
                    We built CogniGuide alongside university students, medical residents, and certification seekers. The result is a study assistant that reduces prep time by hours each week while improving exam scores.
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">1</span>
                      Upload any PDF, DOCX, PPTX, or image file.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">2</span>
                      Our AI organizes the content into mind maps and flashcards.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">3</span>
                      Review with science-backed spaced repetition anywhere.
                    </li>
                  </ul>
                  <p className="mt-6 text-sm text-muted-foreground">
                    Trusted by learners preparing for MCAT, NCLEX, bar exams, product certifications, and high school finals alike.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="py-16">
            <div className="container">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">
                  How CogniGuide Helps You Rank and Retain Knowledge
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Whether you are building a knowledge hub or preparing for finals, CogniGuide keeps your study materials structured for search engines and optimized for human recall. Follow these steps to turn insights into outcomes:
                </p>
              </div>
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {[
                  {
                    title: 'Upload rich study materials',
                    description:
                      'Import lecture notes, syllabi, and textbooks so our AI can extract headings, key terms, and supporting details.',
                  },
                  {
                    title: 'Generate optimized mind maps',
                    description:
                      'Instantly visualize the hierarchy of concepts to match how learners search and how educators teach.',
                  },
                  {
                    title: 'Master with spaced flashcards',
                    description:
                      'Stay on track with reminders and mastery scores, whether you are studying daily or binge-reviewing before exams.',
                  },
                ].map((step) => (
                  <div key={step.title} className="rounded-3xl border bg-background p-6 text-left shadow-md">
                    <h3 className="text-xl font-semibold font-heading tracking-tight">{step.title}</h3>
                    <p className="mt-3 text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="py-16 bg-muted/30 border-t">
            <div className="container">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Frequently Asked Questions</h2>
                <p className="mt-4 text-muted-foreground">
                  Learn how CogniGuide uses AI, spaced repetition, and visual mapping to give you a competitive edge on exams and certification prep.
                </p>
              </div>
              <div className="mt-12 grid gap-6 md:grid-cols-2">
                {[
                  {
                    question: 'Can CogniGuide help with SEO for educational content?',
                    answer:
                      'Absolutely. CogniGuide structures your study guides with clear headings, summaries, and keywords so they are more discoverable on Google and easier for learners to navigate.',
                  },
                  {
                    question: 'Does CogniGuide support collaborative learning?',
                    answer:
                      'Yes, share mind maps and flashcards with classmates or clients, embed them in course portals, and keep everyone aligned with the latest updates.',
                  },
                  {
                    question: 'What makes CogniGuide different from traditional flashcard apps?',
                    answer:
                      'CogniGuide automatically converts dense documents into visual mind maps and dynamic flashcards powered by the FSRS spaced repetition algorithm.',
                  },
                  {
                    question: 'Is my data secure?',
                    answer:
                      'We encrypt your files, follow strict access controls, and allow you to delete uploads at any time for complete peace of mind.',
                  },
                ].map((item) => (
                  <div key={item.question} className="rounded-3xl border bg-background p-6 text-left shadow-md">
                    <h3 className="text-lg font-semibold font-heading tracking-tight">{item.question}</h3>
                    <p className="mt-3 text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t bg-muted/40">
          <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              {/* <Link href="/pricing" className="text-sm text-muted-foreground hover:underline">Pricing</Link> */}
              {/* Maybe reducing user signup conversion, to be researched */}
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
