'use client';

import { useEffect, useRef, useState } from 'react';
import { initializeMindMap, cleanup, getFullMindMapBounds, updateMindMap, recommendPrintScaleMultiplier, getPrintZoomBias, collapseToMainBranches } from '@/lib/markmap-renderer';
import { Download, X, FileImage, Loader2, Map as MapIcon } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import FlashcardsModal from '@/components/FlashcardsModal';
import domtoimage from 'dom-to-image-more';
import { supabase } from '@/lib/supabaseClient';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync } from '@/lib/sr-store';
import posthog from 'posthog-js';
import AuthModal from '@/components/AuthModal';
import jsPDF from 'jspdf';

interface MindMapModalProps {
  markdown: string | null;
  onClose: () => void;
}


export default function MindMapModal({ markdown, onClose }: MindMapModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const collapseRequestedRef = useRef(false);

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

  const handleDownload = async (format: 'svg' | 'png' | 'pdf') => {
    if (!containerRef.current) return;
    const title = getTitle(markdown || '');
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const container = containerRef.current;
    const svg = container.querySelector('#mindmap-svg') as SVGElement | null;

    // Store originals in case we temporarily change global backgrounds (we won't touch the live container anymore)
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

        // We now clone and capture off-screen to avoid disturbing the live view (no pan jump)

        const options = {
            width: container.scrollWidth,
            height: container.scrollHeight,
            style: ({
              ...(computedFontFamily ? { fontFamily: computedFontFamily } : {})
            } as any),
        };

        if (format === 'svg') {
            // Capture from an off-screen clone as well to avoid live transform side effects
            const clone = container.cloneNode(true) as HTMLElement;
            clone.style.transform = 'none';
            if (computedFontFamily) clone.style.fontFamily = computedFontFamily;
            const wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-10000px';
            wrapper.style.top = '-10000px';
            wrapper.style.width = `${container.scrollWidth}px`;
            wrapper.style.height = `${container.scrollHeight}px`;
            wrapper.style.overflow = 'hidden';
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);
            try {
              const dataUrl = await domtoimage.toSvg(wrapper, options);
              const link = document.createElement('a');
              link.download = `${sanitizedTitle}.svg`;
              link.href = dataUrl;
              link.click();
            } finally {
              document.body.removeChild(wrapper);
            }
        } else if (format === 'png' || format === 'pdf') {
            // Use a detached wrapper and crop to the exact content bounds to prevent tinted edges
            // 1) Measure content bounds from live DOM (nodes are absolutely positioned inside the container)
            const nodes = Array.from(container.querySelectorAll('.mindmap-node')) as HTMLElement[];
            let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
            nodes.forEach((el) => {
              const left = el.offsetLeft;
              const top = el.offsetTop;
              const right = left + el.offsetWidth;
              const bottom = top + el.offsetHeight;
              if (left < minLeft) minLeft = left;
              if (top < minTop) minTop = top;
              if (right > maxRight) maxRight = right;
              if (bottom > maxBottom) maxBottom = bottom;
            });
            if (!Number.isFinite(minLeft) || !Number.isFinite(minTop)) {
              // Fallback to full container if measurement fails
              minLeft = 0; minTop = 0; maxRight = container.scrollWidth; maxBottom = container.scrollHeight;
            }
            // Add margin to prevent nodes from being right at the edge
            const margin = 25;
            const cropWidth = Math.max(1, Math.ceil(maxRight - minLeft) + margin * 2);
            const cropHeight = Math.max(1, Math.ceil(maxBottom - minTop) + margin * 2);

            // Determine theme background from viewport/body (light or dark)
            let themeBackground = 'white';
            try {
              const viewportEl = viewportRef.current;
              if (viewportEl) {
                const vpBg = window.getComputedStyle(viewportEl).backgroundColor;
                if (vpBg && vpBg !== 'rgba(0, 0, 0, 0)' && vpBg !== 'transparent') {
                  themeBackground = vpBg;
                }
              }
              if (themeBackground === 'white' && typeof document !== 'undefined' && document.body) {
                const bodyBg = window.getComputedStyle(document.body).backgroundColor;
                if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
                  themeBackground = bodyBg;
                }
              }
            } catch {}

            // 2) Clone the container and shift content so the crop starts at (0,0)
            const clone = container.cloneNode(true) as HTMLElement;
            const cloneSvg = clone.querySelector('#mindmap-svg') as SVGElement | null;
            clone.style.transform = 'none';
            clone.style.position = 'absolute';
            clone.style.left = `${-minLeft + margin}px`;
            clone.style.top = `${-minTop + margin}px`;
            // Set theme-aware background for PNG export
            clone.style.background = themeBackground;
            clone.style.backgroundColor = themeBackground;
            clone.style.border = '0';
            clone.style.boxShadow = 'none';
            clone.style.outline = 'none';
            // Remove node drop-shadows for clean edges
            try {
              const cNodes = Array.from(clone.querySelectorAll('.mindmap-node')) as HTMLElement[];
              cNodes.forEach(n => { n.style.boxShadow = 'none'; n.style.backgroundClip = 'padding-box'; });
            } catch {}
            if (cloneSvg) {
              (cloneSvg.style as any).zIndex = '0';
              (cloneSvg.style as any).background = themeBackground;
              (cloneSvg.style as any).backgroundColor = themeBackground;
            }

            // 3) Build off-screen wrapper sized to the crop
            const wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-10000px';
            wrapper.style.top = '-10000px';
            wrapper.style.width = `${cropWidth}px`;
            wrapper.style.height = `${cropHeight}px`;
            wrapper.style.overflow = 'hidden';
            wrapper.style.background = themeBackground;
            wrapper.style.backgroundColor = themeBackground;
            wrapper.style.border = '0';
            wrapper.style.boxShadow = 'none';
            wrapper.style.outline = 'none';
            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);

            try {
              const dataUrl = await domtoimage.toPng(wrapper, {
                width: cropWidth,
                height: cropHeight,
                quality: 1.0,
                bgcolor: themeBackground,
                style: { background: themeBackground, backgroundColor: themeBackground, ...(options.style || {}) },
                cacheBust: true
              });
              if (format === 'png') {
                const link = document.createElement('a');
                link.download = `${sanitizedTitle}.png`;
                link.href = dataUrl;
                link.click();
              } else {
                const pxToMm = 0.264583;
                const imgWidthMm = cropWidth * pxToMm;
                const imgHeightMm = cropHeight * pxToMm;
                const orientation = imgWidthMm > imgHeightMm ? 'landscape' : 'portrait';
                const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                // No margins - fill entire page (may distort aspect ratio)
                const scaleX = pageWidth / imgWidthMm;
                const scaleY = pageHeight / imgHeightMm;
                const renderW = imgWidthMm * scaleX;
                const renderH = imgHeightMm * scaleY;
                const x = 0;
                const y = 0;
                pdf.addImage(dataUrl, 'PNG', x, y, renderW, renderH);
                pdf.save(`${sanitizedTitle}.pdf`);
              }
            } finally {
              document.body.removeChild(wrapper);
            }
        }
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download mind map. Please try again.');
    } finally {
        // Restore any inline font override applied earlier
        container.style.fontFamily = originalFontFamily;
    }
  };

  const initializedRef = useRef(false);

  // Flashcards state
  type Flashcard = { question: string; answer: string };
  const [viewMode, setViewMode] = useState<'map' | 'flashcards'>('map');
  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const flashcardsCacheRef = useRef<Map<string, Flashcard[]>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isSavingFlashcards, setIsSavingFlashcards] = useState(false);
  const [flashcardsSavedId, setFlashcardsSavedId] = useState<string | null>(null);
  const [isCheckingFlashcards, setIsCheckingFlashcards] = useState(false);
  const [showLossAversionPopup, setShowLossAversionPopup] = useState(false);
  const [showTimeBasedPopup, setShowTimeBasedPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  // Gate auto-collapse: allow for non-auth users, and for auth users only if they have never generated a mind map before
  const [shouldAutoCollapse, setShouldAutoCollapse] = useState<boolean>(false);
  const shouldAutoCollapseRef = useRef<boolean>(false);

  const handleClose = (event?: React.MouseEvent) => {
    // Prevent any automatic triggers
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Only show popup if user has generated content and is not authenticated
    if (!userId && hasGeneratedContent) {
      setShowLossAversionPopup(true);
    } else {
      onClose();
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!markdown) return;
    posthog.capture('flashcards_generation_requested', { markdown_length: markdown.length });
    try {
      setIsGeneratingFlashcards(true);
      setGenerationError(null);
      setFlashcardsSavedId(null);
      // Use cached cards if available for this exact markdown
      const cached = flashcardsCacheRef.current.get(markdown);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setFlashcards(cached);
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
      } catch (error) {
        console.error('Failed to get user session:', error);
      }

      // If the environment does not support streaming, fall back to JSON body
      if (!res.body) {
        const data = await res.json().catch(() => null);
        const cards = Array.isArray(data?.cards) ? data.cards : [];
        if (cards.length === 0) throw new Error('No cards generated');
        flashcardsCacheRef.current.set(markdown, cards);
        setFlashcards(cards);
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
          } catch (err: any) {
            console.error('Failed to save flashcards to Supabase:', err);
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
            };
            accumulated.push(card);
            setFlashcards(prev => {
              const next = prev ? [...prev, card] : [card];
              return next;
            });
            if (!firstCardShown) {
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
        } catch (err: any) {
          console.error('Failed to save flashcards to Supabase:', err);
        } finally {
          setIsSavingFlashcards(false);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to generate flashcards';
      setGenerationError(msg);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };



  useEffect(() => {
    if (!viewportRef.current || !containerRef.current) return;
    if (!markdown) return;
    if (!initializedRef.current && viewMode === 'map') {
      initializeMindMap(markdown, viewportRef.current, containerRef.current);
      initializedRef.current = true;
      setHasGeneratedContent(true);
    } else {
      if (viewMode === 'map') updateMindMap(markdown);
    }
    return () => { /* no-op between updates */ };
  }, [markdown, viewMode]);

  // Reset renderer when modal is closed (markdown becomes null)
  useEffect(() => {
    if (!markdown) {
      initializedRef.current = false;
      setHasGeneratedContent(false);
      setShowLossAversionPopup(false);
      setShowTimeBasedPopup(false);
      // Reset collapse request state so future generations don't inherit it
      collapseRequestedRef.current = false;
      cleanup();
    }
  }, [markdown]);

  // Timer for time-based signup popup for non-auth users
  useEffect(() => {
    if (!markdown || userId || showTimeBasedPopup) return;

    const timer = setTimeout(() => {
      setShowTimeBasedPopup(true);
    }, 50000); // 50 seconds

    return () => clearTimeout(timer);
  }, [markdown, userId, showTimeBasedPopup]);

  useEffect(() => {
    return () => {
      initializedRef.current = false;
      cleanup();
    };
  }, []);

  // Collapse to main branches when mindmap stream completes
  useEffect(() => {
    const onComplete = () => {
      if (!shouldAutoCollapseRef.current) return;
      collapseRequestedRef.current = true;
      try { collapseToMainBranches({ animate: false }); } catch {}
      // Retry a few times to handle race with renderer initialization
      try { setTimeout(() => { try { collapseToMainBranches({ animate: false }); } catch {} }, 60); } catch {}
      try { setTimeout(() => { try { collapseToMainBranches({ animate: false }); } catch {} }, 180); } catch {}
      try { setTimeout(() => { try { collapseToMainBranches({ animate: false }); } catch {} }, 360); } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('cogniguide:mindmap-stream-complete', onComplete);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cogniguide:mindmap-stream-complete', onComplete);
      }
    };
  }, []);

  // If initialization happens after completion event, apply collapse immediately
  useEffect(() => {
    if (!viewportRef.current || !containerRef.current) return;
    if (!markdown) return;
    if (initializedRef.current && collapseRequestedRef.current && shouldAutoCollapseRef.current) {
      try { collapseToMainBranches({ animate: false }); } catch {}
    }
  }, [markdown, initializedRef.current]);

  // Determine whether auto-collapse should be enabled for this user
  useEffect(() => {
    let cancelled = false;
    const computeAutoCollapse = async () => {
      // Non-auth users: enable auto-collapse
      if (!userId) {
        if (!cancelled) {
          setShouldAutoCollapse(true);
          shouldAutoCollapseRef.current = true;
        }
        return;
      }
      const cacheKey = `cogniguide:user:${userId}:hasPriorMindmap`;
      // Try local cache first
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
        if (raw === 'true' || raw === 'false') {
          const hasPrior = raw === 'true';
          if (!cancelled) {
            setShouldAutoCollapse(!hasPrior);
            shouldAutoCollapseRef.current = !hasPrior;
          }
          return;
        }
      } catch {}
      // Query Supabase to see if the user has any prior mindmaps
      try {
        const { data, error } = await supabase
          .from('mindmaps')
          .select('id')
          .eq('user_id', userId)
          .limit(1);
        const hasPrior = !error && Array.isArray(data) && data.length > 0;
        if (!cancelled) {
          setShouldAutoCollapse(!hasPrior);
          shouldAutoCollapseRef.current = !hasPrior;
          try {
            if (typeof window !== 'undefined') window.localStorage.setItem(cacheKey, hasPrior ? 'true' : 'false');
          } catch {}
        }
      } catch {
        if (!cancelled) {
          setShouldAutoCollapse(false);
          shouldAutoCollapseRef.current = false;
        }
      }
    };
    computeAutoCollapse();
    return () => { cancelled = true; };
  }, [userId]);

  // Detect authenticated user for saving flashcards
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUserId(data.user ? data.user.id : null);
      } catch (error) {
        console.error('Failed to get user session:', error);
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
    // New generation: clear previous completion flag to avoid stale collapses
    collapseRequestedRef.current = false;
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
      } catch (dbError) {
        console.error('Failed to retrieve flashcards from database:', dbError);
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
    <>
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="relative w-full h-full rounded-[1.5rem] border border-border ring-1 ring-black/5 shadow-2xl shadow-[0_10px_25px_rgba(0,0,0,0.12),0_25px_70px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
          <div className="absolute top-2 right-2 z-30 group inline-flex items-center gap-1.5">
              {viewMode === 'map' ? (
                <>
                  <button
                    onClick={flashcards ? () => setViewMode('flashcards') : handleGenerateFlashcards}
                    className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-border text-foreground hover:bg-muted/50 text-sm focus:outline-none min-w-[44px] transition-all duration-300 ease-in-out ${
                      isGeneratingFlashcards
                        ? 'opacity-100 translate-x-0 pointer-events-auto'
                        : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none group-hover:pointer-events-auto'
                    }`}
                    style={{ backgroundColor: 'var(--color-background)' }}
                    disabled={isGeneratingFlashcards}
                  >
                    {isGeneratingFlashcards ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlashcardIcon className="h-4 w-4" />
                    )}
                  </button>

                  <div className="relative">
                    <div
                      ref={triggerGroupRef}
                      className="inline-flex rounded-full opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-in-out pointer-events-none group-hover:pointer-events-auto"
                    >
                      <button
                        onClick={() => setDropdownOpen(!isDropdownOpen)}
                        className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full border border-border text-foreground hover:bg-muted/50 text-sm focus:outline-none min-w-[44px]"
                        style={{ backgroundColor: 'var(--color-background)' }}
                        aria-haspopup="menu"
                        aria-expanded={isDropdownOpen}
                      >
                        <Download className="h-4 w-4" />
                        <svg className="h-4 w-4 ml-1 -mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>
                    </div>

                    {isDropdownOpen && (
                      <div
                        className="absolute right-0 mt-2 rounded-3xl shadow-sm z-20 border border-border p-2 min-w-[120px]"
                        style={{
                          backgroundColor: 'var(--color-background)',
                          width: Math.max(dropdownWidth || 0, 120)
                        }}
                        role="menu"
                      >
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => { posthog.capture('mindmap_exported', { format: 'svg' }); handleDownload('svg'); setDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-xl focus:outline-none"
                          >
                            <FileImage className="h-4 w-4" /> SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => { posthog.capture('mindmap_exported', { format: 'png' }); handleDownload('png'); setDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-xl focus:outline-none"
                          >
                            <FileImage className="h-4 w-4" /> PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => { posthog.capture('mindmap_exported', { format: 'pdf' }); handleDownload('pdf'); setDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-xl focus:outline-none"
                          >
                            <FileImage className="h-4 w-4" /> PDF
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
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-foreground hover:bg-muted/50 focus:outline-none opacity-100 translate-x-0 transition-all duration-300 ease-in-out"
                    style={{ backgroundColor: 'var(--color-background)' }}
                    aria-label="Back to Map"
                  >
                    <MapIcon className="h-4 w-4" />
                  </button>
                </>
              )}

              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center w-8 h-8 text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 focus:outline-none opacity-100 translate-x-0 transition-all duration-200 ease-in-out"
                style={{ backgroundColor: 'var(--color-background)' }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
          </div>

          {/* White overlay to fully cover mind map when in flashcards mode */}
          {viewMode === 'flashcards' && (
            <div className="absolute inset-0 z-10" style={{ backgroundColor: 'var(--color-background)' }} />
          )}

          <div className="w-full h-full relative">
            <div
              ref={viewportRef}
              className={`map-viewport w-full h-full flex-grow z-0 ${viewMode === 'flashcards' ? 'hidden' : ''}`}
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              <div ref={containerRef} id="mindmap-container" />
            </div>
            {viewMode === 'flashcards' && (
              <FlashcardsModal
                open={true}
                title={getTitle(markdown) || undefined}
                cards={flashcards}
                isGenerating={isGeneratingFlashcards}
                error={generationError || undefined}
                onClose={() => setViewMode('map')}
                deckId={flashcardsSavedId || undefined}
                initialIndex={flashcardIndex}
              />
            )}
          </div>
        </div>

        {showLossAversionPopup && (
          <div className="absolute inset-0 flex items-center justify-center z-[110]">
            {/* Black transparent background */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
            <div className="border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10" style={{ backgroundColor: 'var(--color-background)' }}>
              <h2 className="text-2xl font-bold mb-4">Don't Lose Your Mind Map!</h2>
              <p className="text-muted-foreground mb-6">
                Sign up to save your mind map, and track your study progress with spaced repetition flashcards.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-md">
                <button
                  onClick={() => {
                    if (markdown) {
                      localStorage.setItem('cogniguide:pending_mindmap', markdown);
                    }
                    setShowLossAversionPopup(false);
                    setShowAuthModal(true);
                  }}
                  className="w-full h-10 px-6 text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                >
                  Save & Continue
                </button>
                <button
                  onClick={onClose}
                  className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/80 transition-colors whitespace-nowrap"
                >
                  Continue without saving
                </button>
              </div>
            </div>
          </div>
        )}

        {showTimeBasedPopup && (
          <div className="absolute inset-0 flex items-center justify-center z-[110]">
            {/* Black transparent background */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
            <div className="border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10" style={{ backgroundColor: 'var(--color-background)' }}>
              <h2 className="text-2xl font-bold mb-4">Sign Up to Save Your Mind Map!</h2>
              <p className="text-muted-foreground mb-6">
                Sign up to continue reading and track your study progress with spaced repetition flashcards.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-md">
                <button
                  onClick={() => {
                    if (markdown) {
                      localStorage.setItem('cogniguide:pending_mindmap', markdown);
                    }
                    setShowTimeBasedPopup(false);
                    setShowAuthModal(true);
                  }}
                  className="w-full h-10 px-6 text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                >
                  Save & Continue
                </button>
                <button
                  onClick={onClose}
                  className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/80 transition-colors whitespace-nowrap"
                >
                  Close Mind Map
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

