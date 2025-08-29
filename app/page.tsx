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
  const markdownData = "# Benefits of Reading from Mind Maps 🧠\n- **Enhanced Comprehension** 📖\n  - Visual layout clarifies relationships between concepts\n  - See the big picture and details simultaneously\n- **Improved Memory Retention** 💾\n  - Colors, branches, and keywords engage more of the brain\n  - Information is chunked into manageable parts\n- **Faster Learning** 🚀\n  - Quickly grasp complex topics\n  - Information is presented in a concise and organized manner\n- **Boosts Creativity** ✨\n  - Radiant structure encourages associative thinking\n  - Sparks new ideas and connections\n- **Effective Revision** ✅\n  - Condenses large amounts of information into a single page\n  - Easy to review and recall key points\n- **Engaging and Fun** 🎉\n  - More appealing than linear notes\n  - Makes studying a more active process";

  return <EmbeddedMindMap markdown={markdownData} />;
};


export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [view, setView] = useState('mindmap');
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
              {/* <Link href="/pricing" className="text-sm text-muted-foreground hover:underline">Pricing</Link> */}
              {/* Maybe reducing user signup conversion, to be researched */}
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
                Study Smarter, Not Harder.
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Upload your PDFs, slides, or documents. Our AI creates clear mind maps and smart, spaced-repetition flashcards to help you learn 2x faster and ace your next test.
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
                Try it - No Signup
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
                  <div className={`w-full ${view === 'mindmap' ? 'h-[300px] md:h-[600px]' : 'h-[68vh] md:h-[600px]'}`}>
                    {view === 'mindmap' ? <InteractiveMindMap /> : <EmbeddedFlashcards />}
                  </div>
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

          <Generator redirectOnAuth />



        </main>

        <footer className="border-t bg-muted/40">
          <div className="container py-3 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-2 sm:gap-4">
              {/* <Link href="/pricing" className="text-xs text-muted-foreground/70 hover:underline">Pricing</Link> */}
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
