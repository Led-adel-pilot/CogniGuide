'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Share2, UploadCloud, Zap, FileUp } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import Generator from '@/components/Generator';
import Link from 'next/link';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import EmbeddedMindMap from '@/components/EmbeddedMindMap';

const InteractiveMindMap = () => {
  const markdownData = "# CogniGuide 🧠🗺️\n- **The Problem: Drowning in Text 😩**\n  - Dense, complex documents 📚\n  - Time-consuming reading ⏳\n  - Poor knowledge retention 📉\n- **Our Solution: The Ultimate AI Tool 🤖**\n  - Exceptional Accuracy in analysis 🎯\n  - Transforms any text into a mind map 🗺️\n  - Automatically extracts key insights 🔑\n  - Effortlessly grasp complex topics ✅\n- **Science-Backed Efficiency 🔬**\n  - Faster comprehension ⚡\n  - Boost long-term recall 🧠💾\n  - Enhances creative thinking & problem-solving 🤔\n- **Powerful Features & Benefits ✨**\n  - **Save Dozens of Hours** per week ⏰\n  - **Achieve Higher Grades** & better outcomes 🏆\n  - **Accelerate Your Research** & learning ⚡";

  return <EmbeddedMindMap markdown={markdownData} />;
};


export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
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
          <div className="container h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
            </div>
            <div className="flex items-center gap-2">
              {isAuthed ? (
                <>
                  <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Dashboard</button>
                </>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Sign in</button>
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
                From Notes to Mind Maps & Flashcards.
                <br />
                <span className="text-primary">Instantly, with AI.</span>
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Stop drowning in dense documents and complex textbooks. CogniGuide’s AI analyzes your study materials and generates clear, interactive mind maps and adaptive flashcards that use an advanced spaced repetition algorithm. Helping you learn faster and remember longer.
              </p>
              <button 
                onClick={handleScrollToGenerator}
                className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 text-base font-bold text-white bg-primary rounded-full shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                <Zap className="h-5 w-5 transition-transform group-hover:-rotate-12" />
                Open Generator
              </button>
            </div>
          </section>

          {/* Why Mind Maps Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">The Science of Smarter Learning</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">CogniGuide integrates two powerful, research-backed learning methods. Visual mind maps help you grasp the big picture, while our intelligent Spaced Repetition flashcards lock knowledge into your long-term memory.</p>
              </div>
              <div className="relative bg-white rounded-[2rem] border shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="h-[500px] md:h-[600px] w-full">
                  <InteractiveMindMap />
                </div>
              </div>
            </div>
          </section>

          <Generator redirectOnAuth />

          {/* How It Works Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">From Chaos to Clarity in 3 Simple Steps</h2>
              </div>
              <div className="relative max-w-4xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-px bg-border -translate-y-1/2 hidden md:block"></div>
                <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">1</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <UploadCloud className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Upload or Prompt</h3>
                      <p className="text-muted-foreground text-sm">Provide a document (PDF, DOCX, etc.), an image, or simply describe your topic.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                     <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">2</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">AI Generation</h3>
                      <p className="text-muted-foreground text-sm">Our AI analyzes your content, extracts key concepts, and builds your learning tools in seconds.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                     <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">3</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <Share2 className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Learn & Retain</h3>
                      <p className="text-muted-foreground text-sm">Interact with your mind map, study with flashcards, and export your materials in multiple formats.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20">
            <div className="container">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">An Intelligent Partner for Your Brain</h2>
                <p className="text-muted-foreground mt-2">Features designed to make you smarter, faster, and more creative.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                 <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Versatile Document Support</h3>
                    <p className="text-muted-foreground text-sm mt-1">Supports PDF, DOCX, PPTX, TXT files and images, extracting key information automatically.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Deep AI Analysis</h3>
                    <p className="text-muted-foreground text-sm mt-1">Goes beyond summarization to create logical, hierarchical mind maps.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FlashcardIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Intelligent Spaced Repetition</h3>
                    <p className="text-muted-foreground text-sm mt-1">Master your subjects with flashcards that adapt to you. Our spaced repetition system schedules reviews at the right time to move information from short-term to long-term memory, ensuring you never forget.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Instant Generation</h3>
                    <p className="text-muted-foreground text-sm mt-1">Save hours of manual work. Our AI processes content and builds maps in seconds, not minutes.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="py-20">
            <div className="container">
              <div className="relative text-center bg-primary/10 rounded-[2rem] p-10 md:p-16 overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight text-primary">Ready to Revolutionize Your Learning?</h2>
                    <p className="max-w-xl mx-auto text-muted-foreground mt-4 mb-8">Stop wasting time with inefficient study methods. Start creating, learning, and retaining with the power of AI today.</p>
                    <button 
                      onClick={handleScrollToGenerator}
                      className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 text-base font-bold text-white bg-primary rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
                    >
                      <Zap className="h-5 w-5 transition-transform group-hover:-rotate-12" />
                      Get Started Now
                    </button>
                </div>
              </div>
            </div>
          </section>

        </main>

        <footer className="border-t">
          <div className="container py-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/pricing" className="text-sm hover:underline">Pricing</Link>
              <Link href="/contact" className="text-sm hover:underline">Contact</Link>
              <Link href="/legal/refund-policy" className="text-sm hover:underline">Refund Policy</Link>
              <Link href="/legal/cancellation-policy" className="text-sm hover:underline">Cancellation Policy</Link>
              <Link href="/legal/terms" className="text-sm hover:underline">Terms of Service</Link>
            </nav>
          </div>
        </footer>

      </div>
    </>
  );
}
