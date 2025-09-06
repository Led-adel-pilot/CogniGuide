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
type CardWithSchedule = Flashcard & { schedule?: FsrsScheduleState };

const markdownComponents: Components = {
  ul({ node, ...props }) {
    return <ul className="list-disc list-inside pl-4 my-2 space-y-1" {...props} />;
  },
  ol({ node, ...props }) {
    return <ol className="list-decimal list-inside pl-4 my-2 space-y-1" {...props} />;
  },
  li({ node, ...props }) {
    return <li className="leading-6" {...props} />;
  },
  p({ node, ...props }) {
    return <p className="my-2 leading-6" {...props} />;
  },
};

type Props = {
  open: boolean;
  title?: string | null;
  cards: Flashcard[] | null;
  isGenerating?: boolean;
  error?: string | null;
  onClose: () => void;
  deckId?: string; // id from DB record when opened from history
  initialIndex?: number;
  studyDueOnly?: boolean;
  dueIndices?: number[];
  isEmbedded?: boolean;
};

export default function FlashcardsModal({ open, title, cards, isGenerating = false, error, onClose, deckId, initialIndex, studyDueOnly = false, dueIndices, isEmbedded = false }: Props) {
  const [index, setIndex] = React.useState(0);
  const [showAnswer, setShowAnswer] = React.useState(false);
  const [scheduledCards, setScheduledCards] = React.useState<CardWithSchedule[] | null>(null);
  const [deckExamDate, setDeckExamDate] = React.useState<string>('');
  const [examDateInput, setExamDateInput] = React.useState<Date | undefined>(undefined);
  const [dueList, setDueList] = React.useState<number[]>([]);
  const [predictedDueByGrade, setPredictedDueByGrade] = React.useState<Record<number, string>>({});
  const [predictedDueDatesByGrade, setPredictedDueDatesByGrade] = React.useState<Record<number, Date>>({});
  const [hoveredGrade, setHoveredGrade] = React.useState<number | null>(null);
  const [finished, setFinished] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [showLossAversionPopup, setShowLossAversionPopup] = React.useState(false);
  const [showSignupPopup, setShowSignupPopup] = React.useState(false);
  const [showExamDatePopup, setShowExamDatePopup] = React.useState(false);
  const [cardsViewedCount, setCardsViewedCount] = React.useState(0);
  const [answerShownTime, setAnswerShownTime] = React.useState<number | null>(null);
  const current = scheduledCards && scheduledCards[index] ? scheduledCards[index] : null;

  const hasCards = Boolean(cards && cards.length > 0);

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
      setHoveredGrade(null);
      setPredictedDueByGrade({});
      setPredictedDueDatesByGrade({});
      setFinished(false);
      setShowLossAversionPopup(false);
      setShowSignupPopup(false);
      setShowExamDatePopup(false);
      setCardsViewedCount(0);
      setAnswerShownTime(null);
    }
  }, [open]);

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
    if (!cards || cards.length === 0) { setScheduledCards(null); return; }
    // Try load stored schedule by deckId; fallback to fresh
    if (deckId) {
      (async () => {
        const stored = (await loadDeckScheduleAsync(deckId)) || loadDeckSchedule(deckId);
        if (stored && Array.isArray(stored.schedules) && stored.schedules.length === cards.length) {
          setDeckExamDate(stored.examDate || '');
          setExamDateInput(stored.examDate ? new Date(stored.examDate) : undefined);
          setScheduledCards(cards.map((c, i) => ({ ...c, schedule: stored.schedules[i] || createInitialSchedule() })));
          if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
            setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
            setShowAnswer(false);
          }
          // Initialize due list from props if provided
          setDueList(Array.isArray(dueIndices) ? dueIndices.slice() : []);
          return;
        }
        setScheduledCards(cards.map((c) => ({ ...c, schedule: createInitialSchedule() })));
        if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
          setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
          setShowAnswer(false);
        }
        setDueList(Array.isArray(dueIndices) ? dueIndices.slice() : []);
      })();
      return;
    }
    setScheduledCards(cards.map((c) => ({ ...c, schedule: createInitialSchedule() })));
    if (typeof initialIndex === 'number' && Number.isFinite(initialIndex)) {
      setIndex(Math.max(0, Math.min(cards.length - 1, initialIndex)));
      setShowAnswer(false);
    }
    setDueList(Array.isArray(dueIndices) ? dueIndices.slice() : []);
  }, [cards, deckId, initialIndex, dueIndices, title]);

  React.useEffect(() => {
    if (!deckId || !scheduledCards) return;
    const payload = { examDate: deckExamDate || undefined, schedules: scheduledCards.map((c) => c.schedule) };
    // Save remotely when possible; always mirror to local as fallback
    saveDeckSchedule(deckId, payload);
    saveDeckScheduleAsync(deckId, payload).catch((err) => {
      console.error(`Failed to save deck schedule async for deck ${deckId}:`, err);
    });
  }, [deckId, scheduledCards, deckExamDate]);

  // Predict next due labels per grade once the answer is shown
  React.useEffect(() => {
    if (!showAnswer || !current) {
      setPredictedDueByGrade({});
      setPredictedDueDatesByGrade({});
      return;
    }
    const now = new Date();
    const base = current.schedule ?? createInitialSchedule();
    const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
    const map: Record<number, string> = {};
    const dateMap: Record<number, Date> = {};
    const grades = [1, 2, 3, 4] as Grade[];
    for (const g of grades) {
      const s = nextSchedule(withDeckExam, g, now);
      const due = new Date(s.due);
      map[g as number] = formatTimeUntil(due, now);
      dateMap[g as number] = due;
    }
    setPredictedDueByGrade(map);
    setPredictedDueDatesByGrade(dateMap);
  }, [showAnswer, current, deckExamDate]);

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

    if (dateTime) {
      const isoString = dateTime.toISOString();
      setDeckExamDate(isoString);
      // Also copy this onto existing schedules so clamping works immediately
      setScheduledCards((prev) => prev ? prev.map((c) => ({ ...c, schedule: { ...(c.schedule ?? createInitialSchedule()), examDate: isoString } })) : prev);
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

    setScheduledCards((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const item = { ...next[index] };
      const base = item.schedule ?? createInitialSchedule();
      // Ensure deck-level examDate is applied
      const withDeckExam = { ...base, examDate: deckExamDate || base.examDate } as FsrsScheduleState;
      const newSchedule = nextSchedule(withDeckExam, g, new Date());
      item.schedule = newSchedule;
      next[index] = item;

      posthog.capture('flashcard_graded', {
        deckId: deckId,
        card_index: index,
        grade: g,
        study_due_only: studyDueOnly,
        next_due_date: newSchedule.due,
      });

      return next;
    });
    setShowAnswer(false);
    setHoveredGrade(null);
    setPredictedDueByGrade({});
    setPredictedDueDatesByGrade({});
    setAnswerShownTime(null);
    // If studying due-only, remove current index from due list and move to next due
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
      if (nextPos === 0) {
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
        return index; // Stay on current card
      }
      return nextIndex;
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

  const ModalContent = () => (
    <div className={`relative w-full h-full rounded-[1.5rem] flex flex-col overflow-hidden ${
      isEmbedded
        ? '!bg-transparent !border-0 !ring-0 !shadow-none'
        : 'bg-background border border-border ring-1 ring-black/5 shadow-2xl'
    }`}>
      {!isEmbedded && (
        <div className="absolute top-2 right-2 z-30">
          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center w-8 h-8 bg-background text-foreground rounded-full border border-border shadow-sm hover:bg-muted/50 dark:hover:bg-muted/80 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="w-full h-full grid grid-rows-[auto,1fr,auto] bg-background p-4 sm:p-6">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-2 sm:gap-3">
          <div className="text-center md:text-left text-sm font-medium truncate text-foreground">{title || 'Flashcards'}</div>
          <div className="text-sm text-muted-foreground text-center hidden md:block">{hasCards ? (finished ? 'Completed' : `${index + 1} / ${cards!.length}`) : ''}</div>
          <div className="justify-self-center md:justify-self-end">
            {hasCards && (
              <div className="inline-flex items-center gap-2 text-sm">
                <span className="text-foreground font-medium">Exam date</span>
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
          <div className="text-sm text-muted-foreground text-center md:hidden">{hasCards ? (finished ? 'Completed' : `${index + 1} / ${cards!.length}`) : ''}</div>
        </div>
        {hasCards ? (
          <div className="w-full max-w-5xl mx-auto mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"
                style={{ width: `${finished ? 100 : ((index + 1) / cards!.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="w-full max-w-3xl mx-auto overflow-auto flex items-center justify-center py-2">
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
                      You have finished this deck for now. For best results with spaced repetition, be sure to come back for future review sessions.
                    </div>
                                          <button
                        onClick={() => {
                          setFinished(false);
                          setIndex(0);
                          setShowAnswer(false);
                          setHoveredGrade(null);
                          setPredictedDueByGrade({});
                          setPredictedDueDatesByGrade({});
                          setCardsViewedCount(0);
                          setShowSignupPopup(false);
                          setAnswerShownTime(null);
                        }}
                        className="mt-6 inline-flex items-center h-10 px-6 rounded-full text-white bg-gradient-primary shadow-sm hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                      >
                        Start Over
                      </button>
                  </div>
                </div>
              ) : isEmbedded ? (
                <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                  <div className="bg-background border border-border rounded-[1.25rem] shadow p-8 sm:p-10 min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center text-center">
                    <h2 className="text-foreground text-2xl font-bold mb-4">Ready to study smarter?</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      You've seen how effective flashcards can be. Create your own study set from your course materials in seconds.
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
                          setHoveredGrade(null);
                          setPredictedDueByGrade({});
                          setPredictedDueDatesByGrade({});
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
                    <h2 className="text-foreground text-2xl font-bold mb-4">🎉 Great job! Don't lose your progress!</h2>
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
                          setHoveredGrade(null);
                          setPredictedDueByGrade({});
                          setPredictedDueDatesByGrade({});
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
                <div className="bg-background border border-border rounded-[1.25rem] shadow p-5 sm:p-6 min-h-[180px] sm:min-h-[200px]">
                  <div className="text-foreground text-xl sm:text-2xl font-semibold leading-7 sm:leading-8 break-words">{cards![index]?.question}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {showAnswer && current?.schedule?.due ? (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flashcard-due-pill">
                        {hoveredGrade && predictedDueDatesByGrade[hoveredGrade]
                          ? `Next due: ${predictedDueDatesByGrade[hoveredGrade].toLocaleDateString()} ${predictedDueDatesByGrade[hoveredGrade].toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                          : `Was due: ${new Date(current.schedule.due).toLocaleDateString()} ${new Date(current.schedule.due).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                        }
                      </span>
                    ) : null}
                  </div>
                  {showAnswer && (
                    <div className="mt-4 text-foreground">
                      <div className="h-px bg-border mb-4" />
                      <div className="max-h-[45vh] overflow-y-auto text-sm text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {cards![index]?.answer || ''}
                        </ReactMarkdown>
                      </div>

                    </div>
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
                  onClick={() => { if (!cards) return; setIndex(getPrevIndex()); setShowAnswer(false); setHoveredGrade(null); setPredictedDueByGrade({}); setPredictedDueDatesByGrade({}); setAnswerShownTime(null); }}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
                >
                  <ChevronLeft className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
              </div>
            ) : <div />}
            <div className="justify-self-center flex flex-col items-center gap-2">
              {showAnswer ? (
                <div className="flex items-end justify-center gap-3 flex-nowrap">
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[1] || ''}</span>
                    <button
                      onClick={() => handleGrade(1)}
                      onMouseEnter={() => setHoveredGrade(1)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50 flashcard-grade-again"
                    >
                      Again
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[2] || ''}</span>
                    <button
                      onClick={() => handleGrade(2)}
                      onMouseEnter={() => setHoveredGrade(2)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 flashcard-grade-hard"
                    >
                      Hard
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[3] || ''}</span>
                    <button
                      onClick={() => handleGrade(3)}
                      onMouseEnter={() => setHoveredGrade(3)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 flashcard-grade-good"
                    >
                      Good
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 h-4">{predictedDueByGrade[4] || ''}</span>
                    <button
                      onClick={() => handleGrade(4)}
                      onMouseEnter={() => setHoveredGrade(4)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 flashcard-grade-easy"
                    >
                      Easy
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => {
                  posthog.capture('flashcard_answer_shown', {
                    deckId: deckId,
                    card_index: index,
                    study_due_only: studyDueOnly,
                  });

                  // Check if we should show exam date popup (skip for embedded mode)
                  const shouldShowExamDatePopup = !isEmbedded && !deckExamDate && !hasExamDatePopupBeenShown(deckIdentifier);
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
                  onClick={() => { if (!cards) return; setIndex(getNextIndex()); setShowAnswer(false); setHoveredGrade(null); setPredictedDueByGrade({}); setPredictedDueDatesByGrade({}); setAnswerShownTime(null); }}
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

  if (isEmbedded) {
    return <ModalContent />;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ModalContent />
      {showLossAversionPopup && (
        <div className="absolute inset-0 flex items-center justify-center z-[110]">
          {/* Black transparent background */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-0"></div>
          <div className="bg-background border p-8 rounded-2xl shadow-xl max-w-md w-full text-center relative z-10">
            <h2 className="text-foreground text-2xl font-bold mb-4">Don't Lose Your Progress!</h2>
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
                Close without saving
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
              The spaced repetition algorithm will adjust review intervals to ensure you're well-prepared by your exam date.
            </p>
            <div className="mb-6">
              <div className="relative">
                <DatePicker
                  date={examDateInput}
                  onDateChange={(date) => {
                    setExamDateInput(date);
                  }}
                  placeholder="Select date (optional)"
                />
              </div>

            </div>
            <div className="flex flex-col gap-3 w-full max-w-md">
              <button
                onClick={() => {
                  if (examDateInput) {
                    handleSetDeckExamDate(examDateInput);
                    markExamDatePopupAsShown(deckIdentifier);
                    setShowExamDatePopup(false);
                    setShowAnswer(true);
                    setAnswerShownTime(Date.now());
                    posthog.capture('exam_date_set', {
                      deckId: deckId,
                      exam_datetime: examDateInput.toISOString(),
                    });
                  }
                }}
                disabled={!examDateInput || examDateInput < new Date()}
                className="w-full h-10 px-6 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Set Exam Date
              </button>
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
    </div>
  );
}
