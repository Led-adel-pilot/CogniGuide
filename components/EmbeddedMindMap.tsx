'use client';

import '@/styles/mindmap.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeMindMap, cleanup } from '@/lib/markmap-renderer';
import type { InitializeOptions } from '@/lib/markmap-renderer';
import { ensureKatexAssets } from '@/lib/katex-loader';

interface AutoFitCenterBias {
  x?: number;
  y?: number;
}

interface EmbeddedMindMapProps {
  markdown: string;
  initialAutoFitScaleMultiplier?: number;
  initialAutoFitCenterBias?: AutoFitCenterBias;
  interactionMode?: InitializeOptions['interactionMode'];
}

export default function EmbeddedMindMap({
  markdown,
  initialAutoFitScaleMultiplier,
  initialAutoFitCenterBias,
  interactionMode = 'pan-only',
}: EmbeddedMindMapProps) {
  const [isLoading, setIsLoading] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialize = useCallback(async () => {
    if (!viewportRef.current || !containerRef.current || !markdown) return;

    try {
      await ensureKatexAssets();
    } catch (error) {
      console.error('Failed to load KaTeX assets for embedded mind map', error);
    }

    if (!viewportRef.current || !containerRef.current) return;

    initializeMindMap(markdown, viewportRef.current, containerRef.current, {
      interactionMode,
      initialAutoFitScaleMultiplier,
      initialAutoFitCenterBias,
    });
  }, [initialAutoFitCenterBias, initialAutoFitScaleMultiplier, interactionMode, markdown]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      setIsLoading(true);
      await initialize();
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [initialize]);

  return (
    <div ref={viewportRef} className="map-viewport h-full w-full cursor-default">
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div
            className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"
            role="status"
            aria-label="Loading mind map"
          />
        </div>
      ) : null}
      <div ref={containerRef} id="mindmap-container"></div>
    </div>
  );
}
