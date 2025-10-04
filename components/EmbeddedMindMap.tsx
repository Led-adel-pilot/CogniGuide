'use client';

import { useCallback, useEffect, useRef } from 'react';
import { initializeMindMap, cleanup } from '@/lib/markmap-renderer';
import { ensureKatexAssets } from '@/lib/katex-loader';

interface EmbeddedMindMapProps {
  markdown: string;
}

export default function EmbeddedMindMap({ markdown }: EmbeddedMindMapProps) {
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
      disableInteractions: true,
    });
  }, [markdown]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await initialize();
    };

    void run();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [initialize]);

  return (
    <div ref={viewportRef} className="map-viewport h-full w-full !bg-transparent cursor-default">
      <div ref={containerRef} id="mindmap-container"></div>
    </div>
  );
}
