'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ProgrammaticCTA, ProgrammaticFlashcardPage, RichTextBlock } from '@/lib/programmatic/flashcardPageSchema';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { supabase } from '@/lib/supabaseClient';

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
  const [shouldRenderFlashcards, setShouldRenderFlashcards] = useState(false);
  const router = useRouter();
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
      if (signedIn) setShowAuth(false);
      syncAuthCookie(signedIn);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

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
              <Link href="/pricing" className="hidden text-sm text-muted-foreground hover:underline sm:inline">
                Pricing
              </Link>
              {isAuthed ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-sm rounded-full border hover:bg-muted/50"
                >
                  Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Try for Free
                </button>
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
                    {page.hero.eyebrow ? (
                      <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">{page.hero.eyebrow}</p>
                    ) : null}
                    <h1
                      className="font-bold font-heading tracking-tighter md:leading-tight mb-4"
                      style={{ fontSize: '3rem' } as React.CSSProperties}
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
                          className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-3.5 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 hover:shadow-primary/40 z-10 relative"
                        />
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
              <div className="container prose prose-slate dark:prose-invert max-w-none">
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
