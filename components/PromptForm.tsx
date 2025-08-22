'use client';

import { useRef, useLayoutEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface PromptFormProps {
  onSubmit: (promptText: string) => void;
  isLoading: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  disabled: boolean;
  filesLength: number;
  ctaLabel?: string;
}

export default function PromptForm({
  onSubmit,
  isLoading,
  prompt,
  setPrompt,
  disabled,
  filesLength,
  ctaLabel
}: PromptFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isTall, setIsTall] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && !disabled) {
      onSubmit(prompt);
    }
  };

  // Measure and update height + shape synchronously before paint
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset to auto to measure natural content height
    el.style.height = 'auto';

    const scrollH = el.scrollHeight;
    const newHeight = Math.min(scrollH, 200);

    // Apply the new height
    el.style.height = `${newHeight}px`;

    // Use the rendered height to decide the shape so it updates in the same frame
    setIsTall(newHeight > 60);
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim()) {
        onSubmit(prompt);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full flex gap-2 p-2 bg-background border border-border/50 shadow-sm transition-colors ${
        isTall ? 'flex-col rounded-2xl' : 'items-end rounded-full'
      }`}
    >
      <textarea
        id="prompt-input"
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g., 'Create a mind map about the history of AI'"
        className="flex-1 px-3 py-2 bg-transparent border-none resize-none focus:outline-none text-sm leading-relaxed overflow-y-auto"
        style={{
          maxHeight: '200px'
        }}
        rows={1}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || (filesLength === 0 && prompt.trim().length === 0)}
        className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 text-white bg-primary rounded-full shadow hover:bg-primary/90 transition-colors ${
          isTall ? 'self-end' : ''
        }`}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2
              5.291A7.962 7.962 0 014 12H0c0 3.042
              1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <ArrowUp className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}
