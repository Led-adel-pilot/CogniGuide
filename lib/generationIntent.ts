export type GenerationIntent = 'mindmap' | 'flashcards';

export const GENERATION_INTENT_KEY = 'cg_generation_intent';

const readFromStorage = (storage: Storage): GenerationIntent | null => {
  const value = storage.getItem(GENERATION_INTENT_KEY);
  if (!value) return null;

  if (value === 'flashcards' || value === 'mindmap') {
    return value;
  }

  try {
    const parsed = JSON.parse(value) as { intent?: unknown };
    if (parsed && (parsed.intent === 'flashcards' || parsed.intent === 'mindmap')) {
      return parsed.intent;
    }
  } catch {}

  return null;
};

export function rememberGenerationIntent(intent: GenerationIntent): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage?.setItem(GENERATION_INTENT_KEY, intent);
  } catch {}

  try {
    window.localStorage?.setItem(
      GENERATION_INTENT_KEY,
      JSON.stringify({ intent, ts: Date.now() })
    );
  } catch {}
}

export function rememberFlashcardIntent(): void {
  rememberGenerationIntent('flashcards');
}

export function getStoredGenerationIntent(): GenerationIntent | null {
  if (typeof window === 'undefined') return null;

  try {
    const fromSession = readFromStorage(window.sessionStorage);
    if (fromSession) return fromSession;
  } catch {}

  try {
    const fromLocal = readFromStorage(window.localStorage);
    if (fromLocal) return fromLocal;
  } catch {}

  return null;
}
