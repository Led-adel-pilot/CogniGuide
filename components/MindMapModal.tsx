'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { initializeMindMap, cleanup, getFullMindMapBounds, updateMindMap, recommendPrintScaleMultiplier, getPrintZoomBias } from '@/lib/markmap-renderer';
import { Download, X, FileImage, Sparkles, Loader2, ChevronLeft, ChevronRight, Eye, EyeOff, RotateCw, Printer } from 'lucide-react';
import domtoimage from 'dom-to-image-more';
import { supabase } from '@/lib/supabaseClient';
import { nextSchedule, createInitialSchedule, type FsrsScheduleState, type Grade } from '@/lib/spaced-repetition';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync } from '@/lib/sr-store';

interface MindMapModalProps {
  markdown: string | null;
  onClose: () => void;
}


export default function MindMapModal({ markdown, onClose }: MindMapModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  // NEW: ref and state to size the dropdown to the trigger width
  const triggerGroupRef = useRef<HTMLDivElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);

  // Will capture computed font-family to inline during export
  const getComputedFontFamily = () => {
    const el = containerRef.current;
    if (!el) return '';
    try {
      return window.getComputedStyle(el).fontFamily || '';
    } catch {
      return '';
    }
  };

  // Lightweight SHA-256 hex for stable local cache keys per markdown
  const computeSHA256Hex = async (input: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      const h = bytes[i].toString(16).padStart(2, '0');
      hex += h;
    }
    return hex;
  };

  const getLocalDeckKey = (hash: string) => `cogniguide:flashcards:md:${hash}`;

  useEffect(() => {
    const updateWidth = () => {
      if (triggerGroupRef.current) {
        setDropdownWidth(triggerGroupRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (isDropdownOpen && triggerGroupRef.current) {
      setDropdownWidth(triggerGroupRef.current.offsetWidth);
    }
  }, [isDropdownOpen]);

  const getTitle = (md: string): string => {
    const h1Match = md.match(/^#\s(.*)/m);
    if (h1Match) return h1Match[1];
    const frontmatterMatch = md.match(/title:\s*(.*)/);
    if (frontmatterMatch) return frontmatterMatch[1];
    return 'mindmap';
  };

  // Lightweight frontmatter parser for per-map settings
  const getFrontmatter = (md: string): Record<string, string> => {
    const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return {};
    const fm: Record<string, string> = {};
    match[1].split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key) fm[key] = val;
    });
    return fm;
  };

  const getPrintScaleFromFrontmatter = (md: string): number | undefined => {
    const fm = getFrontmatter(md);
    const raw = fm['print_scale'] ?? fm['printScale'] ?? fm['print-scale'];
    if (!raw) return undefined;
    const n = parseFloat(String(raw));
    if (Number.isFinite(n) && n > 0.1 && n <= 5) return n;
    return undefined;
  };

  const handleDownload = async (format: 'svg' | 'png') => {
    if (!containerRef.current) return;
    const title = getTitle(markdown || '');
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const container = containerRef.current;
    const svg = container.querySelector('#mindmap-svg') as SVGElement | null;

    // Store original styles to be restored later
    const originalTransform = container.style.transform;
    const originalSvgZIndex = svg ? svg.style.zIndex : '';
    const originalFontFamily = container.style.fontFamily;

    try {
        // Wait for fonts to be fully loaded to avoid fallback fonts in snapshots
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fontsApi = (document as any).fonts;
        if (fontsApi && typeof fontsApi.ready?.then === 'function') {
            try { await fontsApi.ready; } catch {}
        }

        // Inline the computed font on the container so the cloned node uses the same (Next/font) family
        const computedFontFamily = getComputedFontFamily();
        if (computedFontFamily) {
          container.style.fontFamily = computedFontFamily;
        }

        // SVG and PNG
        // Apply temporary styles for capture
        container.style.transform = 'none';
        if (svg && format === 'png') {
            svg.style.zIndex = '0';
        }

        const options = {
            width: container.scrollWidth,
            height: container.scrollHeight,
            style: computedFontFamily ? ({ fontFamily: computedFontFamily } as any) : undefined,
        };

        if (format === 'svg') {
            const dataUrl = await domtoimage.toSvg(container, options);
            const link = document.createElement('a');
            link.download = `${sanitizedTitle}.svg`;
            link.href = dataUrl;
            link.click();
        } else if (format === 'png') {
            const dataUrl = await domtoimage.toPng(container, {
                ...options,
                quality: 1.0,
                bgcolor: '#ffffff'
            });
            const link = document.createElement('a');
            link.download = `${sanitizedTitle}.png`;
            link.href = dataUrl;
            link.click();
        }
    } catch (error) {
        console.error('Download failed:', error);
    } finally {
        // Restore all original styles
        container.style.transform = originalTransform;
        container.style.fontFamily = originalFontFamily;
        if (svg) svg.style.zIndex = originalSvgZIndex;
    }
  };

  const handlePrintPdf = async () => {
    if (!containerRef.current) return;
    const title = getTitle(markdown || '');
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const container = containerRef.current;
    const originalTransform = container.style.transform;
    const originalFontFamily = container.style.fontFamily;

    // Ensure fonts are loaded before printing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fontsApi = (document as any).fonts;
    if (fontsApi && typeof fontsApi.ready?.then === 'function') {
      try { await fontsApi.ready; } catch {}
    }

    // Build print overlay in the same window (avoids popup blockers)
    const overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = '#ffffff';
    overlay.style.zIndex = '999999';
    overlay.style.overflow = 'hidden';

    const wrapper = document.createElement('div');
    wrapper.id = 'map-print-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.top = '50%';
    wrapper.style.left = '50%';
    wrapper.style.transformOrigin = 'center center';

    const clone = container.cloneNode(true) as HTMLElement;
    (clone as HTMLElement).style.transform = 'none';
    wrapper.appendChild(clone);
    overlay.appendChild(wrapper);

    const styleEl = document.createElement('style');
    styleEl.id = 'print-overlay-style';
    const computedFontFamily = getComputedFontFamily();
    styleEl.textContent = `
@page { size: auto; margin: 0; }
@media print {
  body > *:not(#print-overlay) { display: none !important; }
  #print-overlay { display: block !important; }
}
html, body { height: 100%; }
body { margin: 0; background: #ffffff; ${computedFontFamily ? `font-family: ${computedFontFamily};` : ''} }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#mindmap-container { position: relative; transform: none !important; }
#mindmap-svg { position: absolute; top: 0; left: 0; pointer-events: none; }
.mindmap-node { position: absolute; border-radius: 25px; padding: 8px 14px; border: 2px solid #dee2e6; box-shadow: 0 4px 8px rgba(0,0,0,0.07); white-space: nowrap; font-size: 15px; font-weight: 500; }
.mindmap-node.root { font-weight: bold; }
.connector-path { stroke-width: 2px; fill: none; }
    `;

    document.head.appendChild(styleEl);
    document.body.appendChild(overlay);

    let baseScale = 1;
    // Per-map override via frontmatter: print_scale: 1.8 (interpreted as 180%)
    const overrideScale = markdown ? getPrintScaleFromFrontmatter(markdown) : undefined;
    const smartMultiplier = markdown
      ? recommendPrintScaleMultiplier(markdown, {
          pageWidthPx: 794,
          pageHeightPx: 1123,
          marginPx: 24,
          minMultiplier: 1.05,
          maxMultiplier: 2.2,
          zoomBias: getPrintZoomBias(),
        })
      : 1.8;
    const desiredScaleMultiplier = overrideScale ?? smartMultiplier;
    const fit = () => {
      const printedContainer = overlay.querySelector('#mindmap-container') as HTMLElement | null;
      if (!printedContainer) return;
      // Measure actual content bounds from node positions
      const nodes = Array.from(printedContainer.querySelectorAll('.mindmap-node')) as HTMLElement[];
      let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
      nodes.forEach((n) => {
        const left = n.offsetLeft;
        const top = n.offsetTop;
        const right = left + n.offsetWidth;
        const bottom = top + n.offsetHeight;
        if (left < minLeft) minLeft = left;
        if (top < minTop) minTop = top;
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
      });
      if (!isFinite(minLeft) || !isFinite(minTop) || !isFinite(maxRight) || !isFinite(maxBottom)) {
        // Fallback to container size
        minLeft = 0; minTop = 0; maxRight = printedContainer.scrollWidth || 1000; maxBottom = printedContainer.scrollHeight || 800;
      }
      const margin = 24; // visual margin around content
      const contentWidth = Math.ceil((maxRight - minLeft) + margin * 2);
      const contentHeight = Math.ceil((maxBottom - minTop) + margin * 2);

      // Create a tight inner box equal to content bounds, and offset the container so
      // the content sits inside with the desired margin
      wrapper.style.width = `${contentWidth}px`;
      wrapper.style.height = `${contentHeight}px`;
      printedContainer.style.position = 'absolute';
      printedContainer.style.left = `${margin - minLeft}px`;
      printedContainer.style.top = `${margin - minTop}px`;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      baseScale = Math.min(vw / contentWidth, vh / contentHeight);
      wrapper.style.transform = `translate(-50%, -50%) scale(${baseScale * desiredScaleMultiplier})`;
    };

    const cleanupPrint = () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('afterprint', cleanupPrint);
      try { document.body.removeChild(overlay); } catch {}
      try { document.head.removeChild(styleEl); } catch {}
      container.style.transform = originalTransform;
      container.style.fontFamily = originalFontFamily;
    };

    window.addEventListener('resize', fit);
    window.addEventListener('afterprint', cleanupPrint);

    // Allow layout to settle, then fit and immediately print
    requestAnimationFrame(() => {
      fit();
      setTimeout(() => {
        try { window.print(); } finally {
          // Fallback cleanup in case afterprint doesn't fire
          setTimeout(cleanupPrint, 1000);
        }
      }, 50);
    });
  };

  const initializedRef = useRef(false);

  // Flashcards state
  type Flashcard = { question: string; answer: string; tags?: string[] };
  type CardWithSchedule = Flashcard & { schedule?: FsrsScheduleState };
  const [viewMode, setViewMode] = useState<'map' | 'flashcards'>('map');
  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const flashcardsCacheRef = useRef<Map<string, Flashcard[]>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isSavingFlashcards, setIsSavingFlashcards] = useState(false);
  const [flashcardsSavedId, setFlashcardsSavedId] = useState<string | null>(null);
  const [isCheckingFlashcards, setIsCheckingFlashcards] = useState(false);
  const [scheduledCards, setScheduledCards] = useState<CardWithSchedule[] | null>(null);
  const [deckExamDate, setDeckExamDate] = useState<string>('');
  const [predictedDueByGrade, setPredictedDueByGrade] = useState<Record<number, string>>({});

  const resetFlashcardSession = () => {
    setFlashcardIndex(0);
    setShowAnswer(false);
  };

  const handleGenerateFlashcards = async () => {
    if (!markdown) return;
    try {
      setIsGeneratingFlashcards(true);
      setGenerationError(null);
      setFlashcardsSavedId(null);
      // Use cached cards if available for this exact markdown
      const cached = flashcardsCacheRef.current.get(markdown);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setFlashcards(cached);
        resetFlashcardSession();
        setViewMode('flashcards');
        return;
      }
      // Request streaming NDJSON so we can show cards incrementally
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch('/api/generate-flashcards?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ markdown })
      });
      if (!res.ok) {
        let errMsg = 'Failed to generate flashcards';
        try {
          const err = await res.json();
          errMsg = err?.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (uid) {
          const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsData?.credits } }));
        }
      } catch {}

      // If the environment does not support streaming, fall back to JSON body
      if (!res.body) {
        const data = await res.json().catch(() => null);
        const cards = Array.isArray(data?.cards) ? data.cards : [];
        if (cards.length === 0) throw new Error('No cards generated');
        flashcardsCacheRef.current.set(markdown, cards);
        setFlashcards(cards);
        resetFlashcardSession();
        setViewMode('flashcards');
        // Persist locally by markdown hash for instantaneous future lookups
        try {
          const hash = await computeSHA256Hex(markdown);
          const title = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : getTitle(markdown);
          const local = { id: null as string | null, title, cards, created_at: new Date().toISOString() };
          if (typeof window !== 'undefined') window.localStorage.setItem(getLocalDeckKey(hash), JSON.stringify(local));
        } catch {}
        if (userId) {
          try {
            const title = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : getTitle(markdown);
            setIsSavingFlashcards(true);
            const { data: insertData, error: insertError } = await supabase
              .from('flashcards')
              .insert({ user_id: userId, title, markdown, cards })
              .select('id')
              .single();
            if (!insertError && insertData?.id) {
              setFlashcardsSavedId(insertData.id as string);
              // Update local cache with Supabase id for cross-session reference
              try {
                const hash = await computeSHA256Hex(markdown);
                const key = getLocalDeckKey(hash);
                const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
                const obj = raw ? JSON.parse(raw) : null;
                if (obj && typeof obj === 'object') {
                  obj.id = insertData.id;
                  window.localStorage.setItem(key, JSON.stringify(obj));
                }
              } catch {}
            }
          } catch {
          } finally {
            setIsSavingFlashcards(false);
          }
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let firstCardShown = false;
      let streamedTitle: string | null = null;
      const accumulated: Flashcard[] = [];

      // Switch to flashcards view immediately so the user sees progress
      setViewMode('flashcards');

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
          let obj: any;
          try {
            obj = JSON.parse(rawLine);
          } catch {
            // Ignore malformed lines (server only forwards valid ones)
            continue;
          }
          if (obj?.type === 'meta') {
            if (typeof obj.title === 'string' && obj.title.trim()) {
              streamedTitle = obj.title.trim();
            }
          } else if (obj?.type === 'card') {
            const card: Flashcard = {
              question: String(obj.question || ''),
              answer: String(obj.answer || ''),
              tags: Array.isArray(obj.tags) ? obj.tags.map((t: any) => String(t)) : undefined,
            };
            accumulated.push(card);
            setFlashcards(prev => {
              const next = prev ? [...prev, card] : [card];
              return next;
            });
            if (!firstCardShown) {
              resetFlashcardSession();
              firstCardShown = true;
            }
          } else if (obj?.type === 'done') {
            // End of stream per protocol; ignore remaining buffered data
            buf = '';
          }
        }
      }

      // Finished streaming; cache and persist if we received any cards
      if (accumulated.length === 0) throw new Error('No cards generated');
      flashcardsCacheRef.current.set(markdown, accumulated);
      // Also persist to localStorage for quick reopen without network/db
      try {
        const hash = await computeSHA256Hex(markdown);
        const title = streamedTitle && streamedTitle.trim() ? streamedTitle.trim() : getTitle(markdown);
        const local = { id: null as string | null, title, cards: accumulated, created_at: new Date().toISOString() };
        if (typeof window !== 'undefined') window.localStorage.setItem(getLocalDeckKey(hash), JSON.stringify(local));
      } catch {}
      if (userId) {
        try {
          const title = streamedTitle && streamedTitle.trim() ? streamedTitle.trim() : getTitle(markdown);
          setIsSavingFlashcards(true);
          const { data: insertData, error: insertError } = await supabase
            .from('flashcards')
            .insert({ user_id: userId, title, markdown, cards: accumulated })
            .select('id')
            .single();
          if (!insertError && insertData?.id) {
            setFlashcardsSavedId(insertData.id as string);
            // Update local cache with the assigned id
            try {
              const hash = await computeSHA256Hex(markdown);
              const key = getLocalDeckKey(hash);
              const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
              const obj = raw ? JSON.parse(raw) : null;
              if (obj && typeof obj === 'object') {
                obj.id = insertData.id;
                window.localStorage.setItem(key, JSON.stringify(obj));
              }
            } catch {}
          }
        } catch {
          // ignore persistence errors
        } finally {
          setIsSavingFlashcards(false);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate flashcards';
      setGenerationError(msg);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleRegenerateFlashcards = async () => {
    await handleGenerateFlashcards();
  };

  const handlePrev = () => {
    if (!flashcards) return;
    setFlashcardIndex((idx) => (idx - 1 + flashcards.length) % flashcards.length);
    setShowAnswer(false);
  };
  const handleNext = () => {
    if (!flashcards) return;
    setFlashcardIndex((idx) => (idx + 1) % flashcards.length);
    setShowAnswer(false);
  };

  // Initialize scheduled cards when flashcards (and optional deck id) are available
  useEffect(() => {
    if (!flashcards || flashcards.length === 0) { setScheduledCards(null); return; }
    const init = async () => {
      if (flashcardsSavedId) {
        const stored = (await loadDeckScheduleAsync(flashcardsSavedId)) || loadDeckSchedule(flashcardsSavedId);
        if (stored && Array.isArray(stored.schedules) && stored.schedules.length === flashcards.length) {
          setDeckExamDate(stored.examDate || '');
          setScheduledCards(flashcards.map((c, i) => ({ ...c, schedule: stored.schedules[i] || createInitialSchedule() })));
          return;
        }
      }
      setScheduledCards(flashcards.map((c) => ({ ...c, schedule: createInitialSchedule() })));
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, flashcardsSavedId]);

  // Persist schedules when changed and we have a saved deck id
  useEffect(() => {
    if (!flashcardsSavedId || !scheduledCards) return;
    const payload = { examDate: deckExamDate || undefined, schedules: scheduledCards.map((c) => c.schedule) };
    saveDeckSchedule(flashcardsSavedId, payload);
    saveDeckScheduleAsync(flashcardsSavedId, payload).catch(() => {});
  }, [flashcardsSavedId, scheduledCards, deckExamDate]);

  function formatTimeUntil(dueDate: Date, now: Date = new Date()): string {
    const ms = Math.max(0, dueDate.getTime() - now.getTime());
    const minute = 60_000;
    const hour = 3_600_000;
    const day = 86_400_000;
    if (ms < minute) return '<1m';
    if (ms < hour) return `<${Math.ceil(ms / minute)}m`;
    if (ms < day) return `<${Math.ceil(ms / hour)}h`;
    const days = Math.ceil(ms / day);
    if (days < 30) return `${days}d`;
    const months = Math.ceil(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.ceil(months / 12);
    return `${years}y`;
  }

  const handleSetDeckExamDate = (value: string) => {
    setDeckExamDate(value);
    setScheduledCards((prev) => prev ? prev.map((c) => ({ ...c, schedule: { ...(c.schedule ?? createInitialSchedule()), examDate: value || undefined } })) : prev);
  };

  // Predict next due labels per grade once the answer is shown
  useEffect(() => {
    if (!showAnswer || !scheduledCards || !scheduledCards[flashcardIndex]) { setPredictedDueByGrade({}); return; }
    const now = new Date();
    const base = scheduledCards[flashcardIndex].schedule ?? createInitialSchedule();
    const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
    const map: Record<number, string> = {};
    const grades = [1, 2, 3, 4] as Grade[];
    for (const g of grades) {
      const s = nextSchedule(withDeckExam, g, now);
      const due = new Date(s.due);
      map[g as number] = formatTimeUntil(due, now);
    }
    setPredictedDueByGrade(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, flashcardIndex, deckExamDate, scheduledCards]);

  useEffect(() => {
    if (!viewportRef.current || !containerRef.current) return;
    if (!markdown) return;
    if (!initializedRef.current && viewMode === 'map') {
      initializeMindMap(markdown, viewportRef.current, containerRef.current);
      initializedRef.current = true;
    } else {
      if (viewMode === 'map') updateMindMap(markdown);
    }
    return () => { /* no-op between updates */ };
  }, [markdown, viewMode]);

  // Reset renderer when modal is closed (markdown becomes null)
  useEffect(() => {
    if (!markdown) {
      initializedRef.current = false;
      cleanup();
    }
  }, [markdown]);

  useEffect(() => {
    return () => {
      initializedRef.current = false;
      cleanup();
    };
  }, []);

  // Detect authenticated user for saving flashcards
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUserId(data.user ? data.user.id : null);
      } catch {
        if (!isMounted) return;
        setUserId(null);
      }
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Clean up renderer when switching to flashcards; re-init when returning to map
  useEffect(() => {
    if (viewMode === 'flashcards') {
      initializedRef.current = false;
      cleanup();
    } else if (viewMode === 'map') {
      if (markdown && viewportRef.current && containerRef.current && !initializedRef.current) {
        initializeMindMap(markdown, viewportRef.current, containerRef.current);
        initializedRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Reset flashcard state when switching to a different mind map markdown
  useEffect(() => {
    if (!markdown) return;
    setViewMode('map');
    setGenerationError(null);
    setFlashcardIndex(0);
    setShowAnswer(false);
    const cached = flashcardsCacheRef.current.get(markdown);
    setFlashcards(cached ?? null);
    setFlashcardsSavedId(null);
    // Attempt to load previously saved flashcards for this markdown from Supabase
    // Only if not present in the in-memory cache and the user is signed in
    (async () => {
      if (cached) return;
      // 1) Try localStorage hashed cache (fast, no network)
      try {
        const hash = await computeSHA256Hex(markdown);
        const key = getLocalDeckKey(hash);
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && Array.isArray(obj.cards) && obj.cards.length > 0) {
            flashcardsCacheRef.current.set(markdown, obj.cards);
            setFlashcards(obj.cards);
            if (obj.id) setFlashcardsSavedId(String(obj.id));
            return; // Done, skip DB lookup
          }
        }
      } catch {}

      if (!userId) return;

      // 2) Fallback: Supabase by title only (avoid sending huge markdown)
      setIsCheckingFlashcards(true);
      try {
        const title = getTitle(markdown);
        const { data, error } = await supabase
          .from('flashcards')
          .select('id, cards')
          .eq('user_id', userId)
          .eq('title', title)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!error && Array.isArray(data) && data.length > 0) {
          const record = data[0] as { id: string; cards: Flashcard[] };
          if (Array.isArray(record.cards) && record.cards.length > 0) {
            flashcardsCacheRef.current.set(markdown, record.cards);
            setFlashcards(record.cards);
            setFlashcardsSavedId(record.id);
            // Mirror into localStorage for next open
            try {
              const hash = await computeSHA256Hex(markdown);
              const key = getLocalDeckKey(hash);
              const local = { id: record.id, title, cards: record.cards, created_at: new Date().toISOString() };
              if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(local));
            } catch {}
          }
        }
      } catch {
        // ignore retrieval errors silently
      } finally {
        setIsCheckingFlashcards(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  if (!markdown) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
      <div className="relative bg-white w-full h-full rounded-[1.5rem] border border-gray-200 ring-1 ring-black/5 shadow-2xl shadow-[0_10px_25px_rgba(0,0,0,0.12),0_25px_70px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
        <div className="absolute top-2 right-2 z-30">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 shadow-sm px-2 py-1">
            {viewMode === 'map' ? (
              <>
                <button
                  onClick={flashcards ? () => setViewMode('flashcards') : handleGenerateFlashcards}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm focus:outline-none"
                  disabled={isGeneratingFlashcards || isCheckingFlashcards}
                >
                  {isGeneratingFlashcards ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating
                    </>
                  ) : isCheckingFlashcards ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Loading
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" /> {flashcards ? 'Flashcards' : 'Generate'}
                    </>
                  )}
                </button>

                <div className="relative">
                  <div
                    ref={triggerGroupRef}
                    className="inline-flex rounded-full"
                  >
                    <button
                      onClick={() => setDropdownOpen(!isDropdownOpen)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm focus:outline-none"
                      aria-haspopup="menu"
                      aria-expanded={isDropdownOpen}
                    >
                      <Download className="h-4 w-4" />
                      Download
                      <svg className="h-4 w-4 ml-1 -mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>

                  {isDropdownOpen && (
                    <div
                      className="absolute left-0 mt-2 bg-white rounded-3xl shadow-sm z-20 border border-gray-200 p-2"
                      role="menu"
                      style={{ width: dropdownWidth }}
                    >
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => { handleDownload('svg'); setDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-xl focus:outline-none"
                        >
                          <FileImage className="h-4 w-4" /> SVG
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleDownload('png'); setDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-xl focus:outline-none"
                        >
                          <FileImage className="h-4 w-4" /> PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => { handlePrintPdf(); setDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-xl focus:outline-none"
                        >
                          <Printer className="h-4 w-4" /> PDF (Print)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setViewMode('map')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm focus:outline-none"
                >
                  Back to Map
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 bg-white text-gray-700 rounded-full border border-gray-300 shadow-sm hover:bg-gray-100 focus:outline-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* White overlay to fully cover mind map when in flashcards mode */}
        {viewMode === 'flashcards' && (
          <div className="absolute inset-0 bg-white z-10" />
        )}

        <div className="w-full h-full relative">
          <div
            ref={viewportRef}
            className={`map-viewport w-full h-full flex-grow bg-white z-0 ${viewMode === 'flashcards' ? 'hidden' : ''}`}
          >
            <div ref={containerRef} id="mindmap-container" />
          </div>
          <div
            className={`w-full h-full relative grid grid-rows-[auto,auto,1fr,auto] bg-white p-4 sm:p-6 ${viewMode === 'flashcards' ? 'z-20' : 'hidden'}`}
          >
            {/* Header */}
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
              <div className="text-left text-sm font-medium truncate bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-emerald-600">
                {markdown ? getTitle(markdown) : 'Flashcards'}
              </div>
              <div className="text-sm text-gray-600 text-center">
                {flashcards ? `${flashcardIndex + 1} / ${flashcards.length}` : ''}
              </div>
              <div className="justify-self-start sm:justify-self-end">
                {flashcards ? (
                  <label className="inline-flex items-center gap-2 text-xs">
                    <span className="text-gray-600">Exam date</span>
                    <input
                      type="date"
                      className="h-8 px-3 rounded-full border border-gray-300 text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 transition-colors"
                      value={deckExamDate}
                      onChange={(e) => handleSetDeckExamDate(e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            </div>

            {/* Progress */}
            {flashcards ? (
              <div className="w-full max-w-5xl mx-auto mt-2">
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"
                    style={{ width: `${((flashcardIndex + 1) / flashcards.length) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Content */}
            <div className="w-full max-w-3xl mx-auto overflow-auto flex items-center justify-center py-2">
              {generationError ? (
                <div className="w-full text-sm text-red-600">{generationError}</div>
              ) : !flashcards ? (
                <div className="flex flex-col items-center justify-center text-center gap-4">
                  <p className="text-gray-600">Generate flashcards from this mind map.</p>
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={isGeneratingFlashcards}
                    className="inline-flex items-center px-5 py-3 rounded-full border border-gray-300 shadow-sm bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {isGeneratingFlashcards ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />} Generate Flashcards
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                    <div className="bg-white border border-gray-200 rounded-[1.25rem] shadow p-5 sm:p-6 min-h-[180px] sm:min-h-[200px]">
                      <div className="text-gray-900 text-xl sm:text-2xl font-semibold leading-7 sm:leading-8 break-words">
                        {flashcards[flashcardIndex]?.question}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {scheduledCards && scheduledCards[flashcardIndex]?.schedule?.due ? (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            Next due: {new Date(scheduledCards[flashcardIndex]!.schedule!.due!).toLocaleDateString()}
                          </span>
                        ) : null}
                        {userId && isSavingFlashcards ? (
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving…
                          </span>
                        ) : null}
                      </div>
                      {showAnswer && (
                        <div className="mt-4 text-gray-700">
                          <div className="h-px bg-gray-200 mb-4" />
                          <div className="max-h-[45vh] overflow-y-auto text-sm text-gray-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              ul: ({ node, ...props }) => (
                                <ul className="list-disc list-inside pl-4 my-2 space-y-1" {...props} />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="list-decimal list-inside pl-4 my-2 space-y-1" {...props} />
                              ),
                              li: ({ node, ...props }) => (
                                <li className="leading-6" {...props} />
                              ),
                              p: ({ node, ...props }) => (
                                <p className="my-2 leading-6" {...props} />
                              ),
                            }}>
                              {flashcards[flashcardIndex]?.answer || ''}
                            </ReactMarkdown>
                          </div>
                          {flashcards[flashcardIndex]?.tags?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {flashcards[flashcardIndex].tags!.map((t, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-600 bg-gray-50">
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Navigation */}
            {flashcards ? (
              <div className="w-full max-w-3xl mx-auto mt-4 grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
                {!showAnswer ? (
                  <div className="justify-self-start">
                    <button
                      onClick={handlePrev}
                      className="inline-flex items-center h-10 px-4 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 whitespace-nowrap"
                    >
                      <ChevronLeft className="h-5 w-5 mr-2" /> Prev
                    </button>
                  </div>
                ) : <div />}
                <div className="justify-self-center flex flex-col items-center gap-2">
                  {showAnswer ? (
                    <div className="flex items-end justify-center gap-3 flex-nowrap">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[1] || ''}</span>
                        <button onClick={() => {
                          if (!scheduledCards) return;
                          setScheduledCards((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            const item = { ...next[flashcardIndex] };
                            const base = item.schedule ?? createInitialSchedule();
                            const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
                            item.schedule = nextSchedule(withDeckExam, 1 as Grade, new Date());
                            next[flashcardIndex] = item;
                            return next;
                          });
                          setShowAnswer(false);
                          setFlashcardIndex((i) => (i + 1) % flashcards.length);
                        }} className="h-9 px-3 text-xs rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50">Again</button>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[2] || ''}</span>
                        <button onClick={() => {
                          if (!scheduledCards) return;
                          setScheduledCards((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            const item = { ...next[flashcardIndex] };
                            const base = item.schedule ?? createInitialSchedule();
                            const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
                            item.schedule = nextSchedule(withDeckExam, 2 as Grade, new Date());
                            next[flashcardIndex] = item;
                            return next;
                          });
                          setShowAnswer(false);
                          setFlashcardIndex((i) => (i + 1) % flashcards.length);
                        }} className="h-9 px-3 text-xs rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50">Hard</button>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[3] || ''}</span>
                        <button onClick={() => {
                          if (!scheduledCards) return;
                          setScheduledCards((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            const item = { ...next[flashcardIndex] };
                            const base = item.schedule ?? createInitialSchedule();
                            const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
                            item.schedule = nextSchedule(withDeckExam, 3 as Grade, new Date());
                            next[flashcardIndex] = item;
                            return next;
                          });
                          setShowAnswer(false);
                          setFlashcardIndex((i) => (i + 1) % flashcards.length);
                        }} className="h-9 px-3 text-xs rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50">Good</button>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[4] || ''}</span>
                        <button onClick={() => {
                          if (!scheduledCards) return;
                          setScheduledCards((prev) => {
                            if (!prev) return prev;
                            const next = [...prev];
                            const item = { ...next[flashcardIndex] };
                            const base = item.schedule ?? createInitialSchedule();
                            const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
                            item.schedule = nextSchedule(withDeckExam, 4 as Grade, new Date());
                            next[flashcardIndex] = item;
                            return next;
                          });
                          setShowAnswer(false);
                          setFlashcardIndex((i) => (i + 1) % flashcards.length);
                        }} className="h-9 px-3 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50">Easy</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAnswer(true)} className="inline-flex items-center h-10 px-5 rounded-full text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap">
                      <Eye className="h-5 w-5 mr-2" /> Show Answer
                    </button>
                  )}
                </div>
                {!showAnswer ? (
                  <div className="justify-self-end">
                    <button
                      onClick={handleNext}
                      className="inline-flex items-center h-10 px-4 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 whitespace-nowrap"
                    >
                      Next <ChevronRight className="h-5 w-5 ml-2" />
                    </button>
                  </div>
                ) : <div />}
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
