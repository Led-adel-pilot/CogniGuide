'use client';

import { useEffect, useRef, useState } from 'react';
import { initializeMindMap, cleanup, getFullMindMapBounds, updateMindMap, recommendPrintScaleMultiplier, getPrintZoomBias, collapseToMainBranches } from '@/lib/markmap-renderer';
import { Download, X, FileImage, Loader2, Map as MapIcon } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import FlashcardsModal from '@/components/FlashcardsModal';
import { toSvg, toPng } from 'html-to-image';
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

  const isMeaningfulColor = (value?: string | null): value is string => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return lower !== 'transparent' && lower !== 'rgba(0, 0, 0, 0)';
  };

  const normalizeCssColorValue = (value?: string | null): string | null => {
    if (!isMeaningfulColor(value)) return null;
    const trimmed = value.trim();
    if (typeof window === 'undefined') return trimmed;
    let probe: HTMLDivElement | null = null;
    let appended = false;
    try {
      probe = document.createElement('div');
      probe.style.backgroundColor = trimmed;
      if (!probe.style.backgroundColor) {
        probe.style.backgroundColor = '';
        probe.style.color = trimmed;
      }
      if (document.body) {
        probe.style.position = 'absolute';
        probe.style.left = '-9999px';
        probe.style.top = '0';
        probe.style.width = '0';
        probe.style.height = '0';
        document.body.appendChild(probe);
        appended = true;
        const styles = window.getComputedStyle(probe);
        const computedBackground = styles.backgroundColor;
        const computedColor = styles.color;
        if (isMeaningfulColor(computedBackground)) {
          return computedBackground.trim();
        }
        if (isMeaningfulColor(computedColor)) {
          return computedColor.trim();
        }
      }
      const inlineBackground = probe.style.backgroundColor;
      if (isMeaningfulColor(inlineBackground)) {
        return inlineBackground.trim();
      }
      const inlineColor = probe.style.color;
      if (isMeaningfulColor(inlineColor)) {
        return inlineColor.trim();
      }
    } catch {
      return trimmed;
    } finally {
      if (probe && appended && document.body?.contains(probe)) {
        document.body.removeChild(probe);
      }
    }
    return trimmed;
  };

  const clampRgbComponent = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

  const parseNormalizedColorToRgb = (color: string): [number, number, number] | null => {
    const trimmed = color.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('#')) {
      let hex = trimmed.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex
          .slice(0, 3)
          .split('')
          .map(ch => ch + ch)
          .join('');
      } else if (hex.length === 8) {
        hex = hex.slice(0, 6);
      }
      if (hex.length !== 6) return null;
      const num = Number.parseInt(hex, 16);
      if (Number.isNaN(num)) return null;
      return [
        clampRgbComponent((num >> 16) & 0xff),
        clampRgbComponent((num >> 8) & 0xff),
        clampRgbComponent(num & 0xff)
      ];
    }
    const rgbMatch = trimmed.match(/^rgba?\(\s*([0-9.]+%?)(?:\s*,\s*|\s+)([0-9.]+%?)(?:\s*,\s*|\s+)([0-9.]+%?)(?:\s*(?:\/|,)\s*[0-9.]+%?)?\s*\)$/i);
    if (rgbMatch) {
      const components = rgbMatch.slice(1, 4).map(part => {
        const numeric = Number.parseFloat(part);
        if (Number.isNaN(numeric)) return 0;
        if (part.trim().endsWith('%')) {
          return clampRgbComponent((numeric / 100) * 255);
        }
        return clampRgbComponent(numeric);
      }) as [number, number, number];
      return components;
    }
    return null;
  };

  const isDarkModeActive = (): boolean => {
    if (typeof document === 'undefined') return false;
    const html = document.documentElement;
    const dataTheme = html.getAttribute('data-theme')?.toLowerCase();
    if (dataTheme === 'dark') return true;
    if (dataTheme === 'light') return false;
    const combinedClassList = `${html.className} ${document.body?.className ?? ''}`.toLowerCase();
    if (combinedClassList.includes('dark')) return true;
    if (combinedClassList.includes('light')) return false;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch {
        return false;
      }
    }
    return false;
  };

  const getThemeBackgroundColor = (): { css: string; rgb: [number, number, number] } => {
    const candidates: (string | null | undefined)[] = [];
    if (viewportRef.current) {
      candidates.push(viewportRef.current.style.backgroundColor);
      try {
        candidates.push(window.getComputedStyle(viewportRef.current).backgroundColor);
      } catch {}
    }
    if (containerRef.current) {
      candidates.push(containerRef.current.style.backgroundColor);
      try {
        candidates.push(window.getComputedStyle(containerRef.current).backgroundColor);
      } catch {}
    }
    if (typeof document !== 'undefined') {
      try {
        candidates.push(document.body?.style.backgroundColor);
        candidates.push(document.body ? window.getComputedStyle(document.body).backgroundColor : null);
      } catch {}
      try {
        candidates.push(document.documentElement?.style.backgroundColor);
        candidates.push(document.documentElement ? window.getComputedStyle(document.documentElement).backgroundColor : null);
        candidates.push(document.documentElement ? window.getComputedStyle(document.documentElement).getPropertyValue('--color-background') : null);
      } catch {}
    }
    for (const candidate of candidates) {
      const normalized = normalizeCssColorValue(candidate);
      if (!normalized) continue;
      const rgb = parseNormalizedColorToRgb(normalized);
      if (rgb) {
        return { css: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, rgb };
      }
    }
    const fallbackRgb: [number, number, number] = isDarkModeActive() ? [17, 23, 34] : [255, 255, 255];
    return { css: `rgb(${fallbackRgb[0]}, ${fallbackRgb[1]}, ${fallbackRgb[2]})`, rgb: fallbackRgb };
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
    // Better sanitization that preserves accented characters, case, and uses spaces
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\u00C0-\u017F\s()]/g, '') // Keep letters (including accented), numbers, spaces, and parentheses
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim() // Remove leading/trailing spaces
      .substring(0, 100); // Limit length to prevent overly long filenames
    const container = containerRef.current;

    try {
        // Wait for fonts to be fully loaded to avoid fallback fonts in snapshots
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fontsApi = (document as any).fonts;
        if (fontsApi && typeof fontsApi.ready?.then === 'function') {
            try { await fontsApi.ready; } catch {}
        }

        // Inline the computed font on the container so the cloned node uses the same (Next/font) family
        const computedFontFamily = getComputedFontFamily();

        // Create a clone of the container for export
        const clonedContainer = container.cloneNode(true) as HTMLElement;

        // Position the clone off-screen for export
        clonedContainer.style.position = 'absolute';
        clonedContainer.style.left = '-9999px';
        clonedContainer.style.top = '0';
        clonedContainer.style.zIndex = '-1000';
        if (computedFontFamily) {
          clonedContainer.style.fontFamily = computedFontFamily;
        }

        // Prevent scrollbars by temporarily hiding body overflow during export
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        document.body.appendChild(clonedContainer);

        try {
            if (format === 'svg') {
                const svgEl = clonedContainer.querySelector('#mindmap-svg') as SVGElement | null;
                if (!svgEl) {
                    alert('Mind map SVG element not found.');
                    return;
                }
                const originalTransform = svgEl.style.transform;
                svgEl.style.transform = 'none';
                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const dataUrl = await toSvg(clonedContainer, {
                        width: clonedContainer.scrollWidth,
                        height: clonedContainer.scrollHeight,
                        filter: () => true
                    });
                    const link = document.createElement('a');
                    link.download = `${sanitizedTitle}.svg`;
                    link.href = dataUrl;
                    link.click();
                } finally {
                    svgEl.style.transform = originalTransform;
                }
            } else if (format === 'png' || format === 'pdf') {
                // Use a detached wrapper and crop to the exact content bounds to prevent tinted edges
                // 1) Measure content bounds from cloned DOM
                const nodes = Array.from(clonedContainer.querySelectorAll('.mindmap-node')) as HTMLElement[];
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
                  minLeft = 0;
                  minTop = 0;
                  maxRight = clonedContainer.scrollWidth;
                  maxBottom = clonedContainer.scrollHeight;
                }
                // Add margin to prevent nodes from being right at the edge
                const marginPx = 25;
                const exportWidth = Math.max(1, Math.ceil(maxRight - minLeft) + marginPx * 2);
                const exportHeight = Math.max(1, Math.ceil(maxBottom - minTop) + marginPx * 2);

                // Determine the effective theme background once so exports stay consistent
                const { css: themeBackgroundCss, rgb: themeBackgroundRgb } = getThemeBackgroundColor();

                // Prepare cloned container for clean capture
                const svg = clonedContainer.querySelector('#mindmap-svg') as SVGElement | null;

                // Clear backgrounds and reset positioning on clone
                clonedContainer.style.background = themeBackgroundCss;
                clonedContainer.style.backgroundColor = themeBackgroundCss;
                clonedContainer.style.transform = 'none';
                clonedContainer.style.position = 'absolute';
                clonedContainer.style.left = '0';
                clonedContainer.style.top = '0';
                if (svg) svg.style.zIndex = '0';

                // Remove node drop-shadows for clean edges
                try {
                  const nodes = Array.from(clonedContainer.querySelectorAll('.mindmap-node')) as HTMLElement[];
                  nodes.forEach(n => {
                    n.style.boxShadow = 'none';
                    n.style.backgroundClip = 'padding-box';
                    n.style.transform = 'none';
                  });
                  const paths = Array.from(clonedContainer.querySelectorAll('path')) as SVGPathElement[];
                  paths.forEach(p => {
                    p.style.fill = 'none';
                    const strokeColor = window.getComputedStyle(p).stroke;
                    p.style.stroke = strokeColor || 'var(--connector-color)';
                  });
                } catch {}

                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const dataUrl = await toPng(clonedContainer, {
                        quality: 1.0,
                        backgroundColor: themeBackgroundCss,
                        cacheBust: true,
                        filter: () => true
                    });
                    if (format === 'png') {
                        const link = document.createElement('a');
                        link.download = `${sanitizedTitle}.png`;
                        link.href = dataUrl;
                        link.click();
                    } else {
                        const pxToMm = 0.264583;
                        let imgWidthPx = Math.max(exportWidth, 1);
                        let imgHeightPx = Math.max(exportHeight, 1);
                        try {
                          const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => resolve(img);
                            img.onerror = () => reject(new Error('Failed to measure exported image.'));
                            img.src = dataUrl;
                          });
                          imgWidthPx = Math.max(imageEl.naturalWidth || imageEl.width || imgWidthPx, 1);
                          imgHeightPx = Math.max(imageEl.naturalHeight || imageEl.height || imgHeightPx, 1);
                        } catch {
                          // Fall back to the measured export wrapper size if the image fails to load
                        }
                        const orientation = imgWidthPx >= imgHeightPx ? 'landscape' : 'portrait';
                        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const backgroundRgb = themeBackgroundRgb;
                        if (backgroundRgb) {
                          pdf.setFillColor(backgroundRgb[0], backgroundRgb[1], backgroundRgb[2]);
                          pdf.rect(0, 0, pageWidth, pageHeight, 'F');
                        }
                        // Preserve aspect ratio and keep a small safety margin so the map never stretches
                        const marginMm = Math.min(Math.max(marginPx * pxToMm, 0), Math.min(pageWidth, pageHeight) / 2);
                        const imgWidthMm = imgWidthPx * pxToMm;
                        const imgHeightMm = imgHeightPx * pxToMm;
                        const availableWidth = Math.max(pageWidth - marginMm * 2, 1);
                        const availableHeight = Math.max(pageHeight - marginMm * 2, 1);
                        const scale = Math.min(availableWidth / imgWidthMm, availableHeight / imgHeightMm);
                        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
                        const renderW = imgWidthMm * safeScale;
                        const renderH = imgHeightMm * safeScale;
                        const x = (pageWidth - renderW) / 2;
                        const y = (pageHeight - renderH) / 2;
                        pdf.addImage(dataUrl, 'PNG', x, y, renderW, renderH, undefined, 'FAST');
                        pdf.save(`${sanitizedTitle}.pdf`);
                    }
                } catch (error) {
                    console.error('Export failed:', error);
                }
            }
        } finally {
            // Restore original overflow settings
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;

            // Clean up the cloned container
            document.body.removeChild(clonedContainer);
        }
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download mind map. Please try again.');
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
    }, 120000); // 120 seconds

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
      <AuthModal open={showAuthModal} />
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
                          {/* <button
                            type="button"
                            onClick={() => { posthog.capture('mindmap_exported', { format: 'svg' }); handleDownload('svg'); setDropdownOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted rounded-xl focus:outline-none"
                          >
                            <FileImage className="h-4 w-4" /> SVG
                          </button> */}
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

