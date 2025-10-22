'use client';

import React from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import { nextSchedule, createInitialSchedule, type FsrsScheduleState, type Grade } from '@/lib/spaced-repetition';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync } from '@/lib/sr-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ChevronLeft, ChevronRight, Eye, Loader2, X } from 'lucide-react';
import posthog from 'posthog-js';
import { DatePicker } from '@/components/DatePicker';
import { ensureKatexAssets } from '@/lib/katex-loader';
import ShareTriggerButton from '@/components/ShareTriggerButton';

const getDeckIdentifier = (deckId?: string, title?: string | null, cards?: Flashcard[] | null): string | null => {
  if (deckId) return deckId;
  if (cards && cards.length > 0) {
    const deckTitle = title || 'Untitled Deck';
    const cardCount = cards.length;
    const firstQ = cards[0].question.substring(0, 20);
    const lastQ = cards[cards.length - 1].question.substring(0, 20);
    return `unsaved:${deckTitle}:${cardCount}:${firstQ}:${lastQ}`;
  }
  return null;
};

export type Flashcard = { question: string; answer: string };
type CardWithSchedule = Flashcard & { schedule?: FsrsScheduleState; deckId?: string; cardIndex?: number; deckTitle?: string; };

const markdownComponents: Components = {
  ul({ node, ...props }) {
    void node;
    return <ul className="list-disc list-inside pl-4 my-2 space-y-1" {...props} />;
  },
  ol({ node, ...props }) {
    void node;
    return <ol className="list-decimal list-inside pl-4 my-2 space-y-1" {...props} />;
  },
  li({ node, ...props }) {
    void node;
    return <li className="leading-6" {...props} />;
  },
  p({ node, ...props }) {
    void node;
    return <p className="my-2 leading-6" {...props} />;
  },
};

type AutoRenderDelimiter = { left: string; right: string; display: boolean };
type AutoRenderOptions = { delimiters: AutoRenderDelimiter[]; throwOnError: boolean };
type RenderMathInElement = (element: HTMLElement, options: AutoRenderOptions) => void;
type KatexRenderOptions = { throwOnError?: boolean; displayMode?: boolean };
type KatexRenderer = { render?: (expression: string, element: HTMLElement, options?: KatexRenderOptions) => void };
type KatexLikeWindow = Window & { renderMathInElement?: RenderMathInElement; katex?: KatexRenderer };

const MATH_DELIMITER_PATTERN = /\$|\\\(|\\\[|\\begin\{/;
const UNDELIMITED_MATH_HINT_PATTERN = /(?:[_^]|\\[a-zA-Z]+)/;
const BLOCK_MATH_TAGS = new Set(['DIV', 'LI', 'P', 'TD', 'TH']);

const tryRenderUndelimitedMath = (element: HTMLElement, katex: KatexRenderer) => {
  if (!katex?.render) return;
  if (element.querySelector('.katex')) return;
  if (element.childNodes.length !== 1) return;

  const [childNode] = Array.from(element.childNodes);
  if (!childNode || childNode.nodeType !== Node.TEXT_NODE) return;

  const text = childNode.textContent?.trim() ?? '';
  if (!text) return;
  if (MATH_DELIMITER_PATTERN.test(text)) return;
  if (!UNDELIMITED_MATH_HINT_PATTERN.test(text)) return;

  try {
    katex.render(text, element, {
      throwOnError: false,
      displayMode: BLOCK_MATH_TAGS.has(element.tagName),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to render un-delimited KaTeX content in flashcards', error);
    }
  }
};

type Props = {
  open: boolean;
  title?: string | null;
  cards: Flashcard[] | null;
  isGenerating?: boolean;
  error?: string | null;
  onClose: () => void;
  onReviewDueCards?: (indices: number[]) => void;
  deckId?: string; // id from DB record when opened from history
  initialIndex?: number;
  studyDueOnly?: boolean;
  studyInterleaved?: boolean;
  interleavedDecks?: Array<{ id: string; title: string | null; cards: Flashcard[] }>;
  dueIndices?: number[];
  isEmbedded?: boolean;
  onShare?: () => void;
};

export default function FlashcardsModal({ open, title, cards, isGenerating = false, error, onClose, onReviewDueCards, deckId, initialIndex, studyDueOnly = false, studyInterleaved = false, interleavedDecks, dueIndices, isEmbedded = false, onShare }: Props) {
  const [index, setIndex] = React.useState(0);
  const [showAnswer, setShowAnswer] = React.useState(false);
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [explanation, setExplanation] = React.useState('');
  const [isExplaining, setIsExplaining] = React.useState(false);
  const [explanationError, setExplanationError] = React.useState<string | null>(null);
  const [scheduledCards, setScheduledCards] = React.useState<CardWithSchedule[] | null>(null);
  const [deckExamDate, setDeckExamDate] = React.useState<string>('');
  const [examDateInput, setExamDateInput] = React.useState<Date | undefined>(undefined);
  const [dueList, setDueList] = React.useState<number[]>([]);
  const [dueNowIndices, setDueNowIndices] = React.useState<number[]>([]);
  const [immediateReviewIndices, setImmediateReviewIndices] = React.useState<number[]>([]);
  const [predictedDueByGrade, setPredictedDueByGrade] = React.useState<Record<number, string>>({});
  const [finished, setFinished] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [isCurrentDeckExamReady, setIsCurrentDeckExamReady] = React.useState(!studyInterleaved);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [showLossAversionPopup, setShowLossAversionPopup] = React.useState(false);
  const [showSignupPopup, setShowSignupPopup] = React.useState(false);
  const [showExamDatePopup, setShowExamDatePopup] = React.useState(false);
  const [, setCardsViewedCount] = React.useState(0);
  const [answerShownTime, setAnswerShownTime] = React.useState<number | null>(null);
  const [originalDueCount, setOriginalDueCount] = React.useState(0);
  const [originalDueList, setOriginalDueList] = React.useState<number[]>([]);
  const explainRequestRef = React.useRef(0);
  const current = scheduledCards && scheduledCards[index] ? scheduledCards[index] : null;

  const hasCards = Boolean(cards && cards.length > 0);

  const questionContent = cards && cards[index] ? cards[index]!.question : '';
  const answerContent = cards && cards[index] ? cards[index]!.answer : '';

  const questionRef = React.useRef<HTMLDivElement | null>(null);
  const answerRef = React.useRef<HTMLDivElement | null>(null);

  const resetExplanation = React.useCallback(() => {
    explainRequestRef.current += 1;
    setShowExplanation(false);
    setExplanation('');
    setExplanationError(null);
    setIsExplaining(false);
  }, []);

  const handleExplain = React.useCallback(async () => {
    if (!questionContent || !answerContent) return;
    const requestId = explainRequestRef.current + 1;
    explainRequestRef.current = requestId;
    setShowExplanation(true);
    setExplanation('');
    setExplanationError(null);
    setIsExplaining(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      // Determine deck title: use current card's deckTitle if in interleaved mode, otherwise use the modal's title prop
      const deckTitleToSend = studyInterleaved && current?.deckTitle ? current.deckTitle : title;
      const response = await fetch('/api/explain-flashcard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          question: questionContent, 
          answer: answerContent,
          deckTitle: deckTitleToSend 
        }),
      });
      if (explainRequestRef.current !== requestId) return;
      if (!response.ok) {
        let message = 'Failed to generate explanation.';
        try {
          const payload = await response.json();
          if (payload && typeof payload.message === 'string' && payload.message.trim()) {
            message = payload.message;
          }
        } catch {}
        throw new Error(message);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Unable to read response stream.');
      }

      let accumulatedText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (explainRequestRef.current !== requestId) {
          reader.cancel();
          return;
        }
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        // Prepend the question in bold format to the explanation
        const fullExplanation = `**${questionContent}**\n\n${accumulatedText}`;
        setExplanation(fullExplanation);
      }

      if (!accumulatedText.trim()) {
        throw new Error('Explanation unavailable.');
      }
    } catch (error) {
      if (explainRequestRef.current !== requestId) return;
      setExplanationError(error instanceof Error ? error.message : 'Failed to generate explanation.');
      setShowExplanation(false);
    } finally {
      if (explainRequestRef.current === requestId) {
        setIsExplaining(false);
      }
    }
  }, [answerContent, questionContent, studyInterleaved, current, title]);

  const handleExplanationBack = React.useCallback(() => {
    resetExplanation();
    setShowAnswer(true);
  }, [resetExplanation]);

  const renderMath = React.useCallback((isCancelled?: () => boolean) => {
    if (typeof window === 'undefined') return;

    ensureKatexAssets()
      .then(() => {
        if (isCancelled?.()) return;

        const renderMathInElement = (window as KatexLikeWindow).renderMathInElement;
        if (typeof renderMathInElement !== 'function') return;

        const options: AutoRenderOptions = {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true },
          ],
          throwOnError: false,
        };

        const applyRender = (element: HTMLElement | null) => {
          if (!element) return;
          element.removeAttribute('data-processed');
          element.querySelectorAll('[data-processed="true"]').forEach((node) => {
            node.removeAttribute('data-processed');
          });
          renderMathInElement(element, options);
          const katex = (window as KatexLikeWindow).katex;
          if (katex?.render) {
            const elementsToCheck: HTMLElement[] = [element];
            element.querySelectorAll<HTMLElement>('p, li, div, span, td, th').forEach((node) => {
              elementsToCheck.push(node);
            });
            elementsToCheck.forEach((node) => {
              tryRenderUndelimitedMath(node, katex);
            });
          }
        };

        applyRender(questionRef.current);
        if (isCancelled?.()) return;
        applyRender(answerRef.current);
      })
      .catch((error) => {
        console.error('Failed to load KaTeX assets for flashcards', error);
      });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      renderMath(() => cancelled);
    };

    const id = window.requestAnimationFrame(run);
    const timeout = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
      window.clearTimeout(timeout);
    };
  });

  React.useEffect(() => {
    resetExplanation();
  }, [index, questionContent, answerContent, resetExplanation]);

  const deckIdentifier = React.useMemo(() => getDeckIdentifier(deckId, title, cards), [deckId, title, cards]);

  React.useEffect(() => {
    if (open && deckIdentifier) {
      const savedIndexStr = localStorage.getItem(`cogniguide:flashcard-progress:${deckIdentifier}`);
      if (savedIndexStr) {
        const savedIndex = parseInt(savedIndexStr, 10);
        if (!isNaN(savedIndex) && cards && savedIndex >= 0 && savedIndex < cards.length) {
          if (typeof initialIndex !== 'number') {
            setIndex(savedIndex);
          }
        }
      }
    }
  }, [open, deckIdentifier, cards, initialIndex]);

  React.useEffect(() => {
    if (deckIdentifier && hasCards) {
      localStorage.setItem(`cogniguide:flashcard-progress:${deckIdentifier}`, String(index));
    }
  }, [deckIdentifier, index, hasCards]);

  const handleClose = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Show popup only if user is not signed in, has generated cards, and is not viewing a saved deck
    if (!userId && !deckId && cards && cards.length > 0) {
      setShowLossAversionPopup(true);
    } else {
      onClose();
    }
  };

  React.useEffect(() => {
    if (!open) {
      setIndex(0);
      setShowAnswer(false);
      resetExplanation();
      setPredictedDueByGrade({});
      setFinished(false);
      setShowLossAversionPopup(false);
      setShowSignupPopup(false);
      setShowExamDatePopup(false);
      setCardsViewedCount(0);
      setAnswerShownTime(null);
      setDueNowIndices([]);
      setImmediateReviewIndices([]);
    }
  }, [open, resetExplanation]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    setImmediateReviewIndices([]);
    if (!cards || cards.length === 0) {
      setScheduledCards(null);
      return;
    }

    let cancelled = false;

    const initializeSchedules = async () => {
      // Try load stored schedule by deckId; fallback to fresh
      if (deckId && !studyInterleaved) {
        let stored = (await loadDeckScheduleAsync(deckId)) || loadDeckSchedule(deckId);
        if (stored?.isCancelled) {
          const revived = { ...stored, isCancelled: false };
          saveDeckSchedule(deckId, revived);
          saveDeckScheduleAsync(deckId, revived).catch((err) => {
            console.error(`Failed to clear cancellation flag for deck ${deckId}:`, err);
          });
          stored = revived;
        }
        if (!cancelled && stored && Array.isArray(stored.schedules) && stored.schedules.length === cards.length) {
          let finalExamDate = stored.examDate || '';
          if (finalExamDate) {
            let exam;
            if (finalExamDate.includes('T')) exam = new Date(finalExamDate);
            else exam = new Date(finalExamDate + 'T23:59:59');
            const twentyFourHoursAfterExam = new Date(exam.getTime() + 24 * 60 * 60 * 1000);
            if (new Date() > twentyFourHoursAfterExam) {
              finalExamDate = ''; // Clear if more than 24h past
            }
          }

          setDeckExamDate(finalExamDate);
          setExamDateInput(finalExamDate ? new Date(finalExamDate) : undefined);
          const schedules = stored.schedules ?? [];
          setScheduledCards(
            cards.map((c, i) => ({
              ...c,
              schedule: { ...(schedules[i] || createInitialSchedule()), examDate: finalExamDate },
            })),
          );

          if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
            setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
            setShowAnswer(false);
            resetExplanation();
          }
          // Initialize due list from props if provided
          const initialDueList = Array.isArray(dueIndices) ? dueIndices.slice() : [];
          setDueList(initialDueList);
          setOriginalDueList(initialDueList);
          setOriginalDueCount(initialDueList.length);
          return;
        }
      }

      if (studyInterleaved) {
        const typedCards = cards as CardWithSchedule[];
        const uniqueDeckIds = Array.from(
          new Set(
            typedCards
              .map((card) => card.deckId)
              .filter((value): value is string => typeof value === 'string' && value.length > 0),
          ),
        );

        const deckSchedules = new Map<string, ReturnType<typeof loadDeckSchedule> | Awaited<ReturnType<typeof loadDeckScheduleAsync>>>();

        await Promise.all(
          uniqueDeckIds.map(async (sourceDeckId) => {
            if (cancelled) return;
            let stored = loadDeckSchedule(sourceDeckId);
            if (!stored) {
              stored = await loadDeckScheduleAsync(sourceDeckId);
            }
            if (!cancelled && stored) {
              deckSchedules.set(sourceDeckId, stored);
            }
          }),
        );

        if (cancelled) return;

        const normalized = typedCards.map((card) => {
          const sourceDeckId = card.deckId;
          const sourceIndex = typeof card.cardIndex === 'number' ? card.cardIndex : undefined;
          let schedule: FsrsScheduleState | undefined;
          if (sourceDeckId && typeof sourceIndex === 'number') {
            const stored = deckSchedules.get(sourceDeckId);
            const storedSchedules = stored?.schedules ?? [];
            if (storedSchedules[sourceIndex]) {
              schedule = storedSchedules[sourceIndex] as FsrsScheduleState;
            }
          }
          return {
            ...card,
            schedule: schedule ?? createInitialSchedule(),
          };
        });

        if (cancelled) return;

        setDeckExamDate('');
        setExamDateInput(undefined);
        setScheduledCards(normalized);
        if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
          setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
          setShowAnswer(false);
          resetExplanation();
        }
        const initialDueList = Array.isArray(dueIndices) ? dueIndices.slice() : [];
        setDueList(initialDueList);
        setOriginalDueList(initialDueList);
        setOriginalDueCount(initialDueList.length);
        return;
      }

      if (!cancelled) {
        // For unsaved decks or when no stored schedule was found
        setScheduledCards(cards.map((c) => ({ ...c, schedule: createInitialSchedule() })));
        if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
          setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
          setShowAnswer(false);
          resetExplanation();
        }
        const initialDueList = Array.isArray(dueIndices) ? dueIndices.slice() : [];
        setDueList(initialDueList);
        setOriginalDueList(initialDueList);
        setOriginalDueCount(initialDueList.length);
      }
    };

    void initializeSchedules();

    return () => {
      cancelled = true;
    };
  }, [cards, deckId, initialIndex, dueIndices, title, studyInterleaved, resetExplanation]);

  React.useEffect(() => {
    if (!deckId || !scheduledCards || studyInterleaved) return;
    const payload = {
      examDate: deckExamDate || undefined,
      schedules: scheduledCards.map((c) => c.schedule),
      isCancelled: false,
    };
    // Save remotely when possible; always mirror to local as fallback
    saveDeckSchedule(deckId, payload);
    saveDeckScheduleAsync(deckId, payload).catch((err) => {
      console.error(`Failed to save deck schedule async for deck ${deckId}:`, err);
    });
  }, [deckId, scheduledCards, deckExamDate, studyInterleaved]);

  // Predict next due labels per grade once the answer is shown
  React.useEffect(() => {
    if (!showAnswer || !current) {
      setPredictedDueByGrade({});
      return;
    }

    const predict = async () => {
      const now = new Date();
      const base = current.schedule ?? createInitialSchedule();
      let examDate: string | undefined = deckExamDate || base.examDate;

      if (studyInterleaved && current.deckId) {
        const stored = await loadDeckScheduleAsync(current.deckId);
        examDate = stored?.examDate;
      }

      const withDeckExam = { ...base, examDate } as FsrsScheduleState;
      const map: Record<number, string> = {};
      const grades = [1, 2, 3, 4] as Grade[];
      for (const g of grades) {
        const s = nextSchedule(withDeckExam, g, now);
        const due = new Date(s.due);
        map[g as number] = formatTimeUntil(due, now);
      }
      setPredictedDueByGrade(map);
    };

    predict();
  }, [showAnswer, current, deckExamDate, studyInterleaved]);

  const currentDeckId = current?.deckId;
  const currentScheduleExamDate = current?.schedule?.examDate;

  React.useEffect(() => {
    if (!studyInterleaved) {
      setIsCurrentDeckExamReady(true);
      return;
    }

    let cancelled = false;
    setIsCurrentDeckExamReady(false);

    const applyExamDate = (value?: string) => {
      if (cancelled) return;

      if (value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          setDeckExamDate((prev) => (prev === value ? prev : value));
          setExamDateInput((prev) => {
            if (prev && prev.getTime() === parsed.getTime()) {
              return prev;
            }
            return parsed;
          });
          return;
        }
      }

      setDeckExamDate((prev) => (prev === '' ? prev : ''));
      setExamDateInput((prev) => (prev === undefined ? prev : undefined));
    };

    if (!currentDeckId) {
      applyExamDate(undefined);
      setIsCurrentDeckExamReady(true);
      return () => {
        cancelled = true;
      };
    }

    const localStored = loadDeckSchedule(currentDeckId);
    const initialExamDate = localStored?.examDate || currentScheduleExamDate;
    applyExamDate(initialExamDate);
    if (localStored || currentScheduleExamDate) {
      setIsCurrentDeckExamReady(true);
    }

    (async () => {
      try {
        const stored = await loadDeckScheduleAsync(currentDeckId);
        if (cancelled) return;
        const resolvedExamDate = stored?.examDate || currentScheduleExamDate;
        applyExamDate(resolvedExamDate);
      } finally {
        if (!cancelled) {
          setIsCurrentDeckExamReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studyInterleaved, currentDeckId, currentScheduleExamDate]);

  React.useEffect(() => {
    if (!finished || !scheduledCards || scheduledCards.length === 0 || studyInterleaved) {
      setDueNowIndices([]);
      return;
    }

    const now = Date.now();
    const newlyDue = scheduledCards.reduce<number[]>((acc, card, idx) => {
      const dueValue = card.schedule?.due;
      if (!dueValue) return acc;
      const dueTime = new Date(dueValue).getTime();
      if (!Number.isNaN(dueTime) && dueTime <= now) {
        acc.push(idx);
      }
      return acc;
    }, []);

    const combined = [...new Set([...newlyDue, ...immediateReviewIndices])].sort((a, b) => a - b);
    setDueNowIndices(combined);
  }, [finished, scheduledCards, studyInterleaved, immediateReviewIndices]);

  function formatTimeUntil(dueDate: Date, now: Date = new Date()): string {
    const ms = Math.max(0, dueDate.getTime() - now.getTime());
    const minute = 60_000;
    const hour = 3_600_000;
    const day = 86_400_000;
    if (ms < minute) return '<1m';
    if (ms < hour) return `<${Math.ceil(ms / minute)}m`;
    if (ms < day) return `<${Math.ceil(ms / hour)}h`;
    const days = Math.ceil(ms / day);
    if (days < 30) return `${days}d`;
    const months = Math.ceil(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.ceil(months / 12);
    return `${years}y`;
  }

  const handleSetDeckExamDate = (dateTimeValue?: Date) => {
    const dateTime = dateTimeValue || examDateInput;

    if (studyInterleaved && current?.deckId) {
      const sourceDeckId = current.deckId;
      (async () => {
        const stored = await loadDeckScheduleAsync(sourceDeckId);
        const schedules = stored?.schedules || interleavedDecks?.find(d => d.id === sourceDeckId)?.cards.map(() => createInitialSchedule()) || [];
        const newPayload = { examDate: dateTime?.toISOString(), schedules, isCancelled: false };
        await saveDeckScheduleAsync(sourceDeckId, newPayload);
        saveDeckSchedule(sourceDeckId, newPayload); // Also update local cache
      })();
      return;
    }

    if (dateTime) {
      const isoString = dateTime.toISOString();
      setDeckExamDate(isoString);
      // Also copy this onto existing schedules so clamping works immediately
      setScheduledCards((prev) => prev ? prev.map((c) => ({ ...c, schedule: { ...(c.schedule ?? createInitialSchedule()), examDate: isoString } })) : prev);
    } else {
      // Handle clearing the date
      setDeckExamDate('');
      setScheduledCards((prev) => prev ? prev.map((c) => ({ ...c, schedule: { ...(c.schedule ?? createInitialSchedule()), examDate: undefined } })) : prev);
    }
  };

  const hasExamDatePopupBeenShown = (deckIdentifier: string | null): boolean => {
    if (!deckIdentifier) return false;
    const shownPopups = JSON.parse(localStorage.getItem('cogniguide:exam_date_popups_shown') || '[]');
    return shownPopups.includes(deckIdentifier);
  };

  const markExamDatePopupAsShown = (deckIdentifier: string | null) => {
    if (!deckIdentifier) return;
    const shownPopups = JSON.parse(localStorage.getItem('cogniguide:exam_date_popups_shown') || '[]');
    if (!shownPopups.includes(deckIdentifier)) {
      shownPopups.push(deckIdentifier);
      localStorage.setItem('cogniguide:exam_date_popups_shown', JSON.stringify(shownPopups));
    }
  };

  const handleGrade = (g: Grade) => {
    // Prevent accidental clicks immediately after showing answer
    if (answerShownTime && Date.now() - answerShownTime < 200) {
      return;
    }

    const cardIndex = index;

    if (studyInterleaved && current?.deckId && typeof current?.cardIndex === 'number') {
      // Interleaved: update the source deck's schedule
      const sourceDeckId = current.deckId;
      const sourceCardIndex = current.cardIndex;
      const sourceDeck = interleavedDecks?.find(d => d.id === sourceDeckId);
      if (!sourceDeck) return;

      const stored = loadDeckSchedule(sourceDeckId);
      const originalSchedule = stored?.schedules[sourceCardIndex] || createInitialSchedule();
      const examDate = stored?.examDate;
      const scheduleWithExam = { ...originalSchedule, examDate };

      const newSchedule = nextSchedule(scheduleWithExam, g, new Date());

      // Update in local storage
      const newSchedules = [...(stored?.schedules || sourceDeck.cards.map(() => createInitialSchedule()))];
      newSchedules[sourceCardIndex] = newSchedule;
      const payload = { examDate: newSchedule.examDate, schedules: newSchedules, isCancelled: false };
      saveDeckSchedule(sourceDeckId, payload);
      saveDeckScheduleAsync(sourceDeckId, payload);

      posthog.capture('flashcard_graded', {
        deckId: sourceDeckId,
        card_index: sourceCardIndex,
        grade: g,
        study_due_only: studyDueOnly,
        study_interleaved: studyInterleaved,
        next_due_date: newSchedule.due,
      });

    } else {
      setScheduledCards((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        const item = { ...next[cardIndex] };
        const base = item.schedule ?? createInitialSchedule();
        // Ensure deck-level examDate is applied
        const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
        const newSchedule = nextSchedule(withDeckExam, g, new Date());

        // Check if card should be reviewed immediately
        const dueTime = new Date(newSchedule.due).getTime();
        const shouldReviewImmediately = !Number.isNaN(dueTime) && dueTime <= Date.now();

        item.schedule = newSchedule;
        next[cardIndex] = item;

        if (deckId && newSchedule.examDate !== deckExamDate) {
          setDeckExamDate(newSchedule.examDate || '');
        }

        posthog.capture('flashcard_graded', {
          deckId: deckId,
          card_index: cardIndex,
          grade: g,
          study_due_only: studyDueOnly,
          study_interleaved: studyInterleaved,
          next_due_date: newSchedule.due,
        });

        // Handle immediate review logic
        setImmediateReviewIndices((prevIndices) => {
          const filtered = prevIndices.filter((i) => i !== cardIndex);
          if (shouldReviewImmediately) {
            return [...filtered, cardIndex].sort((a, b) => a - b);
          }
          return filtered;
        });

        return next;
      });
    }
    setShowAnswer(false);
    resetExplanation();
    setPredictedDueByGrade({});
    setAnswerShownTime(null);
    // If studying due-only, remove current index from due list and move to next due
    if (studyDueOnly) {
      setDueList((list) => {
        if (!studyDueOnly) return list;
        const currentPos = list.indexOf(index);
        const filtered = list.filter((i) => i !== index);
        if (filtered.length > 0) {
          // Maintain forward progression: move to the next card in sequence
          // If we were at position P in the original list, move to position P in the filtered list
          // If P is beyond the filtered list length, wrap to the beginning
          const nextPos = currentPos < filtered.length ? currentPos : 0;
          setIndex(filtered[nextPos]);
        } else {
          // We've completed all due cards
          setFinished(true);
        }
        return filtered;
      });
    }
    if (!studyDueOnly && scheduledCards && scheduledCards.length > 0) {
      const nextIndex = (index + 1) % scheduledCards.length;
      if (nextIndex === 0) {
        // We've completed the full deck
        setFinished(true);
      } else {
        setIndex(nextIndex);
      }
    }
  };

  const getNextIndex = () => {
    if (studyDueOnly && dueList.length > 0) {
      const pos = dueList.indexOf(index);
      const nextPos = (pos + 1) % dueList.length;
      if (nextPos === 0 && !studyInterleaved) {
        // We've completed all due cards
        setFinished(true);
        return index; // Stay on current card
      }
      return dueList[nextPos];
    }
    if (scheduledCards && scheduledCards.length > 0) {
      const nextIndex = (index + 1) % scheduledCards.length;
      if (nextIndex === 0) {
        // We've completed the full deck
        setFinished(true);
        return nextIndex; // Return the next index (0)
      } else {
        setIndex(nextIndex);
        return nextIndex;
      }
    }
    return index;
  };
  const getPrevIndex = () => {
    if (studyDueOnly && dueList.length > 0) {
      const pos = dueList.indexOf(index);
      const prevPos = (pos - 1 + dueList.length) % dueList.length;
      return dueList[prevPos];
    }
    if (scheduledCards && scheduledCards.length > 0) return (index - 1 + scheduledCards.length) % scheduledCards.length;
    return index;
  };

  if (!open && !isEmbedded) return null;

  const ModalContent = () => {
    const dueAgainCount = dueNowIndices.length;
    const hasImmediateDue = dueAgainCount > 0;
    const dueAgainText = dueAgainCount === 1 ? '1 card is already due for review' : `${dueAgainCount} cards are already due for review`;
    const completionMessage = hasImmediateDue
      ? `You finished this deck, but ${dueAgainText}. Let’s review them now while they’re fresh.`
      : 'You have finished this deck for now. For best results with spaced repetition, be sure to come back for future review sessions.';

    return (
      <div
        className={`relative w-full rounded-[1.5rem] flex flex-col ${
          isEmbedded
            ? 'h-auto overflow-visible !bg-transparent !border-0 !ring-0 !shadow-none'
            : 'h-full overflow-hidden bg-background border border-border ring-1 ring-black/5 shadow-2xl'
        }`}
      >
      {!isEmbedded && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-2">
          {onShare && (
            <ShareTriggerButton onClick={onShare} showText={true} />
          )}
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center w-8 h-8 bg-background text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 dark:hover:bg-muted/80 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className={`w-full grid grid-rows-[auto,1fr,auto] bg-background gap-y-3 ${
          isEmbedded ? 'pb-8 sm:pb-10' : 'pb-4 sm:pb-6'
        } ${!isEmbedded ? 'h-full pt-14 sm:pt-4 md:pt-0' : 'h-auto pt-4 md:pt-0'}`}
      >
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-0 mt-10">
          <div className="text-center md:text-left text-sm font-medium truncate text-foreground">{studyInterleaved ? (current?.deckTitle || title) : (title || 'Flashcards')}</div>
          <div className="text-sm text-muted-foreground text-center hidden md:block">{hasCards ? (finished ? 'Completed' : studyDueOnly ? `${originalDueList.indexOf(index) + 1} / ${originalDueCount} due` : `${index + 1} / ${cards!.length}`) : ''}</div>
          <div className="justify-self-center md:justify-self-end">
            {hasCards && (
              <div className="inline-flex items-center gap-2 text-sm">
                <span className="text-foreground font-medium">{studyInterleaved ? 'Source deck exam' : 'Exam date'}</span>
                <div className="w-32">
                  <DatePicker
                    date={examDateInput}
                    onDateChange={(date) => {
                      setExamDateInput(date);
                      handleSetDeckExamDate(date);
                    }}
                    placeholder="Select date"
                    className="h-7 text-xs"
                    showTimeOnButton={false}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground text-center md:hidden">{hasCards ? (finished ? 'Completed' : studyDueOnly ? `${originalDueList.indexOf(index) + 1} / ${originalDueCount} due` : `${index + 1} / ${cards!.length}`) : ''}</div>
        </div>
        {hasCards ? (
        <div className="w-full max-w-5xl mx-auto mt-6 px-4 sm:px-6 md:px-0">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"
                style={{
                  width: `${
                    finished
                      ? 100
                      : studyDueOnly
                      ? originalDueCount > 0
                        ? ((originalDueList.indexOf(index) + 1) / originalDueCount) * 100
                        : 0
                      : ((index + 1) / cards!.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div className="w-full max-w-3xl mx-auto overflow-auto py-2 mt-0 sm:mt-0 sm:flex sm:items-start sm:justify-center px-4 sm:px-6 md:px-0">
          {error ? (
            <div className="w-full text-sm text-red-600">{error}</div>
          ) : !hasCards ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isGenerating ? 'Generating flashcards…' : 'No flashcards yet'}
            </div>
          ) : finished ? (
            <div className="w-full">
              {userId || deckId ? (
                <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-emerald-200 via-teal-200 to-green-200">
                  <div className="bg-background border border-border rounded-[1.25rem] shadow p-8 sm:p-10 min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center text-center">
                    <div className="text-4xl mb-4">🎉</div>
                    <div className="text-foreground text-xl sm:text-2xl font-bold leading-7 sm:leading-8 mb-4">
                      Congratulations!
                    </div>
                    <div className="text-foreground text-sm sm:text-base leading-6 max-w-md">
                      {completionMessage}
                    </div>
                      <button
                        onClick={() => {
                          if (dueNowIndices.length > 0) {
                            const nextDueList = [...dueNowIndices];
                            if (nextDueList.length > 0) {
                              setDueList(nextDueList);
                              setOriginalDueList(nextDueList);
                              setOriginalDueCount(nextDueList.length);
                              setIndex(nextDueList[0]);
                            }
                            setFinished(false);
                            setShowAnswer(false);
                            resetExplanation();
                            setPredictedDueByGrade({});
                            setImmediateReviewIndices([]);
                            setCardsViewedCount(0);
                            setShowSignupPopup(false);
                            setAnswerShownTime(null);
                            onReviewDueCards?.(nextDueList);
                          } else {
                            handleClose();
                          }
                        }}
                        className="mt-6 inline-flex items-center h-10 px-6 rounded-full text-white bg-gradient-primary shadow-sm hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                      >
                        {dueNowIndices.length > 0 ? 'Review due cards' : 'Close'}
                      </button>
                  </div>
                </div>
              ) : isEmbedded ? (
                <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                  <div className="bg-background border border-border rounded-[1.25rem] shadow p-8 sm:p-10 min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center text-center">
                    <h2 className="text-foreground text-2xl font-bold mb-4">Ready to study smarter?</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      You&apos;ve seen how effective flashcards can be. Create your own study set from your course materials in seconds.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full max-w-md justify-center">
                      <button
                        onClick={() => {
                          const element = document.getElementById('generator');
                          if (element) {
                            const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
                            // Account for sticky header (64px) plus additional padding
                            window.scrollTo({
                              top: elementTop - 100,
                              behavior: 'smooth'
                            });
                          }
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap inline-flex items-center justify-center"
                      >
                        Create My Study Set
                      </button>
                      <button
                        onClick={() => {
                          setFinished(false);
                          setIndex(0);
                          setShowAnswer(false);
                          resetExplanation();
                          setPredictedDueByGrade({});
                          setCardsViewedCount(0);
                          setShowSignupPopup(false);
                          setAnswerShownTime(null);
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors"
                      >
                        Review Sample
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                  <div className="bg-background border border-border rounded-[1.25rem] shadow p-8 sm:p-10 min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center text-center">
                    <h2 className="text-foreground text-2xl font-bold mb-4">🎉 Great job! Don&apos;t lose your progress!</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      Sign up to save this flashcard deck and track your study progress with spaced repetition.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full max-w-md justify-center">
                      <button
                        onClick={() => {
                          if (title && cards) {
                            const pendingDeck = { title, cards };
                            localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                          }
                          setShowAuthModal(true);
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                      >
                        Sign Up & Save Deck
                      </button>
                      <button
                        onClick={() => {
                          setFinished(false);
                          setIndex(0);
                          setShowAnswer(false);
                          resetExplanation();
                          setPredictedDueByGrade({});
                          setCardsViewedCount(0);
                          setShowSignupPopup(false);
                          setAnswerShownTime(null);
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors"
                      >
                        Start Over
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full">
              <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                <div className="bg-background border border-border rounded-[1.25rem] shadow p-5 sm:p-6 min-h-[180px] sm:min-h-[200px] flex flex-col">
                  {showExplanation ? (
                    <div className="flex-1 flex flex-col">
                      <div
                        ref={answerRef}
                        className={`flex-1 ${
                          isEmbedded ? 'overflow-visible' : 'overflow-y-auto'
                        } text-sm text-foreground flashcard-katex-content`}
                      >
                        <div className="space-y-3">
                          {explanation ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {explanation}
                            </ReactMarkdown>
                          ) : null}
                          {(!explanation || isExplaining) ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {explanation ? 'Finishing explanation…' : 'Generating explanation…'}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        ref={questionRef}
                        className="text-foreground text-xl sm:text-2xl font-semibold leading-7 sm:leading-8 break-words flashcard-katex-content"
                      >
                        {questionContent}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {showAnswer && !showExplanation ? (
                          <button
                            onClick={handleExplain}
                            disabled={isExplaining}
                            className="inline-flex items-center h-6 px-3 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 flashcard-grade-good disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isExplaining ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Explain
                          </button>
                        ) : null}
                        {showAnswer && explanationError && !isExplaining ? (
                          <span className="text-red-500 dark:text-red-400">{explanationError}</span>
                        ) : null}
                      </div>
                      {showAnswer && (
                        <div className="mt-4 text-foreground">
                          <div className="h-px bg-border mb-4" />
                          <div
                            ref={answerRef}
                            className={`${
                              isEmbedded
                                ? 'max-h-none overflow-visible'
                                : 'max-h-[45vh] overflow-y-auto'
                            } text-sm text-foreground flashcard-katex-content`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {answerContent || ''}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {hasCards && !finished ? (
          <div className="w-full max-w-3xl mx-auto mt-4 grid grid-cols-3 items-center gap-2 sm:gap-3">
            {!showAnswer ? (
              <div className="justify-self-start">
                <button
                  onClick={() => {
                    const prevIndex = getPrevIndex();
                    setIndex(prevIndex);
                    setShowAnswer(false);
                    resetExplanation();
                    setPredictedDueByGrade({});
                    setAnswerShownTime(null);
                  }}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
                >
                  <ChevronLeft className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
              </div>
            ) : <div />}
            <div className="justify-self-center flex flex-col items-center gap-2">
              {showAnswer ? (
                showExplanation ? (
                  <button
                    onClick={handleExplanationBack}
                    className="inline-flex items-center h-10 px-5 rounded-full text-white bg-gradient-primary shadow-sm hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                  >
                    Back
                  </button>
                ) : (
                  <div className="flex items-end justify-center gap-3 flex-nowrap">
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[1] || ''}</span>
                      <button
                        onClick={() => handleGrade(1)}
                        className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50 flashcard-grade-again"
                      >
                        Again
                      </button>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[2] || ''}</span>
                      <button
                        onClick={() => handleGrade(2)}
                        className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 flashcard-grade-hard"
                      >
                        Hard
                      </button>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[3] || ''}</span>
                      <button
                        onClick={() => handleGrade(3)}
                        className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 flashcard-grade-good"
                      >
                        Good
                      </button>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[4] || ''}</span>
                      <button
                        onClick={() => handleGrade(4)}
                        className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 flashcard-grade-easy"
                      >
                        Easy
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <button onClick={() => {
                  resetExplanation();
                  posthog.capture('flashcard_answer_shown', {
                    deckId: deckId,
                    card_index: index,
                    study_due_only: studyDueOnly,
                  });

                  // Check if we should show exam date popup (skip for embedded mode)
                  const shouldShowExamDatePopup = !isEmbedded && isCurrentDeckExamReady && !deckExamDate && !hasExamDatePopupBeenShown(deckIdentifier);
                  if (shouldShowExamDatePopup) {
                    setShowExamDatePopup(true);
                  } else {
                    setShowAnswer(true);
                    setAnswerShownTime(Date.now());
                  }

                  // Track cards viewed for non-auth users (skip popups for embedded mode)
                  if (!userId && !isEmbedded) {
                    setCardsViewedCount(prev => {
                      const newCount = prev + 1;
                      // Show signup popup after viewing 10 cards
                      if (newCount >= 10 && !showSignupPopup) {
                        setShowSignupPopup(true);
                      }
                      return newCount;
                    });
                  }
                }} className="inline-flex items-center h-10 px-5 rounded-full text-white bg-gradient-primary shadow-sm hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap">
                  <Eye className="h-5 w-5 mr-2" /> Show Answer
                </button>
              )}
            </div>
            {!showAnswer ? (
              <div className="justify-self-end">
                <button
                  onClick={() => {
                    const nextIndex = getNextIndex();
                    setIndex(nextIndex);
                    setShowAnswer(false);
                    resetExplanation();
                    setPredictedDueByGrade({});
                    setAnswerShownTime(null);
                  }}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-5 w-5 sm:ml-2" />
                </button>
              </div>
            ) : <div />}
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
  };

  const katexAlignmentStyles = `
    .flashcard-katex-content .katex-display {
      text-align: left !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    .flashcard-katex-content .katex-display > .katex {
      text-align: left !important;
    }
  `;

  if (isEmbedded) {
    return (
      <>
        <ModalContent />
        <style jsx global>{katexAlignmentStyles}</style>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[100] p-3 font-sans">
        <AuthModal open={showAuthModal} />
        <ModalContent />
      </div>
      <style jsx global>{katexAlignmentStyles}</style>
      {showLossAversionPopup && (
        <div className="absolute inset-0 flex items-center justify-center z-[110]">
          {/* Black transparent background */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
          <div className="bg-background border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10">
            <h2 className="text-foreground text-2xl font-bold mb-4">Don&apos;t Lose Your Progress!</h2>
            <p className="text-muted-foreground mb-6">
              Sign up to save this deck and track your study progress with spaced repetition.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-md">
              <button
                onClick={() => {
                  if (title && cards) {
                    const pendingDeck = { title, cards };
                    localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                  }
                  setShowLossAversionPopup(false);
                  setShowAuthModal(true);
                }}
                className="w-full h-10 px-6 text-sm font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
              >
                Save & Continue
              </button>
              <button
                onClick={onClose}
                className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors whitespace-nowrap"
              >
                Continue without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignupPopup && (
        <div className="absolute inset-0 flex items-center justify-center z-[110]">
          {/* Black transparent background */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
          <div className="bg-background border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10">
            <h2 className="text-foreground text-2xl font-bold mb-4">Sign Up to Save Your Flashcards!</h2>
            <p className="text-muted-foreground mb-6">
              Sign up to save your flashcard deck and get scheduled reviews based on the spaced repetition algorithm.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-md">
              <button
                onClick={() => {
                  if (title && cards) {
                    const pendingDeck = { title, cards };
                    localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                  }
                  setShowSignupPopup(false);
                  setShowAuthModal(true);
                }}
                className="w-full h-10 px-6 text-sm font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
              >
                Sign Up & Save Progress
              </button>
              <button
                onClick={onClose}
                className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors whitespace-nowrap"
              >
                Close Flashcard Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {showExamDatePopup && (
        <div className="absolute inset-0 flex items-center justify-center z-[110] sm:items-start sm:pt-16">
          {/* Black transparent background */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
          <div className="bg-background border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10">
            <h2 className="text-foreground text-2xl font-bold mb-4">📅 Set Your Exam Date</h2>
            <p className="text-muted-foreground text-sm mb-4">
              The spaced repetition algorithm will adjust review intervals to ensure you&apos;re well-prepared by your exam date.
            </p>
            <div className="mb-6">
              <div className="relative">
                <DatePicker
                  date={examDateInput}
                  onDateChange={(date) => {
                    if (date && date >= new Date()) {
                      setExamDateInput(date);
                      handleSetDeckExamDate(date);
                      markExamDatePopupAsShown(deckIdentifier);
                      setShowExamDatePopup(false);
                      setShowAnswer(true);
                      setAnswerShownTime(Date.now());
                      posthog.capture('exam_date_set', {
                        deckId: deckId,
                        exam_datetime: date.toISOString(),
                      });
                    } else if (!date) {
                      // Handle clearing the date
                      setExamDateInput(undefined);
                      handleSetDeckExamDate(undefined);
                    }
                  }}
                  placeholder="Select date (optional)"
                />
              </div>

            </div>
            <div className="flex flex-col gap-3 w-full max-w-md">
              <button
                onClick={() => {
                  markExamDatePopupAsShown(deckIdentifier);
                  setShowExamDatePopup(false);
                  setShowAnswer(true);
                  setAnswerShownTime(Date.now());
                  posthog.capture('exam_date_skipped', {
                    deckId: deckId,
                  });
                }}
                className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors whitespace-nowrap"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
