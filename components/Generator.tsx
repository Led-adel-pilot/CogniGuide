'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';
import { NON_AUTH_FREE_LIMIT } from '@/lib/plans';
import { Sparkles } from 'lucide-react';

export default function Generator({ redirectOnAuth = false, showTitle = true }: { redirectOnAuth?: boolean, showTitle?: boolean }) {
  // Enforce a client-side per-file size cap to avoid server 413s (Vercel ~4.5MB)
  const MAX_FILE_BYTES = Math.floor(4.2 * 1024 * 1024); // ~4.2MB safety margin
  const [files, setFiles] = useState<File[]>([]);
  const [preParsed, setPreParsed] = useState<{ text: string; images: string[]; rawCharCount?: number } | null>(null);
  const [isPreParsing, setIsPreParsing] = useState(false);
  const lastPreparseKeyRef = useRef<string | null>(null);
  // Cache for file set processing results (keyed by file set combination)
  const processedFileSetsCache = useRef<Map<string, { result: any; processedAt: number }>>(new Map());

  // Debug logging in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[FileCache] ${message}`, ...args);
    }
  }, [isDevelopment]);
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
  const [freeGenerationsLeft, setFreeGenerationsLeft] = useState<number>(NON_AUTH_FREE_LIMIT);
  const [allowedNameSizes, setAllowedNameSizes] = useState<{ name: string; size: number }[] | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
      setUserId(data.user ? data.user.id : null);

      // Load free generations count for unauthenticated users
      if (!authed && typeof window !== 'undefined') {
        const stored = localStorage.getItem('cogniguide_free_generations');
        const used = stored ? parseInt(stored, 10) : 0;
        setFreeGenerationsLeft(Math.max(0, NON_AUTH_FREE_LIMIT - used));
      }

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

  // Helper function to generate a unique key for a file
  const getFileKey = useCallback(async (file: File): Promise<string> => {
    // Create a more robust key that works consistently across environments
    // Use file name, size, and type for basic identification
    const baseKey = `${file.name}|${file.size}|${file.type || 'unknown'}`;

    // Add a simple hash of the file content for uniqueness (first 1KB)
    try {
      const slice = file.slice(0, 1024);
      const arrayBuffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let hash = 0;
      for (let i = 0; i < Math.min(bytes.length, 512); i++) { // Limit to 512 bytes for performance
        hash = ((hash << 5) - hash) + bytes[i];
        hash = hash & hash; // Convert to 32-bit integer
      }
      const contentHash = Math.abs(hash).toString(36);
      const finalKey = `${baseKey}|${contentHash}`;
      debugLog(`Generated file key: ${finalKey}`);
      return finalKey;
    } catch (error) {
      // Fallback to base key if hashing fails
      debugLog(`Hashing failed for ${baseKey}, using fallback:`, error);
      return baseKey;
    }
  }, [debugLog]);

  // Helper function to generate a file set key from multiple files
  const getFileSetKey = useCallback(async (files: File[]): Promise<string> => {
    const fileKeys = await Promise.all(files.map(f => getFileKey(f)));
    return fileKeys.sort().join('||');
  }, [getFileKey]);

  const handleFileChange = useCallback(async (selectedFiles: File[]) => {
    // Clear any previous errors when files change
    setError(null);
    
    if (!selectedFiles || selectedFiles.length === 0) {
      setFiles([]);
      processedFileSetsCache.current.clear();
      setPreParsed(null);
      lastPreparseKeyRef.current = null;
      setAllowedNameSizes(undefined);
      return;
    }

    // Validate file sizes before accepting them
    const tooLargeFile = selectedFiles.find(f => f.size > MAX_FILE_BYTES);
    if (tooLargeFile) {
      setError(`"${tooLargeFile.name}" is too large. Max file size is ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB.`);
      return; // Don't update files state
    }

    setFiles(selectedFiles);
    // Generate a key for the current file set
    const fileSetKey = await getFileSetKey(selectedFiles);
    debugLog(`File set key: ${fileSetKey}`);
    lastPreparseKeyRef.current = fileSetKey;

    // Check if we have a cached result for this exact file set (valid for 5 minutes)
    const cachedResult = processedFileSetsCache.current.get(fileSetKey);
    const cacheAge = cachedResult ? Date.now() - cachedResult.processedAt : 0;
    const isCacheValid = cachedResult && cacheAge < 5 * 60 * 1000;
    debugLog(`Cache hit: ${!!cachedResult}, Cache age: ${Math.round(cacheAge / 1000)}s, Valid: ${!!isCacheValid}`);

    if (isCacheValid) {
      // Use cached result
      const j = cachedResult.result;
      const isAuthedFromApi = Boolean(j?.isAuthed);
      const text = typeof j?.text === 'string' ? j.text : '';
      const images = Array.isArray(j?.images) ? j.images as string[] : [];
      const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
      setPreParsed({ text, images, rawCharCount });

      // Handle cumulative pruning feedback from cached result
      const limitExceeded = Boolean(j?.limitExceeded);
      const includedFiles = Array.isArray(j?.includedFiles) ? j.includedFiles as { name: string; size: number }[] : [];
      const excludedFiles = Array.isArray(j?.excludedFiles) ? j.excludedFiles as { name: string; size: number }[] : [];
      const partialFile = j?.partialFile as { name: string; size: number; includedChars: number } | null;
      if (limitExceeded) {
        setAllowedNameSizes(includedFiles);
        if (isAuthedFromApi || isAuthed) {
          setError('Content exceeds the length limit for your current plan. the content has been truncated.');
        }
      } else {
        setAllowedNameSizes(undefined);
      }
      return;
    }

    // No valid cache, pre-parse now (single upload)
    try {
      setIsPreParsing(true);
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append('files', f));

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const res = await fetch('/api/preparse', {
        method: 'POST',
        body: formData,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (!res.ok) {
        // Non-fatal; generation can fallback to legacy upload path
        try { const j = await res.json(); setError(j?.error || 'Failed to prepare files.'); } catch {}
        setPreParsed(null);
        setAllowedNameSizes(undefined);
        return;
      }

      const j = await res.json();

      // Cache the complete result for this file set
      processedFileSetsCache.current.set(fileSetKey, {
        result: j,
        processedAt: Date.now()
      });

      debugLog(`Cached result for key: ${fileSetKey}, Cache size: ${processedFileSetsCache.current.size}`);

      // Clean up old cache entries (keep only last 10 to prevent memory issues)
      if (processedFileSetsCache.current.size > 10) {
        const entries = Array.from(processedFileSetsCache.current.entries());
        entries.sort((a, b) => b[1].processedAt - a[1].processedAt);
        processedFileSetsCache.current.clear();
        entries.slice(0, 10).forEach(([key, value]) => {
          processedFileSetsCache.current.set(key, value);
        });
        debugLog(`Cleaned up cache, new size: ${processedFileSetsCache.current.size}`);
      }

      const isAuthedFromApi = Boolean(j?.isAuthed);
      const text = typeof j?.text === 'string' ? j.text : '';
      const images = Array.isArray(j?.images) ? j.images as string[] : [];
      const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
      setPreParsed({ text, images, rawCharCount });

      // Handle cumulative pruning feedback
      const limitExceeded = Boolean(j?.limitExceeded);
      const includedFiles = Array.isArray(j?.includedFiles) ? j.includedFiles as { name: string; size: number }[] : [];
      const excludedFiles = Array.isArray(j?.excludedFiles) ? j.excludedFiles as { name: string; size: number }[] : [];
      const partialFile = j?.partialFile as { name: string; size: number; includedChars: number } | null;
      if (limitExceeded) {
        setAllowedNameSizes(includedFiles);
        if (isAuthedFromApi || isAuthed) {
          setError('Content exceeds the length limit for your current plan. the content has been truncated.');
        }
      } else {
        setAllowedNameSizes(undefined);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsPreParsing(false);
    }
  }, [getFileSetKey, debugLog, MAX_FILE_BYTES, isAuthed]);

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

      // Check free generations for unauthenticated users
      if (!isAuthed && freeGenerationsLeft <= 0) {
        setError(`You've used all ${NON_AUTH_FREE_LIMIT} no-signup generations. Please sign up to continue generating`);
        return;
      }

      // Only clear error and start loading if we pass the validation checks
      setIsLoading(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        let res: Response;
        // If we haven't pre-parsed yet, do it now (single upload)
        let effectivePreParsed: { text: string; images: string[]; rawCharCount?: number } | null = preParsed;
        if (!effectivePreParsed && files.length > 0) {
          try {
            setIsPreParsing(true);
            const formData = new FormData();
            files.forEach((f) => formData.append('files', f));
            const preRes = await fetch('/api/preparse', {
              method: 'POST',
              body: formData,
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });
            if (preRes.ok) {
              const j = await preRes.json();
              const text = typeof j?.text === 'string' ? j.text : '';
              const images = Array.isArray(j?.images) ? j.images as string[] : [];
              const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
              effectivePreParsed = { text, images, rawCharCount };
              setPreParsed(effectivePreParsed);
            }
          } catch {}
          finally { setIsPreParsing(false); }
        }
        if (effectivePreParsed) {
          const payload = { text: effectivePreParsed.text || '', images: effectivePreParsed.images || [], prompt: prompt.trim() || '', rawCharCount: effectivePreParsed.rawCharCount };
          res = await fetch('/api/generate-flashcards?stream=1', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          });
        } else {
          const formData = new FormData();
          files.forEach((file) => formData.append('files', file));
          if (prompt.trim()) formData.append('prompt', prompt.trim());
          res = await fetch('/api/generate-flashcards?stream=1', {
            method: 'POST',
            body: formData,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
        }
        // Handle insufficient credits the same way as mind maps: show inline error and do not open modal
        if (res.status === 402) {
          let msg = 'Insufficient credits. Upload a smaller file or';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            let errorMsg = 'Failed to generate flashcards.';
            try { const j = await res.json(); errorMsg = j.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          } else {
            let errorMsg = `Failed to generate flashcards. Server returned ${res.status} ${res.statusText}.`;
            try { const text = await res.text(); errorMsg = `${errorMsg} ${text}`; } catch {}
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
        // Increment free generation counter for unauthenticated users
        if (!isAuthed && typeof window !== 'undefined') {
          const stored = localStorage.getItem('cogniguide_free_generations');
          const used = stored ? parseInt(stored, 10) : 0;
          const newUsed = used + 1;
          localStorage.setItem('cogniguide_free_generations', newUsed.toString());
          setFreeGenerationsLeft(Math.max(0, NON_AUTH_FREE_LIMIT - newUsed));
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

        // No longer require sign-in after successful generation
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate flashcards.';
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

    // Check free generations for unauthenticated users
    if (!isAuthed && freeGenerationsLeft <= 0) {
      setError(`You've used all ${NON_AUTH_FREE_LIMIT} no-signup generations. Please sign up to continue generating!`);
      return;
    }

    // Only clear error and start loading if we pass the validation checks
    setIsLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      let response: Response;
      // If we haven't pre-parsed yet, do it now (single upload)
      let effectivePreParsed: { text: string; images: string[]; rawCharCount?: number } | null = preParsed;
      if (!effectivePreParsed && files.length > 0) {
        try {
          setIsPreParsing(true);
          const formData = new FormData();
          if (files.length > 0) { files.forEach(file => { formData.append('files', file); }); }
          const preRes = await fetch('/api/preparse', {
            method: 'POST',
            body: formData,
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          if (preRes.ok) {
            const j = await preRes.json();
            const text = typeof j?.text === 'string' ? j.text : '';
            const images = Array.isArray(j?.images) ? j.images as string[] : [];
            const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
            effectivePreParsed = { text, images, rawCharCount };
            setPreParsed(effectivePreParsed);
          }
        } catch {}
        finally { setIsPreParsing(false); }
      }
      if (effectivePreParsed) {
        const payload = { text: effectivePreParsed.text || '', images: effectivePreParsed.images || [], prompt: prompt.trim() || '', rawCharCount: effectivePreParsed.rawCharCount };
        response = await fetch('/api/generate-mindmap', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        });
      } else {
        const formData = new FormData();
        if (files.length > 0) { files.forEach(file => { formData.append('files', file); }); }
        if (prompt.trim()) formData.append('prompt', prompt.trim());
        response = await fetch('/api/generate-mindmap', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
      }
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
        // No longer require sign-in after successful generation
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

      // Increment free generation counter for unauthenticated users
      if (!isAuthed && typeof window !== 'undefined') {
        const stored = localStorage.getItem('cogniguide_free_generations');
        const used = stored ? parseInt(stored, 10) : 0;
        const newUsed = used + 1;
        localStorage.setItem('cogniguide_free_generations', newUsed.toString());
        setFreeGenerationsLeft(Math.max(0, NON_AUTH_FREE_LIMIT - newUsed));
      }

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
      // No longer require sign-in after successful generation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map.';
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

  const canSubmit = (!isLoading && !isPreParsing && markdown === null && !flashcardsOpen);

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
                disabled={isLoading || markdown !== null || flashcardsOpen}
                isPreParsing={isPreParsing}
                allowedNameSizes={allowedNameSizes}
                onOpen={() => {
                  if (!authChecked) return false;
                  if (!isAuthed && freeGenerationsLeft <= 0) {
                    setShowAuth(true);
                    return false; // block file dialog if no free generations left
                  }
                  return true;
                }}
              />
              <PromptForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                prompt={prompt}
                setPrompt={setPrompt}
                disabled={!canSubmit}
                filesLength={files.length}
                ctaLabel={mode==='flashcards' ? 'Generate Flashcards' : 'Generate Mind Map'}
                mode={mode}
                onInteract={() => {
                  if (!authChecked) return;
                  if (!isAuthed && freeGenerationsLeft <= 0) setShowAuth(true);
                }}
              />                  
              {error && (
                <div className="mt-4 text-center p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-[1.25rem]">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {typeof error === 'string' && error.toLowerCase().includes('insufficient credits') && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <p className="font-medium">{error}</p>
                        <button
                          type="button"
                          onClick={handleUpgradeClick}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-blue-100/50 text-blue-700 hover:bg-blue-200/50 border border-blue-200 transition-colors"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Upload your Plan</span>
                        </button>
                      </div>
                    )}
                    {typeof error === 'string' && error.toLowerCase().includes('no-signup generations') && (
                      <p className="font-medium text-center">
                        {error.includes('!') ? (
                          <>You've used all {NON_AUTH_FREE_LIMIT} no-signup generations. Please{' '}
                          <button
                            type="button"
                            onClick={() => setShowAuth(true)}
                            className="underline hover:no-underline font-semibold"
                          >
                            sign up
                          </button>{' '}
                          to continue generating!</>
                        ) : (
                          <>You've used all {NON_AUTH_FREE_LIMIT} no-signup generations. Please{' '}
                          <button
                            type="button"
                            onClick={() => setShowAuth(true)}
                            className="underline hover:no-underline font-semibold"
                          >
                            sign up
                          </button>{' '}
                          to continue generating.</>
                        )}
                      </p>
                    )}
                    {typeof error === 'string' &&
                     !error.toLowerCase().includes('insufficient credits') &&
                     !error.toLowerCase().includes('no-signup generations') &&
                     !error.toLowerCase().includes('exceed') && (
                      <p className="font-medium">{error}</p>
                    )}
                    {typeof error === 'string' && error.toLowerCase().includes('exceed') && (
                      <p className="font-medium">{error}</p>
                    )}
                  </div>
                </div>
              )}

              {!isAuthed && freeGenerationsLeft > 0 && freeGenerationsLeft < NON_AUTH_FREE_LIMIT && (
                <div className="mt-4 text-center p-3 bg-green-50 border border-green-200 text-green-700 rounded-[1.25rem]">
                  <p className="text-sm font-medium">
                    {freeGenerationsLeft} no-signup {freeGenerationsLeft === 1 ? 'generation' : 'generations'} remaining.{' '}
                    <button
                      type="button"
                      onClick={() => setShowAuth(true)}
                      className="underline hover:no-underline font-semibold"
                    >
                      Sign up
                    </button>{' '}
                    for more!
                  </p>
                </div>
              )}

              {!isAuthed && freeGenerationsLeft === NON_AUTH_FREE_LIMIT && (files.length > 0 || prompt.trim()) && (
                <div className="mt-4 text-center p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-[1.25rem]">
                  <p className="text-sm font-medium">
                    You have {NON_AUTH_FREE_LIMIT} no-signup generations!{' '}
                    <button
                      type="button"
                      onClick={() => setShowAuth(true)}
                      className="underline hover:no-underline font-semibold"
                    >
                      Sign up
                    </button>{' '}
                    for more.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
