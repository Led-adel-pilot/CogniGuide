'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Share2, UploadCloud } from 'lucide-react';
import Generator from '@/components/Generator';
import Link from 'next/link';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import EmbeddedMindMap from '@/components/EmbeddedMindMap';
import EmbeddedFlashcards from '@/components/EmbeddedFlashcards';

const InteractiveMindMap = () => {
  const markdownData = "# Immune System 🛡️\n- **Function 🎯**\n  - Protects organism from diseases\n  - Detects and responds to pathogens, cancer cells, foreign objects\n  - Distinguishes self from non-self\n- **Major Subsystems 🧬**\n  - Innate Immune System (Non-specific) 🛡️\n  - Adaptive Immune System (Specific) 🎯\n- **Dysfunctions 🤒**\n  - Immunodeficiency 📉: Less active immune system (e.g., HIV/AIDS, SCID)\n  - Autoimmunity 💥: Hyperactive system attacks normal tissues (e.g., Hashimoto's, Rheumatoid Arthritis, Type 1 Diabetes)\n  - Hypersensitivity 🤧: Immune response damages own tissues (e.g., allergies)\n  - Idiopathic Inflammation❓: Inflammation without known cause\n- **Modulation ⚙️**\n  - Immunosuppression 💊: Drugs to control autoimmunity, inflammation, transplant rejection\n  - Vaccination 💉: Induces active immunity, develops memory without disease\n  - Cancer Immunotherapy ♋: Stimulates immune system to attack tumors\n- **Physiological Regulation ⚖️**\n  - Hormones 🧬: Estrogen (immunostimulator), testosterone (immunosuppressive)\n  - Vitamin D ☀️: May reduce autoimmune disease risk\n  - Sleep and Rest 😴: Deprivation detrimental; deep sleep supports immune function\n  - Physical Exercise 🏃: Positive effect, transient immunodepression post-intense exercise\n- **Pathogen Evasion 🏃‍♂️**\n  - Hide within host cells\n  - Secrete immune-inhibiting compounds\n  - Antigenic variation (e.g., HIV)\n  - Masking antigens with host molecules";

  return <EmbeddedMindMap markdown={markdownData} />;
};


export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [view, setView] = useState('flashcards');
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      if (signedIn) {
        setShowAuth(false);
        router.push('/dashboard');
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router]);

  const handleScrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      <div className="flex flex-col min-h-screen font-sans bg-background text-foreground">
        
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:underline">Pricing</Link>
            </div>
            <div className="flex items-center gap-2">
              {isAuthed ? (
                <>
                  <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Dashboard</button>
                </>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">Sign up</button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative text-center py-20 md:py-32 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10"></div>
            <div className="container relative z-10">
              <h1 className="text-4xl md:text-6xl font-extrabold font-heading tracking-tighter mb-6 leading-tight">
                Turn Your Notes into Mind Maps & Flashcards with AI.
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Upload your PDFs, slides, or documents. Our AI creates clear mind maps and smart, spaced-repetition flashcards to help you learn faster.
              </p>
              <button
                onClick={handleScrollToGenerator}
                className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 text-base font-bold text-white bg-primary rounded-full shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 transition-transform group-hover:translate-y-1 animate-bounce"
                  aria-hidden="true"
                >
                  <path d="M7 10L12 15L17 10" />
                </svg>
                Start Generating - No signup
              </button>
            </div>
          </section>

          {/* Why Mind Maps Section */}
          <section className="pt-10 md:pt-12 pb-10 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">The Science of Smarter Learning</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">
                  CogniGuide combines research-backed methods: visual <span className="font-semibold">  mind maps</span> to reduce cognitive load, <span className="font-semibold">active recall</span> with flashcards and <span className="font-semibold">spaced repetition</span> to secure long-term memory.
                </p>
              </div>
              <div className="relative">
                <div className="flex justify-center mb-4">
                  <div className="inline-flex p-1 rounded-full border bg-muted/50">
                    <button
                      onClick={() => setView('mindmap')}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${view === 'mindmap' ? 'bg-white text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                    >
                      Mind Map
                    </button>
                    <button
                      onClick={() => setView('flashcards')}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${view === 'flashcards' ? 'bg-white text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                    >
                      Flashcards
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-[2rem] border shadow-xl shadow-slate-200/50 overflow-hidden">
                  <div className={`w-full ${view === 'mindmap' ? 'h-[500px] md:h-[600px]' : 'h-[68vh] md:h-[600px]'}`}>
                    {view === 'mindmap' ? <InteractiveMindMap /> : <EmbeddedFlashcards />}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Generator redirectOnAuth />



        </main>

        <footer className="border-t bg-muted/40">
          <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <Link href="/pricing" className="text-xs text-muted-foreground/70 hover:underline">Pricing</Link>
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
