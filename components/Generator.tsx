'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';

export default function Generator({ redirectOnAuth = false, showTitle = true }: { redirectOnAuth?: boolean, showTitle?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'mindmap' | 'flashcards'>('mindmap');
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [flashcardsDeckId, setFlashcardsDeckId] = useState<string | undefined>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
      setUserId(data.user ? data.user.id : null);
      setAuthChecked(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
      if (signedIn) {
        setShowAuth(false);
        if (redirectOnAuth) {
            router.push('/dashboard');
        }
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router, redirectOnAuth]);

  const handleFileChange = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleSubmit = async () => {
    posthog.capture('generation_submitted', {
      mode: mode,
      file_count: files.length,
      has_prompt: !!prompt.trim(),
    });
    if (mode === 'flashcards') {
      // Require at least one file for file-based flashcards generation
      if (files.length === 0) {
        setError('Please upload at least one file to generate flashcards.');
        return;
      }

      // Require authentication for all generations
      if (!isAuthed) {
        setShowAuth(true);
        return;
      }

      setIsLoading(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (prompt.trim()) formData.append('prompt', prompt.trim());

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch('/api/generate-flashcards?stream=1', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        // Handle insufficient credits the same way as mind maps: show inline error and do not open modal
        if (res.status === 402) {
          let msg = 'Insufficient credits. Please upgrade your plan or top up.';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          let msg = 'Failed to generate flashcards';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
        if (isAuthed) {
          try {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            if (uid) {
              const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
              const creditsVal = Number(creditsData?.credits ?? 0);
              const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
            }
          } catch {}
        }
        // Open modal only after successful response
        setFlashcardsOpen(true);

        if (!res.body) {
          const data = await res.json().catch(() => null);
          const cards = Array.isArray(data?.cards) ? data.cards as FlashcardType[] : [];
          if (cards.length === 0) throw new Error('No cards generated');
          setFlashcardsCards(cards);
          setFlashcardsTitle(typeof data?.title === 'string' ? data.title : null);
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
              }
            } catch {}
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let streamedTitle: string | null = null;
          const accumulated: FlashcardType[] = [];
          // eslint-disable-next-line no-constant-condition
          while (true) {
            // eslint-disable-next-line no-await-in-loop
            const { value, done } = await reader.read();
            if (done) break;
            if (value) buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
              const rawLine = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!rawLine) continue;
              try {
                const obj = JSON.parse(rawLine);
                if (obj?.type === 'meta') {
                  if (typeof obj.title === 'string' && obj.title.trim()) streamedTitle = obj.title.trim();
                } else if (obj?.type === 'card') {
                  const card: FlashcardType = {
                    question: String(obj.question || ''),
                    answer: String(obj.answer || ''),
                  };
                  accumulated.push(card);
                  setFlashcardsCards((prev) => prev ? [...prev, card] : [card]);
                }
              } catch {
                // ignore malformed lines
              }
            }
          }
          setFlashcardsTitle(streamedTitle);
          if (accumulated.length === 0) throw new Error('No cards generated');
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (streamedTitle && streamedTitle.trim()) ? streamedTitle.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards: accumulated })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
              }
            } catch {}
          }
        }

        if (!isAuthed) { setShowAuth(true); }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate flashcards.';
        console.error(errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (files.length === 0 && !prompt.trim()) {
      setError('Please upload at least one file or enter a text prompt to generate a mind map.');
      return;
    }

    // Require authentication for all generations
    if (!isAuthed) {
      setShowAuth(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMarkdown(null);

    const formData = new FormData();
    if (files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }
    if (prompt.trim()) formData.append('prompt', prompt.trim());

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/api/generate-mindmap', {
        method: 'POST',
        body: formData,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        if (contentType.includes('application/json')) {
          let errorMsg = 'Failed to generate mind map.';
          try { const j = await response.json(); errorMsg = j.error || errorMsg; } catch {}
          throw new Error(errorMsg);
        } else {
          let errorMsg = `Failed to generate mind map. Server returned ${response.status} ${response.statusText}.`;
          try { const text = await response.text(); errorMsg = `${errorMsg} ${text}`; } catch {}
          throw new Error(errorMsg);
        }
      }
      // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
      if (isAuthed) {
        try {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id;
          if (uid) {
            const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
            const creditsVal = Number(creditsData?.credits ?? 0);
            const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
          }
        } catch {}
      }
      if (!contentType.includes('text/plain')) {
        // Non-stream fallback
        const result = await response.json();
        const md = (result?.markdown as string | undefined)?.trim();
        if (!md) throw new Error('Empty result from AI.');
        setMarkdown(md);
        if (isAuthed && userId) {
          const title = (() => {
            const h1 = md.match(/^#\s(.*)/m)?.[1];
            if (h1) return h1;
            const fm = md.match(/title:\s*(.*)/)?.[1];
            if (fm) return fm;
            return 'mindmap';
          })();
          try {
            await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md });
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
          } catch {}
        }
        if (!isAuthed) { setShowAuth(true); }
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let receivedAny = false;
      if (!reader) throw new Error('No response stream.');
      // Open modal immediately on first token
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          if (!receivedAny && accumulated.trim().length > 0) {
            receivedAny = true;
          }
          setMarkdown(accumulated);
        }
      };
      await pump();

      const md = accumulated.trim();
      if (!md) throw new Error('Empty result from AI.');

      // Save for authed users after stream completes
      if (isAuthed && userId) {
        const title = (() => {
          const h1 = md.match(/^#\s(.*)/m)?.[1];
          if (h1) return h1;
          const fm = md.match(/title:\s*(.*)/)?.[1];
          if (fm) return fm;
          return 'mindmap';
        })();
        try {
          await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md });
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
        } catch {}
      }
      // Require sign-in for all generations
      if (!isAuthed) {
        setShowAuth(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map.';
      console.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => setMarkdown(null);
  const handleCloseFlashcards = () => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setFlashcardsDeckId(undefined); };
  
  const handleUpgradeClick = () => {
    posthog.capture('upgrade_clicked', {
      source: 'generator_insufficient_credits',
      is_authed: isAuthed,
    });
    try {
      if (isAuthed) {
        router.push('/dashboard?upgrade=true');
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cogniguide_upgrade_flow', 'true');
        }
        router.push('/pricing');
      }
    } catch {}
  };

  const isDisabled = isLoading || markdown !== null || flashcardsOpen;

  return (
    <>
      <MindMapModal markdown={markdown} onClose={handleCloseModal} />
      <FlashcardsModal open={flashcardsOpen} title={flashcardsTitle} cards={flashcardsCards} isGenerating={isLoading && mode==='flashcards'} error={flashcardsError} onClose={handleCloseFlashcards} deckId={flashcardsDeckId} />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      <section id="generator" className={showTitle ? 'py-20' : 'pb-20'}>
        <div className="container">
          {showTitle && (
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Generate Mind Map or Flashcards</h2>
              <p className="text-muted-foreground mt-2">Upload a document or simply describe your topic. Choose your output.</p>
            </div>
          )}
          <div className="relative w-full max-w-3xl mx-auto bg-background rounded-[2rem] border shadow-[0_0_20px_2px_rgba(0,0,0,0.1)]">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent/10 rounded-full blur-3xl -z-10"></div>
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-center">
                <div className="inline-flex p-1 rounded-full border bg-muted/50">
                  <button
                    onClick={() => {
                      posthog.capture('generation_mode_changed', { new_mode: 'mindmap' });
                      setMode('mindmap');
                    }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode==='mindmap' ? 'bg-white text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                  >Mind Map</button>
                  <button
                    onClick={() => {
                      posthog.capture('generation_mode_changed', { new_mode: 'flashcards' });
                      setMode('flashcards');
                    }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode==='flashcards' ? 'bg-white text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                  >Flashcards</button>
                </div>
              </div>
              <Dropzone
                onFileChange={handleFileChange}
                disabled={isDisabled}
                onOpen={() => {
                  if (!authChecked) return false;
                  if (!isAuthed) {
                    setShowAuth(true);
                    return false; // block file dialog for unauth users
                  }
                  return true;
                }}
              />
              <PromptForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                prompt={prompt}
                setPrompt={setPrompt}
                disabled={isDisabled}
                filesLength={files.length}
                ctaLabel={mode==='flashcards' ? 'Generate Flashcards' : 'Generate Mind Map'}
                onInteract={() => {
                  if (!authChecked) return;
                  if (!isAuthed) setShowAuth(true);
                }}
              />                  
              {error && (
                <div className="mt-4 text-center p-4 bg-red-50 border border-red-200 text-red-700 rounded-[1.25rem]">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <p className="font-medium">{error}</p>
                    {typeof error === 'string' && error.toLowerCase().includes('insufficient credits') && (
                      <button
                        type="button"
                        onClick={handleUpgradeClick}
                        className="px-4 py-1.5 text-sm font-semibold rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
                      >
                        Upgrade Plan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
