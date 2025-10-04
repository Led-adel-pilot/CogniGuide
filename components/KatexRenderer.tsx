'use client';

import React from 'react';
import { ensureKatexAssets } from '@/lib/katex-loader';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

type KatexWindow = Window & {
  renderMathInElement?: (
    element: HTMLElement,
    options?: {
      delimiters?: Array<{ left: string; right: string; display: boolean }>;
      throwOnError?: boolean;
    },
  ) => void;
};

type Props = {
  content: string;
  className?: string;
  useMarkdown?: boolean;
  markdownComponents?: Components;
};

const KatexRenderer = React.memo<Props>(({ content, className, useMarkdown = false, markdownComponents }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let isCancelled = false;

    ensureKatexAssets()
      .then(() => {
        if (isCancelled) return;
        const katexWindow = window as KatexWindow;
        if (katexWindow.renderMathInElement) {
          katexWindow.renderMathInElement(element, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true },
            ],
            throwOnError: false,
          });
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to render KaTeX', error);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [content]);

  return (
    <div ref={ref} className={className}>
      {useMarkdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      ) : (
        content
      )}
    </div>
  );
});

KatexRenderer.displayName = 'KatexRenderer';

export default KatexRenderer;