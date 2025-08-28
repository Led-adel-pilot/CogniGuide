'use client';

import { useEffect, useRef } from 'react';
import { initializeMindMap, cleanup } from '@/lib/markmap-renderer';

interface EmbeddedMindMapProps {
  markdown: string;
}

export default function EmbeddedMindMap({ markdown }: EmbeddedMindMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current && containerRef.current && markdown) {
      initializeMindMap(markdown, viewportRef.current, containerRef.current, {
        disableInteractions: true
      });
    }

    return () => {
      cleanup();
    };
  }, [markdown]);

  return (
    <div ref={viewportRef} className="map-viewport h-full w-full !bg-transparent cursor-default">
      <div ref={containerRef} id="mindmap-container"></div>
    </div>
  );
}
