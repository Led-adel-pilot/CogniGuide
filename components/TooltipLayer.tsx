"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handlePointerEnter = (event: Event) => {
      const host = findTooltipHost(event.target);
      if (!host) {
        return;
      }

      const text = resolveTooltipText(host);
      if (!text) {
        return;
      }

      activeElementRef.current = host;
      setPosition((prev) => ({ ...prev, ready: false }));
      setTooltip({ text, rect: getRect(host), visible: true });
    };

    const handlePointerLeave = (event: Event) => {
      const current = activeElementRef.current;
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

      activeElementRef.current = null;
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      setPosition((prev) => ({ ...prev, ready: false }));
    };

    const handleFocusIn = (event: FocusEvent) => {
      const host = findTooltipHost(event.target);
      if (!host) {
        return;
      }

      const text = resolveTooltipText(host);
      if (!text) {
        return;
      }

      activeElementRef.current = host;
      setPosition((prev) => ({ ...prev, ready: false }));
      setTooltip({ text, rect: getRect(host), visible: true });
    };

    const handleFocusOut = (event: FocusEvent) => {
      const current = activeElementRef.current;
      if (!current) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!target || !current.contains(target)) {
        return;
      }

      activeElementRef.current = null;
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      setPosition((prev) => ({ ...prev, ready: false }));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        activeElementRef.current = null;
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setPosition((prev) => ({ ...prev, ready: false }));
      }
    };

    document.addEventListener("pointerenter", handlePointerEnter, true);
    document.addEventListener("pointerleave", handlePointerLeave, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerenter", handlePointerEnter, true);
      document.removeEventListener("pointerleave", handlePointerLeave, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    if (!tooltip.visible) {
      return;
    }

    const updateRect = () => {
      if (!activeElementRef.current) {
        return;
      }

      const nextRect = getRect(activeElementRef.current);
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
  }, [tooltip.visible]);

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
      className="pointer-events-none fixed z-[9999] max-w-[min(240px,calc(100vw-2rem))] rounded-md bg-neutral-800 px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity duration-150 dark:bg-black"
      style={{
        left: position.left,
        top: position.top,
        opacity: position.ready ? 1 : 0,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <span className="block break-words text-left leading-snug">{tooltip.text}</span>
    </div>,
    document.body,
  );
}
