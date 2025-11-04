'use client';

import '@/styles/mindmap.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { initializeMindMap, cleanup, getFullMindMapBounds, updateMindMap, recommendPrintScaleMultiplier, getPrintZoomBias, collapseToMainBranches } from '@/lib/markmap-renderer';
import { ensureKatexAssets } from '@/lib/katex-loader';
import { Download, X, FileImage, Loader2, Map as MapIcon, ChevronLeft } from 'lucide-react';
import ShareTriggerButton from '@/components/ShareTriggerButton';
import { toSvg, toPng } from 'html-to-image';
import { supabase } from '@/lib/supabaseClient';
import posthog from 'posthog-js';
import AuthModal from '@/components/AuthModal';
import jsPDF from 'jspdf';

interface MindMapModalProps {
  markdown: string | null;
  onClose: () => void;
  onShareMindMap?: () => void;
  isPaidUser?: boolean;
  onRequireUpgrade?: () => void;
  embedded?: boolean;
  onBackToFlashcards?: () => void;
  disableSignupPrompts?: boolean;
  streamingRequestId?: number | null;
}

type MindMapStreamEventDetail = {
  requestId: number;
  markdown: string;
  isFinal?: boolean;
  source?: string;
};

export default function MindMapModal({ markdown, onClose, onShareMindMap, isPaidUser = false, onRequireUpgrade, embedded = false, onBackToFlashcards, disableSignupPrompts = false, streamingRequestId = null }: MindMapModalProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const collapseRequestedRef = useRef(false);
  const hasAutoCollapsedRef = useRef(false);

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

                if (format === 'png') {
                  const watermark = document.createElement('div');
                  watermark.textContent = 'CogniGuide';
                  const shorterSide = Math.max(Math.min(exportWidth, exportHeight), 1);
                  const fontSizePx = Math.round(
                    Math.max(Math.min(shorterSide * 0.04, 28), 22)
                  );
                  const offsetPx = Math.round(Math.max(marginPx * 0.6, 18));
                  const [bgR, bgG, bgB] = themeBackgroundRgb;
                  const relativeLuminance =
                    (0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB) / 255;
                  const textColor =
                    relativeLuminance < 0.5
                      ? 'rgba(255, 255, 255, 0.7)'
                      : 'rgba(17, 17, 17, 0.7)';
                  const shadowColor =
                    relativeLuminance < 0.5
                      ? 'rgba(0, 0, 0, 0.3)'
                      : 'rgba(255, 255, 255, 0.4)';
                  watermark.style.position = 'absolute';
                  watermark.style.bottom = `${offsetPx}px`;
                  watermark.style.left = `${offsetPx}px`;
                  watermark.style.fontFamily = "'Poppins', 'Helvetica Neue', Arial, sans-serif";
                  watermark.style.fontWeight = '700';
                  watermark.style.fontSize = `${fontSizePx}px`;
                  watermark.style.color = textColor;
                  watermark.style.opacity = '0.7';
                  watermark.style.letterSpacing = '-0.01em';
                  watermark.style.whiteSpace = 'nowrap';
                  watermark.style.pointerEvents = 'none';
                  watermark.style.userSelect = 'none';
                  watermark.style.lineHeight = '1';
                  watermark.style.textShadow = `0 1px 3px ${shadowColor}`;
                  watermark.style.zIndex = '5';
                  clonedContainer.appendChild(watermark);
                }

                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const pdfPixelRatio = format === 'pdf'
                      ? Math.min(Math.max((window.devicePixelRatio || 1) * 1.5, 1), 1.2)
                      : undefined;
                    const dataUrl = await toPng(clonedContainer, {
                        quality: 1.0,
                        backgroundColor: themeBackgroundCss,
                        cacheBust: true,
                        filter: () => true,
                        ...(pdfPixelRatio ? { pixelRatio: pdfPixelRatio } : {})
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
                        // Add CogniGuide watermark with clickable link in the PDF export
                        const watermarkText = 'Made with CogniGuide';
                        const watermarkFontSize = 8;
                        const watermarkMarginMm = 6;
                        pdf.setTextColor(150, 150, 150);
                        pdf.setFontSize(watermarkFontSize);
                        const watermarkWidth = pdf.getTextWidth(watermarkText);
                        const watermarkX = Math.max(watermarkMarginMm, pageWidth - watermarkMarginMm - watermarkWidth);
                        const watermarkY = pageHeight - watermarkMarginMm;
                        pdf.textWithLink(watermarkText, watermarkX, watermarkY, { url: 'https://cogniguide.app' });
                        pdf.setTextColor(0, 0, 0);
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

  const [userId, setUserId] = useState<string | null>(null);
  const [showLossAversionPopup, setShowLossAversionPopup] = useState(false);
  const [showTimeBasedPopup, setShowTimeBasedPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  // Gate auto-collapse: allow for non-auth users, and for auth users only if they have never generated a mind map before
  const [shouldAutoCollapse, setShouldAutoCollapse] = useState<boolean>(false);
  const shouldAutoCollapseRef = useRef<boolean>(false);
  const collapseRetryTimeoutRef = useRef<number | null>(null);
  const finalizedRequestIdRef = useRef<number | null>(null);
  const latestMarkdownRef = useRef<string | null>(null);
  const throttledUpdateTimeoutRef = useRef<number | null>(null);
  const lastRendererUpdateRef = useRef<number>(0);
  const katexReadyRef = useRef<boolean>(false);
  const ensuringKatexPromiseRef = useRef<Promise<void> | null>(null);
  const renderedMarkdownRef = useRef<string | null>(null);

  const handleClose = (event?: React.MouseEvent) => {
    // Prevent any automatic triggers
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Only show popup if user has generated content and is not authenticated
    if (!disableSignupPrompts && !userId && hasGeneratedContent) {
      setShowLossAversionPopup(true);
    } else {
      onClose();
    }
  };



  const ensureKatexReady = useCallback(async () => {
    if (katexReadyRef.current) return;
    if (ensuringKatexPromiseRef.current) {
      try {
        await ensuringKatexPromiseRef.current;
      } catch {
        // ignore, we'll retry on next invocation
      }
      return;
    }
    ensuringKatexPromiseRef.current = ensureKatexAssets()
      .then(() => {
        katexReadyRef.current = true;
      })
      .catch((error) => {
        console.error('Failed to load KaTeX assets for mind map modal', error);
        katexReadyRef.current = false;
      })
      .finally(() => {
        ensuringKatexPromiseRef.current = null;
      });
    try {
      await ensuringKatexPromiseRef.current;
    } catch {
      // swallow to allow retries later
    }
  }, []);

  const executeRendererUpdate = useCallback(() => {
    if (!viewportRef.current || !containerRef.current) return;
    const content = latestMarkdownRef.current;
    if (!content) return;

    if (renderedMarkdownRef.current === content) {
      return;
    }

    if (!initializedRef.current) {
      initializeMindMap(content, viewportRef.current, containerRef.current);
      initializedRef.current = true;
      setHasGeneratedContent(true);
    } else {
      updateMindMap(content);
    }
    renderedMarkdownRef.current = content;
  }, []);

  const queueRendererUpdate = useCallback(() => {
    if (!viewportRef.current || !containerRef.current) return;

    const invoke = () => {
      void ensureKatexReady().then(() => {
        executeRendererUpdate();
      });
    };

    const THROTTLE_MS = 80;
    const now = performance.now();
    const elapsed = now - lastRendererUpdateRef.current;

    if (elapsed >= THROTTLE_MS) {
      if (throttledUpdateTimeoutRef.current !== null) {
        window.clearTimeout(throttledUpdateTimeoutRef.current);
        throttledUpdateTimeoutRef.current = null;
      }
      lastRendererUpdateRef.current = now;
      invoke();
    } else {
      if (throttledUpdateTimeoutRef.current !== null) {
        window.clearTimeout(throttledUpdateTimeoutRef.current);
      }
      throttledUpdateTimeoutRef.current = window.setTimeout(() => {
        throttledUpdateTimeoutRef.current = null;
        lastRendererUpdateRef.current = performance.now();
        invoke();
      }, THROTTLE_MS - elapsed);
    }
  }, [ensureKatexReady, executeRendererUpdate]);

  useEffect(() => {
    latestMarkdownRef.current = markdown;

    if (!markdown) {
      if (throttledUpdateTimeoutRef.current !== null) {
        window.clearTimeout(throttledUpdateTimeoutRef.current);
        throttledUpdateTimeoutRef.current = null;
      }
      lastRendererUpdateRef.current = 0;
      renderedMarkdownRef.current = null;
      return;
    }
    queueRendererUpdate();
  }, [markdown, queueRendererUpdate]);

  const requestCollapse = useCallback(() => {
    if (!shouldAutoCollapseRef.current) {
      collapseRequestedRef.current = false;
      return;
    }

    if (hasAutoCollapsedRef.current) {
      collapseRequestedRef.current = false;
      return;
    }

    collapseRequestedRef.current = true;

    const attempt = () => {
      if (!collapseRequestedRef.current) return;
      if (!shouldAutoCollapseRef.current) {
        collapseRequestedRef.current = false;
        return;
      }
      if (hasAutoCollapsedRef.current) {
        collapseRequestedRef.current = false;
        return;
      }

      if (!initializedRef.current) {
        if (collapseRetryTimeoutRef.current !== null) {
          window.clearTimeout(collapseRetryTimeoutRef.current);
        }
        collapseRetryTimeoutRef.current = window.setTimeout(() => {
          collapseRetryTimeoutRef.current = null;
          attempt();
        }, 120);
        return;
      }
      try {
        collapseToMainBranches({ animate: false });
        hasAutoCollapsedRef.current = true;
      } catch {}
      collapseRequestedRef.current = false;
    };

    attempt();
  }, []);

  useEffect(() => {
    finalizedRequestIdRef.current = null;
    hasAutoCollapsedRef.current = false;
    if (!streamingRequestId) return;
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<MindMapStreamEventDetail>;
      const detail = customEvent.detail;
      if (!detail || detail.requestId !== streamingRequestId) return;
      if (finalizedRequestIdRef.current !== null && finalizedRequestIdRef.current === detail.requestId) return;
      latestMarkdownRef.current = detail.markdown;
      queueRendererUpdate();
      if (detail.isFinal) {
        finalizedRequestIdRef.current = detail.requestId;
        if (!embedded) {
          requestCollapse();
        }
      }
    };

    window.addEventListener('cogniguide:mindmap-stream-update', handler);
    return () => {
      window.removeEventListener('cogniguide:mindmap-stream-update', handler);
      if (collapseRetryTimeoutRef.current !== null) {
        window.clearTimeout(collapseRetryTimeoutRef.current);
        collapseRetryTimeoutRef.current = null;
      }
    };
  }, [streamingRequestId, queueRendererUpdate, requestCollapse, embedded]);

  // Reset renderer when modal is closed (markdown becomes null)
  useEffect(() => {
    if (!markdown) {
      hasAutoCollapsedRef.current = false;
      initializedRef.current = false;
      setHasGeneratedContent(false);
      setShowLossAversionPopup(false);
      setShowTimeBasedPopup(false);
      // Reset collapse request state so future generations don't inherit it
      collapseRequestedRef.current = false;
      if (collapseRetryTimeoutRef.current !== null) {
        window.clearTimeout(collapseRetryTimeoutRef.current);
        collapseRetryTimeoutRef.current = null;
      }
      cleanup();
    }
  }, [markdown]);

  // Timer for time-based signup popup for non-auth users
  useEffect(() => {
    if (!markdown || userId || showTimeBasedPopup || disableSignupPrompts) return;

    const timer = setTimeout(() => {
      setShowTimeBasedPopup(true);
    }, 120000); // 120 seconds

    return () => clearTimeout(timer);
  }, [markdown, userId, showTimeBasedPopup, disableSignupPrompts]);

  useEffect(() => {
    return () => {
      if (throttledUpdateTimeoutRef.current !== null) {
        window.clearTimeout(throttledUpdateTimeoutRef.current);
        throttledUpdateTimeoutRef.current = null;
      }
      if (collapseRetryTimeoutRef.current !== null) {
        window.clearTimeout(collapseRetryTimeoutRef.current);
        collapseRetryTimeoutRef.current = null;
      }
      initializedRef.current = false;
      cleanup();
    };
  }, []);

  // Collapse to main branches when mindmap stream completes
  useEffect(() => {
    if (embedded) return;

    const onComplete = () => {
      requestCollapse();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('cogniguide:mindmap-stream-complete', onComplete);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('cogniguide:mindmap-stream-complete', onComplete);
      }
      if (collapseRetryTimeoutRef.current !== null) {
        window.clearTimeout(collapseRetryTimeoutRef.current);
        collapseRetryTimeoutRef.current = null;
      }
    };
  }, [embedded, requestCollapse]);

  // If initialization happens after completion event, apply collapse immediately
  useEffect(() => {
    if (embedded) return;
    if (!markdown) return;
    if (!collapseRequestedRef.current) return;
    requestCollapse();
  }, [markdown, embedded, requestCollapse]);

  // Determine whether auto-collapse should be enabled for this user
  useEffect(() => {
    let cancelled = false;

    if (embedded) {
      setShouldAutoCollapse(false);
      shouldAutoCollapseRef.current = false;
      return () => {
        cancelled = true;
      };
    }

    const computeAutoCollapse = async () => {
      if (!userId) {
        if (!cancelled) {
          setShouldAutoCollapse(true);
          shouldAutoCollapseRef.current = true;
        }
        return;
      }
      const cacheKey = `cogniguide:user:${userId}:hasPriorMindmap`;
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
  }, [userId, embedded]);

  // Detect authenticated user for signup prompts
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





  if (!markdown) {
    return null;
  }

  const rootClassName = embedded
    ? 'relative flex flex-col w-full h-full font-sans'
    : 'fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[100] p-1 font-sans';
  const rootStyle = embedded ? undefined : { backgroundColor: 'var(--color-background)' };
  const containerClassName = 'relative w-full h-full rounded-[1.5rem] border border-border ring-1 ring-black/5 shadow-2xl shadow-[0_10px_25px_rgba(0,0,0,0.12),0_25px_70px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden';

  return (
    <>
      <style jsx global>{`
        #mindmap-container mark {
          background-color: rgba(255, 230, 35, 0.55);
          color: inherit;
          border-radius: 0.25em;
          padding: 0 0.15em;
          box-shadow: 0 0 0 0.1em rgba(255, 225, 35, 0.55);
        }
      `}</style>
      <AuthModal open={showAuthModal} />
      <div className={rootClassName} style={rootStyle}>
        <div className={containerClassName} style={{ backgroundColor: 'var(--color-background)' }}>
          <div className="absolute top-2 right-2 z-30 group inline-flex items-center gap-1.5">
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

            {onShareMindMap && (
              <ShareTriggerButton
                onClick={onShareMindMap}
                className="opacity-100 translate-x-0 transition-all duration-200 ease-in-out"
              />
            )}
            {!userId && !disableSignupPrompts && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center justify-center h-8 px-4 text-sm font-medium text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 focus:outline-none opacity-100 translate-x-0 transition-all duration-200 ease-in-out"
                style={{ backgroundColor: 'var(--color-background)' }}
                aria-label="Sign up"
              >
                Sign up
              </button>
            )}

            {onBackToFlashcards ? (
              <button
                onClick={onBackToFlashcards}
                className="inline-flex items-center justify-center w-8 h-8 text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 focus:outline-none opacity-100 translate-x-0 transition-all duration-200 ease-in-out"
                style={{ backgroundColor: 'var(--color-background)' }}
                aria-label="Back to flashcards"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center w-8 h-8 text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 focus:outline-none opacity-100 translate-x-0 transition-all duration-200 ease-in-out"
                style={{ backgroundColor: 'var(--color-background)' }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="w-full h-full relative">
            <div
              ref={viewportRef}
              className="map-viewport w-full h-full flex-grow z-0"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              <div ref={containerRef} id="mindmap-container" />
            </div>
          </div>
        </div>

        {showLossAversionPopup && !disableSignupPrompts && (
          <div className="absolute inset-0 flex items-center justify-center z-[110]">
            {/* Black transparent background */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
            <div className="border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10" style={{ backgroundColor: 'var(--color-background)' }}>
              <h2 className="text-2xl font-bold mb-4">Don't Lose Your Mind Map!</h2>
              <p className="text-muted-foreground mb-6">
                Sign up to save your mind map and access it anytime, anywhere.
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

        {showTimeBasedPopup && !disableSignupPrompts && (
          <div className="absolute inset-0 flex items-center justify-center z-[110]">
            {/* Black transparent background */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
            <div className="border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10" style={{ backgroundColor: 'var(--color-background)' }}>
              <h2 className="text-2xl font-bold mb-4">Sign Up to Save Your Mind Map!</h2>
              <p className="text-muted-foreground mb-6">
                Sign up to continue reading and save your mind map.
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
