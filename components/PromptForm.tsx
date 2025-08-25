// PromptForm.tsx
'use client';

import posthog from 'posthog-js';
import { useRef, useLayoutEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface PromptFormProps {
  onSubmit: (promptText: string) => void;
  isLoading: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  disabled: boolean;
  filesLength: number;
  ctaLabel?: string;
  onInteract?: () => void;
}

export default function PromptForm({
  onSubmit,
  isLoading,
  prompt,
  setPrompt,
  disabled,
  filesLength,
  ctaLabel,
  onInteract,
}: PromptFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && !disabled) {
      posthog.capture('prompt-submitted', {
        prompt_character_count: prompt.length,
        files_count: filesLength,
        submission_method: 'click',
      });
      onSubmit(prompt);
    }
  };

  // Measure and update height + shape synchronously before paint.
  // We avoid React state for the "isTall" flag to prevent a render flicker.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    const formEl = formRef.current;
    if (!el || !formEl) return;

    // Reset height to measure natural content height
    el.style.height = 'auto';
    const scrollH = el.scrollHeight || 0;

    // Cap the height at 200px
    const newHeight = Math.min(scrollH, 200);
    el.style.height = `${newHeight}px`;

    // Synchronously set the border radius so there's no pill -> rectangle animation flicker.
    // Use instant change (no transition on borderRadius) while keeping color/shadow transitions.
    formEl.style.borderRadius = newHeight > 44 ? '1rem' /* rounded-2xl */ : '9999px' /* rounded-full */;
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim()) {
        posthog.capture('prompt-submitted', {
          prompt_character_count: prompt.length,
          files_count: filesLength,
          submission_method: 'enter_key',
        });
        onSubmit(prompt);
      }
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // Note: we avoid `transition-all` to prevent animating border-radius/size.
      className="w-full flex items-end gap-2 p-2 bg-background border border-border/50 shadow-sm transition-colors duration-150"
      // provide an initial radius so first paint is consistent
      style={{ borderRadius: '9999px' }}
    >
      <textarea
        id="prompt-input"
        ref={textareaRef}
        value={prompt}
        onChange={(e) => {
          // Fire interaction hook when the user starts typing
          try {
            if (onInteract && !prompt && e.target.value) onInteract();
          } catch {}
          setPrompt(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="e.g., 'Create a mind map about the history of AI'"
        className="flex-1 px-3 py-2 bg-transparent border-none resize-none focus:outline-none text-sm leading-relaxed overflow-y-auto"
        style={{
          maxHeight: '200px',
        }}
        rows={1}
        disabled={disabled}
        aria-label="Prompt input"
        onFocus={() => {
          // Optionally fire on focus as well, harmless if it opens once
          try { onInteract && onInteract(); } catch {}
        }}
      />
      <button
        type="submit"
        disabled={disabled || (filesLength === 0 && prompt.trim().length === 0)}
        className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 text-white bg-primary rounded-full shadow hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label={ctaLabel ?? 'Send prompt'}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="false"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <ArrowUp className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}
