'use client';

import React from 'react';
import { nextSchedule, createInitialSchedule, type FsrsScheduleState, type Grade } from '@/lib/spaced-repetition';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync } from '@/lib/sr-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
import posthog from 'posthog-js';

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
  const [dueList, setDueList] = React.useState<number[]>([]);
  const [predictedDueByGrade, setPredictedDueByGrade] = React.useState<Record<number, string>>({});
  const [predictedDueDatesByGrade, setPredictedDueDatesByGrade] = React.useState<Record<number, Date>>({});
  const [hoveredGrade, setHoveredGrade] = React.useState<number | null>(null);
  const [finished, setFinished] = React.useState(false);
  const current = scheduledCards && scheduledCards[index] ? scheduledCards[index] : null;

  React.useEffect(() => {
    if (!open) {
      setIndex(0);
      setShowAnswer(false);
      setHoveredGrade(null);
      setPredictedDueByGrade({});
      setPredictedDueDatesByGrade({});
      setFinished(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!cards || cards.length === 0) { setScheduledCards(null); return; }
    // Try load stored schedule by deckId; fallback to fresh
    if (deckId) {
      (async () => {
        const stored = (await loadDeckScheduleAsync(deckId)) || loadDeckSchedule(deckId);
        if (stored && Array.isArray(stored.schedules) && stored.schedules.length === cards.length) {
          setDeckExamDate(stored.examDate || '');
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
  }, [cards, deckId]);

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

  const handleSetDeckExamDate = (value: string) => {
    setDeckExamDate(value);
    // Also copy this onto existing schedules so clamping works immediately
    setScheduledCards((prev) => prev ? prev.map((c) => ({ ...c, schedule: { ...(c.schedule ?? createInitialSchedule()), examDate: value || undefined } })) : prev);
  };

  const handleGrade = (g: Grade) => {
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
    // If studying due-only, remove current index from due list and move to next due
    setDueList((list) => {
      if (!studyDueOnly) return list;
      const filtered = list.filter((i) => i !== index);
      if (filtered.length > 0) {
        setIndex(filtered[0]);
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

  const hasCards = Boolean(cards && cards.length > 0);

  const ModalContent = () => (
    <div className="relative bg-white w-full h-full rounded-[1.5rem] border border-gray-200 ring-1 ring-black/5 shadow-2xl flex flex-col overflow-hidden">
      {!isEmbedded && (
        <div className="absolute top-2 right-2 z-30">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 bg-white text-gray-700 rounded-full border border-gray-300 shadow-sm hover:bg-gray-100 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="w-full h-full grid grid-rows-[auto,1fr,auto] bg-white p-4 sm:p-6">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-3">
          <div className="text-center sm:text-left text-sm font-medium truncate bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-emerald-600">{title || 'Flashcards'}</div>
          <div className="justify-self-center sm:justify-self-end">
            {hasCards && (
              <label className="inline-flex items-center gap-2 text-sm">
                <span className="text-gray-700 font-medium">Exam date</span>
                <input
                  type="date"
                  className="h-7 px-2 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-white text-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/50 focus-visible:border-indigo-300 hover:border-gray-300 transition-colors"
                  value={deckExamDate}
                  onChange={(e) => handleSetDeckExamDate(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="text-sm text-gray-600 text-center">{hasCards ? (finished ? 'Completed' : `${index + 1} / ${cards!.length}`) : ''}</div>
        </div>
        {hasCards ? (
          <div className="w-full max-w-5xl mx-auto mt-2">
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
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
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isGenerating ? 'Generating flashcards…' : 'No flashcards yet'}
            </div>
          ) : finished ? (
            <div className="w-full">
              <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-emerald-200 via-teal-200 to-green-200">
                <div className="bg-white border border-gray-200 rounded-[1.25rem] shadow p-8 sm:p-10 min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center text-center">
                  <div className="text-4xl mb-4">🎉</div>
                  <div className="text-gray-900 text-xl sm:text-2xl font-bold leading-7 sm:leading-8 mb-4">
                    Congratulations!
                  </div>
                  <div className="text-gray-700 text-sm sm:text-base leading-6 max-w-md">
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
                    }}
                    className="mt-6 inline-flex items-center h-10 px-6 rounded-full text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="relative mx-auto rounded-[1.35rem] p-[1.5px] bg-gradient-to-br from-indigo-200 via-sky-200 to-emerald-200">
                <div className="bg-white border border-gray-200 rounded-[1.25rem] shadow p-5 sm:p-6 min-h-[180px] sm:min-h-[200px]">
                  <div className="text-gray-900 text-xl sm:text-2xl font-semibold leading-7 sm:leading-8 break-words">{cards![index]?.question}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    {showAnswer && current?.schedule?.due ? (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        {hoveredGrade && predictedDueDatesByGrade[hoveredGrade]
                          ? `Next due: ${predictedDueDatesByGrade[hoveredGrade].toLocaleDateString()} ${predictedDueDatesByGrade[hoveredGrade].toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                          : `Was due: ${new Date(current.schedule.due).toLocaleDateString()} ${new Date(current.schedule.due).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                        }
                      </span>
                    ) : null}
                  </div>
                  {showAnswer && (
                    <div className="mt-4 text-gray-700">
                      <div className="h-px bg-gray-200 mb-4" />
                      <div className="max-h-[45vh] overflow-y-auto text-sm text-gray-700">
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
                  onClick={() => { if (!cards) return; setIndex(getPrevIndex()); setShowAnswer(false); setHoveredGrade(null); setPredictedDueByGrade({}); setPredictedDueDatesByGrade({}); }}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
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
                    <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[1] || ''}</span>
                    <button
                      onClick={() => handleGrade(1)}
                      onMouseEnter={() => setHoveredGrade(1)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50"
                    >
                      Again
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[2] || ''}</span>
                    <button
                      onClick={() => handleGrade(2)}
                      onMouseEnter={() => setHoveredGrade(2)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                    >
                      Hard
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[3] || ''}</span>
                    <button
                      onClick={() => handleGrade(3)}
                      onMouseEnter={() => setHoveredGrade(3)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
                    >
                      Good
                    </button>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] text-gray-500 h-4">{predictedDueByGrade[4] || ''}</span>
                    <button
                      onClick={() => handleGrade(4)}
                      onMouseEnter={() => setHoveredGrade(4)}
                      onMouseLeave={() => setHoveredGrade(null)}
                      className="h-9 px-3 text-xs rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
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
                  setShowAnswer(true);
                }} className="inline-flex items-center h-10 px-5 rounded-full text-white bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 shadow-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap">
                  <Eye className="h-5 w-5 mr-2" /> Show Answer
                </button>
              )}
            </div>
            {!showAnswer ? (
              <div className="justify-self-end">
                <button
                  onClick={() => { if (!cards) return; setIndex(getNextIndex()); setShowAnswer(false); setHoveredGrade(null); setPredictedDueByGrade({}); setPredictedDueDatesByGrade({}); }}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
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
      <ModalContent />
    </div>
  );
}
