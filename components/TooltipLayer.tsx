"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

type TooltipState = {
  text: string;
  rect: TooltipRect | null;
  visible: boolean;
};

type TooltipPosition = {
  left: number;
  top: number;
  ready: boolean;
};

// Edge padding from viewport and gap to anchor
const EDGE_MARGIN = 8; // keep away from edges
const GAP = 6; // distance between tooltip and anchor
const DEFAULT_SHOW_DELAY = 300; // ms delay before showing a tooltip

export const TOOLTIP_HIDE_EVENT = "cogniguide:hide-tooltips";

export function requestTooltipHide() {
  if (typeof document === "undefined") {
    return;
  }
  document.dispatchEvent(new Event(TOOLTIP_HIDE_EVENT));
}

function getRect(element: HTMLElement): TooltipRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

function findTooltipHost(target: EventTarget | null): HTMLElement | null {
  if (!target) {
    return null;
  }

  let current: Element | null = target instanceof Element ? target : null;

  while (current) {
    if (current instanceof HTMLElement) {
      if (current.dataset.tooltip !== undefined || current.hasAttribute("title")) {
        return current;
      }
    }
    current = current.parentElement;
  }

  return null;
}

function resolveTooltipText(element: HTMLElement): string | null {
  const existing = element.dataset.tooltip;
  if (existing && existing.trim()) {
    return existing.trim();
  }

  const title = element.getAttribute("title");
  if (title && title.trim()) {
    const trimmed = title.trim();
    element.dataset.tooltip = trimmed;
    element.removeAttribute("title");
    return trimmed;
  }

  return null;
}

function resolveTooltipDelay(element: HTMLElement): number {
  const raw = element.dataset.tooltipDelay;
  if (!raw) {
    return DEFAULT_SHOW_DELAY;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_SHOW_DELAY;
}

export default function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState>({ text: "", rect: null, visible: false });
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    ready: false,
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const pendingElementRef = useRef<HTMLElement | null>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearShowTimeout = useCallback(() => {
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  const showTooltip = useCallback((host: HTMLElement, text: string) => {
    activeElementRef.current = host;
    setPosition((prev) => ({ ...prev, ready: false }));
    setTooltip({ text, rect: getRect(host), visible: true });
  }, []);

  const hideTooltip = useCallback(() => {
    pendingElementRef.current = null;
    clearShowTimeout();
    activeElementRef.current = null;
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setPosition((prev) => (prev.ready ? { ...prev, ready: false } : prev));
  }, [clearShowTimeout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const scheduleShow = (host: HTMLElement, text: string) => {
      pendingElementRef.current = host;
      clearShowTimeout();

      const delay = resolveTooltipDelay(host);
      const run = () => {
        showTimeoutRef.current = null;
        if (pendingElementRef.current !== host) {
          return;
        }
        showTooltip(host, text);
      };

      if (delay <= 0) {
        run();
        return;
      }

      showTimeoutRef.current = window.setTimeout(run, delay);
    };

    const handlePointerEnter = (event: Event) => {
      const host = findTooltipHost(event.target);
      if (!host) {
        return;
      }

      const text = resolveTooltipText(host);
      if (!text) {
        return;
      }

      scheduleShow(host, text);
    };

    const handlePointerLeave = (event: Event) => {
      const current = activeElementRef.current ?? pendingElementRef.current;
      if (!current) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }

      if (!current.contains(target)) {
        return;
      }

      const related = (event as PointerEvent).relatedTarget;
      if (related && current.contains(related as Node)) {
        return;
      }

      hideTooltip();
    };

    const handleFocusIn = (event: FocusEvent) => {
      // Only show tooltip on focus if it's a keyboard focus (focus-visible).
      // This prevents tooltips from reappearing when switching tabs if the element
      // was focused via mouse click.
      if (event.target instanceof HTMLElement) {
        try {
          if (!event.target.matches(":focus-visible")) {
            return;
          }
        } catch {
          // Fallback/ignore
        }
      }

      const host = findTooltipHost(event.target);
      if (!host) {
        return;
      }

      const text = resolveTooltipText(host);
      if (!text) {
        return;
      }

      scheduleShow(host, text);
    };

    const handleFocusOut = (event: FocusEvent) => {
      const current = activeElementRef.current ?? pendingElementRef.current;
      if (!current) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!target || !current.contains(target)) {
        return;
      }

      hideTooltip();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideTooltip();
      }
    };

    const handlePointerDown = () => {
      hideTooltip();
    };

    const handleClick = () => {
      hideTooltip();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hideTooltip();
      }
    };

    const handleWindowBlur = () => {
      hideTooltip();
    };

    const handleExternalHide = () => {
      hideTooltip();
    };

    document.addEventListener("pointerenter", handlePointerEnter, true);
    document.addEventListener("pointerleave", handlePointerLeave, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener(TOOLTIP_HIDE_EVENT, handleExternalHide);

    return () => {
      clearShowTimeout();
      pendingElementRef.current = null;
      document.removeEventListener("pointerenter", handlePointerEnter, true);
      document.removeEventListener("pointerleave", handlePointerLeave, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener(TOOLTIP_HIDE_EVENT, handleExternalHide);
    };
  }, [hideTooltip, clearShowTimeout, showTooltip]);

  useEffect(() => {
    if (!tooltip.visible) {
      return;
    }

    const updateRect = () => {
      const element = activeElementRef.current;
      if (!element) {
        return;
      }

      if (!element.isConnected) {
        hideTooltip();
        return;
      }

      const nextRect = getRect(element);
      setTooltip((prev) => (prev.visible ? { ...prev, rect: nextRect } : prev));
    };

    const scheduleUpdate = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(updateRect);
    };

    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("scroll", scheduleUpdate, true);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tooltip.visible, hideTooltip]);

  useLayoutEffect(() => {
    if (!tooltip.visible || !tooltip.rect || !tooltipRef.current) {
      return;
    }

    const tooltipEl = tooltipRef.current;
    const { width: tooltipWidth, height: tooltipHeight } = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const anchorCenter = tooltip.rect.left + tooltip.rect.width / 2;

    // Horizontal placement (center over anchor, clamped)
    let left = anchorCenter - tooltipWidth / 2;
    left = Math.min(
      Math.max(left, EDGE_MARGIN),
      Math.max(EDGE_MARGIN, viewportWidth - tooltipWidth - EDGE_MARGIN),
    );

    // Prefer placing below the anchor; fall back to above if not enough space
    const spaceBelow = viewportHeight - tooltip.rect.bottom - EDGE_MARGIN;
    const spaceAbove = tooltip.rect.top - EDGE_MARGIN;

    let top: number;
    if (tooltipHeight + GAP <= spaceBelow) {
      // Enough room below — preferred
      top = tooltip.rect.bottom + GAP;
    } else if (tooltipHeight + GAP <= spaceAbove) {
      // Not enough below, but enough above
      top = tooltip.rect.top - tooltipHeight - GAP;
    } else {
      // Neither side fits fully; choose side with more space and clamp
      if (spaceBelow >= spaceAbove) {
        top = Math.min(tooltip.rect.bottom + GAP, viewportHeight - tooltipHeight - EDGE_MARGIN);
      } else {
        top = Math.max(tooltip.rect.top - tooltipHeight - GAP, EDGE_MARGIN);
      }
    }

    setPosition({ left, top, ready: true });
  }, [tooltip.visible, tooltip.rect, tooltip.text]);

  if (!mountedRef.current || !tooltip.visible || !tooltip.rect) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-hidden={!tooltip.visible}
      className="pointer-events-none fixed z-[9999] max-w-[min(240px,calc(100vw_-_2rem))] rounded-md bg-neutral-800 px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity duration-150 dark:bg-black"
      style={{
        left: position.left,
        top: position.top,
        opacity: position.ready ? 1 : 0,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <span className="block break-words text-center leading-snug whitespace-pre-line">{tooltip.text}</span>
    </div>,
    document.body,
  );
}
