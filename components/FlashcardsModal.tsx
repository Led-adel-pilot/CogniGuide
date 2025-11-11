'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';
import { nextSchedule, createInitialSchedule, type FsrsScheduleState, type Grade } from '@/lib/spaced-repetition';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync } from '@/lib/sr-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ChevronLeft, ChevronRight, Eye, Loader2, Lock, Map as MapIcon, Pencil, Sparkles, X } from 'lucide-react';
import posthog from 'posthog-js';
import { DatePicker } from '@/components/DatePicker';
import { ensureKatexAssets } from '@/lib/katex-loader';
import ShareTriggerButton from '@/components/ShareTriggerButton';
import type { ModelChoice } from '@/lib/plans';
import { parseMarkmap, type MindMapNode } from '@/lib/markmap-renderer';

const MindMapModal = dynamic(() => import('@/components/MindMapModal'), { ssr: false });
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

const MINDMAP_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'have',
  'will',
  'your',
  'when',
  'then',
  'what',
  'which',
  'them',
  'they',
  'their',
  'there',
  'been',
  'were',
  'also',
  'some',
  'such',
  'each',
  'more',
  'than',
  'because',
  'while',
  'where',
  'these',
  'those',
  'using',
  'used',
  'about',
  'after',
  'before',
  'between',
  'among',
  'within',
  'through',
  'other',
  'make',
  'made',
  'many',
  'much',
  'very',
  'even',
]);

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
  isPaidUser?: boolean;
  onRequireUpgrade?: () => void;
  mindMapModelChoice?: ModelChoice;
  linkedMindMapId?: string | null;
  linkedMindMapMarkdown?: string | null;
  onMindMapLinked?: (mindmapId: string | null, markdown: string | null) => void;
};

export default function FlashcardsModal({ open, title, cards, isGenerating = false, error, onClose, onReviewDueCards, deckId, initialIndex, studyDueOnly = false, studyInterleaved = false, interleavedDecks, dueIndices, isEmbedded = false, onShare, isPaidUser = false, onRequireUpgrade, mindMapModelChoice = 'fast', linkedMindMapId, linkedMindMapMarkdown, onMindMapLinked }: Props) {
  const [index, setIndex] = React.useState(0);
  const [showAnswer, setShowAnswer] = React.useState(false);
  const [showExplanation, setShowExplanation] = React.useState(false);
  const [explanation, setExplanation] = React.useState('');
  const [isExplaining, setIsExplaining] = React.useState(false);
  const [explanationError, setExplanationError] = React.useState<string | null>(null);
  const [isMindMapModalOpen, setIsMindMapModalOpen] = React.useState(false);
  const [mindMapMarkdown, setMindMapMarkdown] = React.useState<string | null>(linkedMindMapMarkdown ?? null);
  const [persistedMindMapId, setPersistedMindMapId] = React.useState<string | null>(linkedMindMapId ?? null);
  const [persistedMindMapMarkdown, setPersistedMindMapMarkdown] = React.useState<string | null>(linkedMindMapMarkdown ?? null);
  const [mindMapError, setMindMapError] = React.useState<string | null>(null);
  const [isMindMapGenerating, setIsMindMapGenerating] = React.useState(false);
  const [activeMindMapRequestId, setActiveMindMapRequestId] = React.useState<number | null>(null);
  const [mindMapFocusNodeId, setMindMapFocusNodeId] = React.useState<string | null>(null);
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
  const [authModalSubtitleOverride, setAuthModalSubtitleOverride] = React.useState<string | undefined>(undefined);
  const [signupPromptTriggered, setSignupPromptTriggered] = React.useState(false);
  const [showLossAversionPopup, setShowLossAversionPopup] = React.useState(false);
  const [showExamDatePopup, setShowExamDatePopup] = React.useState(false);
  const [, setCardsViewedCount] = React.useState(0);
  const lastViewedIndexRef = React.useRef<number | null>(null);
  const [answerShownTime, setAnswerShownTime] = React.useState<number | null>(null);
  const [originalDueCount, setOriginalDueCount] = React.useState(0);
  const [originalDueList, setOriginalDueList] = React.useState<number[]>([]);
  const [localCards, setLocalCards] = React.useState<Flashcard[] | null>(cards);
  const [isEditingCard, setIsEditingCard] = React.useState(false);
  const [editedQuestion, setEditedQuestion] = React.useState('');
  const [editedAnswer, setEditedAnswer] = React.useState('');
  const [isSavingEditedAnswer, setIsSavingEditedAnswer] = React.useState(false);
  const [editPersistenceError, setEditPersistenceError] = React.useState<string | null>(null);
  const explainRequestRef = React.useRef(0);
  const mindMapRequestRef = React.useRef(0);
  const current = scheduledCards && scheduledCards[index] ? scheduledCards[index] : null;
  const displayedCards = React.useMemo(() => localCards ?? cards, [localCards, cards]);
  const dispatchMindMapStreamUpdate = React.useCallback((requestId: number, markdownPayload: string, isFinal = false) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('cogniguide:mindmap-stream-update', {
        detail: {
          requestId,
          markdown: markdownPayload,
          isFinal,
          source: 'flashcards',
        },
      }),
    );
  }, []);

  const hasCards = Boolean(displayedCards && displayedCards.length > 0);

  const questionContent = displayedCards && displayedCards[index] ? displayedCards[index]!.question : '';
  const answerContent = displayedCards && displayedCards[index] ? displayedCards[index]!.answer : '';
  const totalCardCount = displayedCards?.length ?? 0;

  const questionRef = React.useRef<HTMLDivElement | null>(null);
  const answerRef = React.useRef<HTMLDivElement | null>(null);
  const editedQuestionRef = React.useRef<HTMLTextAreaElement | null>(null);
  const editedAnswerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const editedQuestionSelectionRef = React.useRef<{ start: number; end: number } | null>(null);
  const editedAnswerSelectionRef = React.useRef<{ start: number; end: number } | null>(null);

  const resetExplanation = React.useCallback(() => {
    explainRequestRef.current += 1;
    setShowExplanation(false);
    setExplanation('');
    setExplanationError(null);
    setIsExplaining(false);
  }, []);

  const storePendingDeckForSignup = React.useCallback(() => {
    if (!title || !displayedCards) return;
    if (typeof window === 'undefined') return;
    try {
      const pendingDeck = { title, cards: displayedCards };
      localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to cache pending flashcards for signup', error);
      }
    }
  }, [title, displayedCards]);

  const openAuthModal = React.useCallback((subtitle?: string) => {
    setAuthModalSubtitleOverride(subtitle);
    setShowAuthModal(true);
  }, []);

  const deriveMindMapTitle = React.useCallback((markdownText: string) => {
    const h1Match = markdownText.match(/^#\s+(.*)/m);
    if (h1Match?.[1]) return h1Match[1].trim();
    const fmMatch = markdownText.match(/title:\s*(.*)/);
    if (fmMatch?.[1]) return fmMatch[1].trim();
    if (typeof title === 'string' && title.trim().length > 0) return title.trim();
    return 'mindmap';
  }, [title]);

  const computeMindMapFocusNodeId = React.useCallback((markdownText: string | null, card: Flashcard | null) => {
    if (!markdownText || !card) return null;
    const trimmedMarkdown = markdownText.trim();
    if (!trimmedMarkdown) return null;

    const baseText = `${card.question ?? ''}\n${card.answer ?? ''}`.trim();
    if (!baseText) return null;

    const sanitizeText = (text: string) =>
      text
        .replace(/<!--.*?-->/g, ' ')
        .replace(/\[(.*?)\]\((?:.*?)\)/g, '$1')
        .replace(/`{1,3}[^`]*`/g, ' ')
        .replace(/[*_~>#-]/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokenize = (text: string): string[] => {
      const cleaned = sanitizeText(text);
      if (!cleaned) return [];
      const matches = cleaned.toLowerCase().match(/[a-z0-9]+/g);
      if (!matches) return [];
      return matches.filter((token) => token.length > 2 && !MINDMAP_STOP_WORDS.has(token));
    };

    const toTokenSet = (text: string): Set<string> => {
      const set = new Set<string>();
      const tokens = tokenize(text);
      for (const token of tokens) {
        set.add(token);
      }
      return set;
    };

    const gatherBranchText = (node: MindMapNode): string => {
      const stack: MindMapNode[] = [node];
      const parts: string[] = [];
      while (stack.length > 0) {
        const currentNode = stack.pop();
        if (!currentNode) continue;
        if (currentNode.text) {
          parts.push(currentNode.text);
        }
        for (let i = currentNode.children.length - 1; i >= 0; i -= 1) {
          const child = currentNode.children[i];
          if (child) stack.push(child);
        }
      }
      return parts.join(' ');
    };

    try {
      const root = parseMarkmap(trimmedMarkdown);
      if (!root.children || root.children.length === 0) return null;

      const cardTokens = toTokenSet(baseText);
      if (cardTokens.size === 0) return null;

      let bestNodeId: string | null = null;
      let bestScore = 0;

      const computeScore = (branchTokens: Set<string>) => {
        if (branchTokens.size === 0) return 0;
        let overlap = 0;
        branchTokens.forEach((token) => {
          if (cardTokens.has(token)) overlap += 1;
        });
        if (overlap === 0) return 0;
        const unionSize = cardTokens.size + branchTokens.size - overlap;
        const jaccard = unionSize > 0 ? overlap / unionSize : 0;
        const coverage = overlap / cardTokens.size;
        return jaccard * 0.6 + coverage * 0.4;
      };

      for (const branch of root.children) {
        const branchText = gatherBranchText(branch);
        if (!branchText) continue;
        const branchTokens = toTokenSet(branchText);
        const score = computeScore(branchTokens);
        if (score > bestScore) {
          bestScore = score;
          bestNodeId = branch.id;
        }
      }

      if (bestScore > 0 && bestNodeId) {
        return bestNodeId;
      }
      return null;
    } catch (focusError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to determine mind map focus node:', focusError);
      }
      return null;
    }
  }, []);

  React.useEffect(() => {
    setPersistedMindMapId(linkedMindMapId ?? null);
  }, [deckId, linkedMindMapId]);

  React.useEffect(() => {
    setPersistedMindMapMarkdown(linkedMindMapMarkdown ?? null);
  }, [deckId, linkedMindMapId, linkedMindMapMarkdown]);

  React.useEffect(() => {
    setMindMapMarkdown(linkedMindMapMarkdown ?? null);
  }, [deckId, linkedMindMapId, linkedMindMapMarkdown]);

  const persistMindMapLink = React.useCallback(
    async (markdownText: string) => {
      if (!userId) return null;
      try {
        const insertTitle = deriveMindMapTitle(markdownText);
        const { data: inserted, error: insertError } = await supabase
          .from('mindmaps')
          .insert({ user_id: userId, title: insertTitle, markdown: markdownText })
          .select('id')
          .single();

        if (insertError) throw insertError;
        const newId = inserted && typeof inserted.id === 'string' ? inserted.id : null;
        if (newId) {
          setPersistedMindMapId(newId);
          setPersistedMindMapMarkdown(markdownText);
          if (deckId && deckId !== 'interleaved-session') {
            try {
              await supabase
                .from('flashcards')
                .update({ mindmap_id: newId, markdown: markdownText })
                .eq('id', deckId);
            } catch (updateError) {
              console.error('Failed to link mind map to flashcards deck:', updateError);
            }
          }
          try {
            onMindMapLinked?.(newId, markdownText);
          } catch (callbackError) {
            console.error('Failed to notify parent about linked mind map:', callbackError);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
          }
        }
        return newId;
      } catch (persistError) {
        console.error('Failed to persist generated mind map:', persistError);
        return null;
      }
    },
    [deckId, deriveMindMapTitle, onMindMapLinked, userId],
  );

  const handleExplain = React.useCallback(async () => {
    if (!isPaidUser) {
      if (onRequireUpgrade) {
        onRequireUpgrade();
      } else {
        openAuthModal();
      }
      return;
    }

    if (!questionContent || !answerContent) return;
    const targetDeckId = studyInterleaved ? current?.deckId : deckId;
    const normalizedDeckId = targetDeckId && targetDeckId !== 'interleaved-session' ? targetDeckId : undefined;
    const targetCardIndex = studyInterleaved
      ? typeof current?.cardIndex === 'number'
        ? current.cardIndex
        : undefined
      : index;
    const normalizedCardIndex = typeof targetCardIndex === 'number' && targetCardIndex >= 0
      ? targetCardIndex
      : undefined;
    const requestId = explainRequestRef.current + 1;
    explainRequestRef.current = requestId;
    setShowExplanation(false);
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
          deckTitle: deckTitleToSend,
          deckId: normalizedDeckId,
          cardIndex: normalizedCardIndex,
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
      let streamStarted = false;
      while (true) {
        const { done, value } = await reader.read();
        if (explainRequestRef.current !== requestId) {
          reader.cancel();
          return;
        }
        if (done) break;

        if (!streamStarted) {
          streamStarted = true;
          setShowExplanation(true);
        }

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
  }, [
    answerContent,
    deckId,
    index,
    questionContent,
    studyInterleaved,
    current,
    title,
    isPaidUser,
    onRequireUpgrade,
    openAuthModal,
  ]);

  const handleExplanationBack = React.useCallback(() => {
    resetExplanation();
    setShowAnswer(true);
  }, [resetExplanation]);

  const handleBackToFlashcardsView = React.useCallback(() => {
    mindMapRequestRef.current += 1;
    setActiveMindMapRequestId(null);
    setIsMindMapModalOpen(false);
    setIsMindMapGenerating(false);
    setMindMapError(null);
    setMindMapFocusNodeId(null);
  }, []);

  const handleGenerateMindMap = React.useCallback(async () => {
    if (!displayedCards || displayedCards.length === 0) {
      return;
    }

    if (isMindMapGenerating) {
      setIsMindMapModalOpen(true);
      return;
    }

    const activeCard = displayedCards[index] ?? null;

    const trimmedCurrentMarkdown = typeof mindMapMarkdown === 'string' ? mindMapMarkdown.trim() : '';
    if (trimmedCurrentMarkdown.length > 0) {
      setMindMapError(null);
      setMindMapFocusNodeId(computeMindMapFocusNodeId(trimmedCurrentMarkdown, activeCard ?? null));
      setIsMindMapModalOpen(true);
      return;
    }

    const trimmedPersistedMarkdown = typeof persistedMindMapMarkdown === 'string' ? persistedMindMapMarkdown.trim() : '';
    if (trimmedPersistedMarkdown.length > 0) {
      setMindMapError(null);
      setMindMapMarkdown(persistedMindMapMarkdown);
      setMindMapFocusNodeId(computeMindMapFocusNodeId(trimmedPersistedMarkdown, activeCard ?? null));
      setIsMindMapModalOpen(true);
      return;
    }

    if (persistedMindMapId && !persistedMindMapMarkdown) {
      try {
        const { data, error } = await supabase
          .from('mindmaps')
          .select('markdown')
          .eq('id', persistedMindMapId)
          .maybeSingle();

        const fetchedMarkdown = data && typeof data.markdown === 'string' ? data.markdown : null;
        if (!error && fetchedMarkdown && fetchedMarkdown.trim().length > 0) {
          setPersistedMindMapMarkdown(fetchedMarkdown);
          setMindMapMarkdown(fetchedMarkdown);
          setMindMapError(null);
          setMindMapFocusNodeId(computeMindMapFocusNodeId(fetchedMarkdown, activeCard ?? null));
          setIsMindMapModalOpen(true);
          try {
            onMindMapLinked?.(persistedMindMapId, fetchedMarkdown);
          } catch (callbackError) {
            console.error('Failed to notify parent about fetched mind map:', callbackError);
          }
          return;
        }
      } catch (loadError) {
        console.error('Failed to load linked mind map:', loadError);
      }

      setPersistedMindMapId(null);
      setPersistedMindMapMarkdown(null);
      setMindMapMarkdown(null);
      try {
        onMindMapLinked?.(null, null);
      } catch (callbackError) {
        console.error('Failed to notify parent about removed mind map link:', callbackError);
      }
      if (deckId && deckId !== 'interleaved-session') {
        try {
          await supabase.from('flashcards').update({ mindmap_id: null, markdown: '' }).eq('id', deckId);
        } catch (clearError) {
          console.error('Failed to clear stale mind map link:', clearError);
        }
      }
    }

    const requestId = mindMapRequestRef.current + 1;
    mindMapRequestRef.current = requestId;

    setIsMindMapModalOpen(true);
    setMindMapError(null);
    setMindMapMarkdown(null);
    setIsMindMapGenerating(true);
    setMindMapFocusNodeId(null);
    setActiveMindMapRequestId(requestId);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      posthog.capture('mindmap_generation_from_flashcards_started', {
        card_count: displayedCards.length,
        model_choice: mindMapModelChoice,
        deck_id: deckId,
      });

      const payloadCards = displayedCards.map((card) => ({ question: card.question, answer: card.answer }));
      const response = await fetch('/api/generate-mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cards: payloadCards,
          deckTitle: title ?? undefined,
          model: mindMapModelChoice,
        }),
      });

      if (mindMapRequestRef.current !== requestId) return;

      if (response.status === 403) {
        let message = 'Smart mode is available on paid plans. Please upgrade to continue.';
        try {
          const json = await response.json();
          if (json && typeof json.message === 'string' && json.message.trim()) {
            message = json.message;
          }
        } catch {}
        setMindMapError(message);
        if (onRequireUpgrade) onRequireUpgrade();
        setIsMindMapModalOpen(false);
        return;
      }

      if (response.status === 402) {
        let message = 'Insufficient credits. Please upload a smaller deck or upgrade your plan.';
        try {
          const json = await response.json();
          if (json && typeof json.message === 'string' && json.message.trim()) {
            message = json.message;
          }
        } catch {}
        setMindMapError(message);
        setIsMindMapModalOpen(false);
        return;
      }

      if (!response.ok) {
        let message = 'Failed to generate mind map.';
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const json = await response.json();
            if (json && typeof json.error === 'string' && json.error.trim()) {
              message = json.error;
            }
          } catch {}
        } else {
          try {
            const text = await response.text();
            if (text.trim()) message = text.trim();
          } catch {}
        }
        setMindMapError(message);
        setIsMindMapModalOpen(false);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      let accumulated = '';
      let hasMountedMindMap = false;

      if (!response.body || !contentType.includes('text/plain')) {
        accumulated = await response.text();
        if (mindMapRequestRef.current !== requestId) return;
        setMindMapMarkdown(accumulated);
        dispatchMindMapStreamUpdate(requestId, accumulated, true);
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (mindMapRequestRef.current !== requestId) {
            try { await reader.cancel(); } catch {}
            return;
          }
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            accumulated += chunk;
            if (!hasMountedMindMap) {
              if (accumulated.trim().length === 0) {
                continue;
              }
              hasMountedMindMap = true;
              setMindMapMarkdown(accumulated);
              dispatchMindMapStreamUpdate(requestId, accumulated, false);
            } else {
              dispatchMindMapStreamUpdate(requestId, accumulated, false);
            }
          }
        }
        if (mindMapRequestRef.current !== requestId) return;
        if (!hasMountedMindMap && accumulated.trim().length > 0) {
          hasMountedMindMap = true;
          setMindMapMarkdown(accumulated);
        }
        dispatchMindMapStreamUpdate(requestId, accumulated, true);
        setMindMapMarkdown(accumulated);
      }

      const finalMarkdown = accumulated.trim();
      if (!finalMarkdown) {
        setMindMapError('The generated mind map was empty. Please try again.');
        setIsMindMapModalOpen(false);
        return;
      }

      setMindMapMarkdown(accumulated);
      setMindMapError(null);

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('cogniguide:mindmap-stream-complete'));
        }, 0);
      }

      if (userId) {
        await persistMindMapLink(finalMarkdown);

        try {
          const { data: creditsData } = await supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', userId)
            .single();
          const creditsValue = Number(creditsData?.credits ?? 0);
          if (Number.isFinite(creditsValue) && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', {
              detail: { credits: creditsValue, display: creditsValue.toFixed(1) },
            }));
          }
        } catch {}
      }

      posthog.capture('mindmap_generation_from_flashcards_completed', {
        card_count: displayedCards.length,
        model_choice: mindMapModelChoice,
        deck_id: deckId,
      });
    } catch (err) {
      if (mindMapRequestRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : 'Failed to generate mind map.';
      setMindMapError(message);
      setIsMindMapModalOpen(false);
    } finally {
      if (mindMapRequestRef.current === requestId) {
        setIsMindMapGenerating(false);
        setActiveMindMapRequestId(null);
      }
    }
  }, [
    displayedCards,
    computeMindMapFocusNodeId,
    deckId,
    dispatchMindMapStreamUpdate,
    index,
    isMindMapGenerating,
    mindMapMarkdown,
    mindMapModelChoice,
    onRequireUpgrade,
    persistedMindMapId,
    persistedMindMapMarkdown,
    persistMindMapLink,
    title,
    userId,
  ]);

  const handleStartEdit = React.useCallback(() => {
    if (!showAnswer || showExplanation) return;
    const activeCard = displayedCards && displayedCards[index] ? displayedCards[index] : null;
    if (!activeCard) return;
    setEditPersistenceError(null);
    setIsEditingCard(true);
    setEditedQuestion(activeCard.question);
    setEditedAnswer(activeCard.answer);
    editedQuestionSelectionRef.current = {
      start: activeCard.question.length,
      end: activeCard.question.length,
    };
    editedAnswerSelectionRef.current = {
      start: activeCard.answer.length,
      end: activeCard.answer.length,
    };
  }, [displayedCards, index, showAnswer, showExplanation]);

  const handleCancelEdit = React.useCallback(() => {
    if (isSavingEditedAnswer) return;
    setIsEditingCard(false);
    setEditedQuestion('');
    setEditedAnswer('');
    editedQuestionSelectionRef.current = null;
    editedAnswerSelectionRef.current = null;
    setEditPersistenceError(null);
  }, [isSavingEditedAnswer]);

  const handleSaveEdit = React.useCallback(async () => {
    if (isSavingEditedAnswer) return;
    const baseCards = displayedCards;
    if (!baseCards || !baseCards[index]) return;

    const previousQuestion = baseCards[index]!.question;
    const previousAnswer = baseCards[index]!.answer;
    const nextQuestion = editedQuestion;
    const nextAnswer = editedAnswer;
    if (previousQuestion === nextQuestion && previousAnswer === nextAnswer) {
      setIsEditingCard(false);
      setEditedQuestion('');
      setEditedAnswer('');
      editedQuestionSelectionRef.current = null;
      editedAnswerSelectionRef.current = null;
      setEditPersistenceError(null);
      return;
    }

    setIsSavingEditedAnswer(true);
    setEditPersistenceError(null);

    const updatedCards = baseCards.map((card, cardIndex) =>
      cardIndex === index ? { ...card, question: nextQuestion, answer: nextAnswer } : card,
    );

    setLocalCards(updatedCards);
    setScheduledCards((prev) => {
      if (!prev || !prev[index]) return prev;
      const next = [...prev];
      next[index] = { ...next[index], question: nextQuestion, answer: nextAnswer };
      return next;
    });

    const targetDeckId = studyInterleaved ? current?.deckId : deckId;
    const targetCardIndex = studyInterleaved
      ? typeof current?.cardIndex === 'number'
        ? current.cardIndex
        : undefined
      : index;

    try {
      if (
        targetDeckId &&
        targetDeckId !== 'interleaved-session' &&
        typeof targetCardIndex === 'number'
      ) {
        let payloadCards: Flashcard[] | null = null;
        if (studyInterleaved) {
          const sourceDeck = interleavedDecks?.find((deck) => deck.id === targetDeckId);
          if (sourceDeck && Array.isArray(sourceDeck.cards) && sourceDeck.cards[targetCardIndex]) {
            payloadCards = sourceDeck.cards.map((card, cardIdx) =>
              cardIdx === targetCardIndex
                ? { ...card, question: nextQuestion, answer: nextAnswer }
                : card,
            );
          } else {
            const { data: fetchedDeck, error: fetchError } = await supabase
              .from('flashcards')
              .select('cards')
              .eq('id', targetDeckId)
              .maybeSingle();
            if (fetchError) throw fetchError;
            const fetchedCardsData = (fetchedDeck?.cards ?? null) as unknown;
            const fetchedCards = Array.isArray(fetchedCardsData)
              ? (fetchedCardsData as Flashcard[])
              : null;
            if (!fetchedCards || !fetchedCards[targetCardIndex]) {
              throw new Error('Unable to locate deck cards for the edited flashcard.');
            }
            payloadCards = fetchedCards.map((card, cardIdx) =>
              cardIdx === targetCardIndex
                ? { ...card, question: nextQuestion, answer: nextAnswer }
                : card,
            );
          }
        } else {
          payloadCards = updatedCards as Flashcard[];
        }

        if (payloadCards) {
          const sanitizedCards = payloadCards.map((card) => ({
            question: card.question,
            answer: card.answer,
          }));
          let updateQuery = supabase
            .from('flashcards')
            .update({ cards: sanitizedCards })
            .eq('id', targetDeckId);
          if (userId) {
            updateQuery = updateQuery.eq('user_id', userId);
          }
          const { error: updateError } = await updateQuery;
          if (updateError) throw updateError;
        }
      }

      setIsEditingCard(false);
      setEditedQuestion('');
      setEditedAnswer('');
      editedQuestionSelectionRef.current = null;
      editedAnswerSelectionRef.current = null;
    } catch (error) {
      console.error('Failed to persist edited flashcard question or answer:', error);
      setEditPersistenceError('Failed to save changes. Please try again.');
      setLocalCards((prev) => {
        if (!prev || !prev[index]) return prev;
        const next = prev.slice();
        next[index] = { ...next[index], question: previousQuestion, answer: previousAnswer };
        return next;
      });
      setScheduledCards((prev) => {
        if (!prev || !prev[index]) return prev;
        const next = [...prev];
        next[index] = { ...next[index], question: previousQuestion, answer: previousAnswer };
        return next;
      });
    } finally {
      setIsSavingEditedAnswer(false);
    }
  }, [
    current,
    deckId,
    displayedCards,
    editedQuestion,
    editedAnswer,
    index,
    interleavedDecks,
    isSavingEditedAnswer,
    studyInterleaved,
    userId,
  ]);

  const handleEditedQuestionChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd, value } = event.target;
    editedQuestionSelectionRef.current = {
      start: typeof selectionStart === 'number' ? selectionStart : value.length,
      end: typeof selectionEnd === 'number' ? selectionEnd : value.length,
    };
    setEditedQuestion(value);
  }, []);

  const handleEditedAnswerChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd, value } = event.target;
    editedAnswerSelectionRef.current = {
      start: typeof selectionStart === 'number' ? selectionStart : value.length,
      end: typeof selectionEnd === 'number' ? selectionEnd : value.length,
    };
    setEditedAnswer(value);
  }, []);

  const adjustTextareaHeight = React.useCallback((textarea: HTMLTextAreaElement | null, minRows: number) => {
    if (!textarea) return;
    const computedStyles = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyles.lineHeight);
    const paddingTop = parseFloat(computedStyles.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyles.paddingBottom) || 0;
    const borderTop = parseFloat(computedStyles.borderTopWidth) || 0;
    const borderBottom = parseFloat(computedStyles.borderBottomWidth) || 0;
    const verticalPadding = paddingTop + paddingBottom;
    const verticalBorder = borderTop + borderBottom;
    const minHeight = Number.isFinite(lineHeight) ? lineHeight * minRows + verticalPadding + verticalBorder : 0;

    textarea.style.height = 'auto';
    const contentHeight = textarea.scrollHeight + verticalBorder;
    textarea.style.height = `${Math.max(contentHeight, minHeight)}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (!isEditingCard) return;
    adjustTextareaHeight(editedQuestionRef.current, 2);
  }, [adjustTextareaHeight, editedQuestion, isEditingCard]);

  React.useLayoutEffect(() => {
    if (!isEditingCard) return;
    adjustTextareaHeight(editedAnswerRef.current, 3);
  }, [adjustTextareaHeight, editedAnswer, isEditingCard]);

  React.useLayoutEffect(() => {
    if (!isEditingCard) return;
    const textarea = editedQuestionRef.current;
    if (!textarea) return;
    if (document.activeElement === textarea) return;

    const selection = editedQuestionSelectionRef.current;
    textarea.focus({ preventScroll: true });
    if (typeof textarea.setSelectionRange === 'function') {
      const length = textarea.value.length;
      const start = selection ? Math.min(selection.start, length) : length;
      const end = selection ? Math.min(selection.end, length) : length;
      textarea.setSelectionRange(start, end);
    }
  }, [editedQuestion, isEditingCard]);

  React.useLayoutEffect(() => {
    if (!isEditingCard) return;
    const textarea = editedAnswerRef.current;
    if (!textarea) return;
    if (document.activeElement === textarea) return;

    const selection = editedAnswerSelectionRef.current;
    textarea.focus({ preventScroll: true });
    if (typeof textarea.setSelectionRange === 'function') {
      const length = textarea.value.length;
      const start = selection ? Math.min(selection.start, length) : length;
      const end = selection ? Math.min(selection.end, length) : length;
      textarea.setSelectionRange(start, end);
    }
  }, [editedAnswer, isEditingCard]);

  React.useEffect(() => {
    if (!isEditingCard) {
      editedQuestionSelectionRef.current = null;
      editedAnswerSelectionRef.current = null;
      setEditPersistenceError(null);
    }
  }, [isEditingCard]);

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
    if (isEditingCard) return;
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
  }, [answerContent, isEditingCard, open, questionContent, renderMath]);

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
    mindMapRequestRef.current += 1;
    setActiveMindMapRequestId(null);
    setIsMindMapModalOpen(false);
    setMindMapMarkdown(null);
    setMindMapError(null);
    setIsMindMapGenerating(false);
    setMindMapFocusNodeId(null);
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
      setSignupPromptTriggered(false);
      setAuthModalSubtitleOverride(undefined);
      setShowAuthModal(false);
      setShowExamDatePopup(false);
      setCardsViewedCount(0);
      lastViewedIndexRef.current = null;
      setAnswerShownTime(null);
      setDueNowIndices([]);
      setImmediateReviewIndices([]);
      mindMapRequestRef.current += 1;
      setActiveMindMapRequestId(null);
      setIsMindMapModalOpen(false);
      setMindMapMarkdown(null);
      setMindMapError(null);
      setIsMindMapGenerating(false);
      setMindMapFocusNodeId(null);
    }
  }, [open, resetExplanation]);

  React.useEffect(() => {
    mindMapRequestRef.current += 1;
    setActiveMindMapRequestId(null);
    setIsMindMapModalOpen(false);
    setMindMapMarkdown(null);
    setMindMapError(null);
    setIsMindMapGenerating(false);
    setMindMapFocusNodeId(null);
  }, [cards, deckId]);

  React.useEffect(() => {
    setLocalCards(cards);
    setIsEditingCard(false);
    setEditedQuestion('');
    setEditedAnswer('');
    editedQuestionSelectionRef.current = null;
    editedAnswerSelectionRef.current = null;
    setEditPersistenceError(null);
  }, [cards]);

  React.useEffect(() => {
    setIsEditingCard(false);
    setEditedQuestion('');
    setEditedAnswer('');
    editedQuestionSelectionRef.current = null;
    editedAnswerSelectionRef.current = null;
    setEditPersistenceError(null);
  }, [index]);

  React.useEffect(() => {
    if (!showAnswer || showExplanation) {
      setIsEditingCard(false);
      setEditedQuestion('');
      setEditedAnswer('');
      editedQuestionSelectionRef.current = null;
      editedAnswerSelectionRef.current = null;
      setEditPersistenceError(null);
    }
  }, [showAnswer, showExplanation]);

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
    if (!open) return;
    if (isEmbedded) return;
    if (userId) return;
    if (!cards || cards.length === 0) return;
    if (lastViewedIndexRef.current === index) return;

    lastViewedIndexRef.current = index;

    setCardsViewedCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3 && !signupPromptTriggered) {
        setSignupPromptTriggered(true);
        storePendingDeckForSignup();
        openAuthModal('Sign up to save this flashcard deck and keep your study progress.');
      }
      return newCount;
    });
  }, [open, index, cards, userId, isEmbedded, signupPromptTriggered, storePendingDeckForSignup, openAuthModal]);

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
        return nextIndex;
      }
    }
    return index;
  };
  const getPrevIndex = () => {
    if (studyDueOnly && dueList.length > 0) {
      const pos = dueList.indexOf(index);
      if (pos <= 0) return index;
      return dueList[pos - 1];
    }
    if (scheduledCards && scheduledCards.length > 0) {
      if (index <= 0) return 0;
      return index - 1;
    }
    return Math.max(0, index - 1);
  };

  const canGoPrev = React.useMemo(() => {
    if (!hasCards) return false;
    if (studyDueOnly && dueList.length > 0) {
      const pos = dueList.indexOf(index);
      return pos > 0;
    }
    if (scheduledCards && scheduledCards.length > 0) {
      return index > 0;
    }
    return index > 0;
  }, [hasCards, studyDueOnly, dueList, index, scheduledCards]);

  const handlePrevCard = React.useCallback(() => {
    if (!canGoPrev) return;
    const prevIndex = getPrevIndex();
    setIndex(prevIndex);
    setShowAnswer(false);
    resetExplanation();
    setPredictedDueByGrade({});
    setAnswerShownTime(null);
  }, [canGoPrev, getPrevIndex, resetExplanation]);

  const handleNextCard = React.useCallback(() => {
    const nextIndex = getNextIndex();
    setIndex(nextIndex);
    setShowAnswer(false);
    resetExplanation();
    setPredictedDueByGrade({});
    setAnswerShownTime(null);
  }, [getNextIndex, resetExplanation]);

  const handleShowAnswer = React.useCallback(() => {
    resetExplanation();
    posthog.capture('flashcard_answer_shown', {
      deckId: deckId,
      card_index: index,
      study_due_only: studyDueOnly,
    });

    // Check if we should show exam date popup (skip for embedded mode)
    const shouldShowExamDatePopup =
      !isEmbedded && isCurrentDeckExamReady && !deckExamDate && !hasExamDatePopupBeenShown(deckIdentifier);
    if (shouldShowExamDatePopup) {
      setShowExamDatePopup(true);
    } else {
      setShowAnswer(true);
      setAnswerShownTime(Date.now());
    }
  }, [
    deckId,
    deckExamDate,
    deckIdentifier,
    hasExamDatePopupBeenShown,
    index,
    isCurrentDeckExamReady,
    isEmbedded,
    resetExplanation,
    studyDueOnly,
  ]);

  React.useEffect(() => {
    if (!open || isEmbedded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        const role = target.getAttribute('role');
        if (role === 'textbox') return;
      }

      // Ignore shortcuts when another modal/dialog is active
      if (isMindMapModalOpen || showAuthModal || showLossAversionPopup || showExamDatePopup) {
        return;
      }

      switch (event.key) {
        case 'Enter':
          if (!showAnswer) {
            event.preventDefault();
            handleShowAnswer();
          }
          break;
        case 'ArrowRight':
          if (!showAnswer) {
            event.preventDefault();
            handleNextCard();
          }
          break;
        case 'ArrowLeft':
          if (!showAnswer && canGoPrev) {
            event.preventDefault();
            handlePrevCard();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canGoPrev,
    handleNextCard,
    handlePrevCard,
    handleShowAnswer,
    isEmbedded,
    isMindMapModalOpen,
    open,
    showAnswer,
    showAuthModal,
    showExamDatePopup,
    showLossAversionPopup,
  ]);

  if (!open && !isEmbedded) return null;

  const ModalContent = () => {
    const resolvedMindMapContent = (() => {
      if (mindMapMarkdown && mindMapMarkdown.trim().length > 0) return mindMapMarkdown;
      if (persistedMindMapMarkdown && persistedMindMapMarkdown.trim().length > 0) return persistedMindMapMarkdown;
      return null;
    })();
    const hasMindMapAvailable = Boolean(resolvedMindMapContent) || Boolean(persistedMindMapId);
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
          {hasCards && (
            <button
              onClick={handleGenerateMindMap}
              disabled={isMindMapGenerating}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
              title={
                isMindMapGenerating
                  ? 'Generating an AI mind map from this deck…'
                  : hasMindMapAvailable
                    ? 'Mind map linked to this deck'
                    : 'Generate mind map from flashcards'
              }
            >
              {isMindMapGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : hasMindMapAvailable ? <MapIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>Mind map</span>
            </button>
          )}
          {onShare && (
            <ShareTriggerButton
              onClick={onShare}
              showText={true}
              title="Share link with friends"
            />
          )}
          {!userId && (
            <button
              onClick={() => openAuthModal()}
              className="inline-flex items-center justify-center h-8 px-4 rounded-full border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
              aria-label="Sign up"
              title="Sign up to save your progress"
            >
              Sign up
            </button>
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

      {mindMapError && (
        <div className="w-full max-w-5xl mx-auto mt-4 px-4 sm:px-6 md:px-0">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
            {mindMapError}
          </div>
        </div>
      )}

      <div
        className={`w-full grid grid-rows-[auto,1fr,auto] bg-background gap-y-3 ${
          isEmbedded ? 'pb-8 sm:pb-10' : 'pb-4 sm:pb-6'
        } ${!isEmbedded ? 'h-full pt-14 sm:pt-4 md:pt-6' : 'h-auto pt-4 md:pt-6'}`}
      >
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-0 mt-4">
          <div className="text-center md:text-left text-sm font-medium truncate text-foreground">{studyInterleaved ? (current?.deckTitle || title) : (title || 'Flashcards')}</div>
          <div className="text-sm text-muted-foreground text-center hidden md:block">{hasCards ? (finished ? 'Completed' : studyDueOnly ? `${originalDueList.indexOf(index) + 1} / ${originalDueCount} due` : `${index + 1} / ${totalCardCount}`) : ''}</div>
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
                    showTimeSelector={false}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground text-center md:hidden">{hasCards ? (finished ? 'Completed' : studyDueOnly ? `${originalDueList.indexOf(index) + 1} / ${originalDueCount} due` : `${index + 1} / ${totalCardCount}`) : ''}</div>
        </div>
        {hasCards && (
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
                        : totalCardCount > 0 ? ((index + 1) / totalCardCount) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
        )}

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
                        title={dueNowIndices.length > 0 ? 'Review cards that need another pass' : 'Close deck'}
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
                            setSignupPromptTriggered(false);
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
                        title="Generate a personalized deck"
                        onClick={() => {
                          if (title && displayedCards) {
                            const pendingDeck = { title, cards: displayedCards };
                            localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                          }
                          openAuthModal();
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap inline-flex items-center justify-center"
                      >
                        Generate Your Deck
                      </button>
                      <button
                        title="Review the sample deck again"
                        onClick={() => {
                          setFinished(false);
                          setIndex(0);
                          setShowAnswer(false);
                          resetExplanation();
                          setPredictedDueByGrade({});
                          setCardsViewedCount(0);
                          setSignupPromptTriggered(false);
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
                        title="Sign up to save this deck"
                        onClick={() => {
                          if (title && displayedCards) {
                            const pendingDeck = { title, cards: displayedCards };
                            localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                          }
                          openAuthModal();
                        }}
                        className="flex-1 h-auto sm:h-10 py-2 sm:py-0 px-6 text-base font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                      >
                        Sign Up & Save Deck
                      </button>
                      <button
                        title="Restart the deck"
                        onClick={() => {
                          setFinished(false);
                          setIndex(0);
                          setShowAnswer(false);
                          resetExplanation();
                          setPredictedDueByGrade({});
                          setCardsViewedCount(0);
                          setSignupPromptTriggered(false);
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
                      {isEditingCard ? (
                        <textarea
                          ref={editedQuestionRef}
                          value={editedQuestion}
                          onChange={handleEditedQuestionChange}
                          rows={2}
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-lg sm:text-[22px] font-semibold leading-7 sm:leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 resize-vertical"
                          aria-label="Question text"
                        />
                      ) : (
                        <div
                          ref={questionRef}
                          className="text-foreground text-lg sm:text-[22px] font-semibold leading-7 sm:leading-snug break-words flashcard-katex-content"
                        >
                          {questionContent}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {showAnswer && !showExplanation && !isEditingCard ? (
                          <>
                            <button
                              onClick={handleExplain}
                              disabled={isExplaining}
                              className="inline-flex items-center gap-1.5 h-6 px-3 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 flashcard-grade-good disabled:cursor-not-allowed"
                            >
                              {isExplaining ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                !isPaidUser ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null
                              )}
                              <span>Explain</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleStartEdit}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 flashcard-grade-good"
                              title="Edit in your own words"
                              aria-label="Edit question and answer"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Edit question and answer</span>
                            </button>
                          </>
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
                              isEmbedded || isEditingCard
                                ? 'max-h-none overflow-visible'
                                : 'max-h-[45vh] overflow-y-auto'
                            } text-sm text-foreground flashcard-katex-content`}
                          >
                            {isEditingCard ? (
                              <textarea
                                ref={editedAnswerRef}
                                value={editedAnswer}
                                onChange={handleEditedAnswerChange}
                                rows={3}
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 resize-vertical"
                                aria-label="Answer text"
                              />
                            ) : (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {answerContent || ''}
                              </ReactMarkdown>
                            )}
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
                  title="Go to previous card"
                  onClick={handlePrevCard}
                  disabled={!canGoPrev}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
                >
                  <ChevronLeft className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
              </div>
            ) : (
              <div />
            )}
            <div className="justify-self-center flex flex-col items-center gap-2">
              {showAnswer ? (
                showExplanation ? (
                  <button
                    title="Return to answer view"
                    onClick={handleExplanationBack}
                    className="inline-flex items-center h-10 px-5 rounded-full text-white bg-primary hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                  >
                    Back
                  </button>
                ) : isEditingCard ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center justify-center gap-3 flex-nowrap">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSavingEditedAnswer}
                        className="h-9 px-4 text-xs rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 bg-muted hover:bg-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={isSavingEditedAnswer}
                        className="inline-flex items-center justify-center gap-2 h-9 px-4 text-xs rounded-full text-white bg-primary hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSavingEditedAnswer ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Saving…</span>
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                    {editPersistenceError ? (
                      <span className="text-[11px] text-red-500 dark:text-red-400 text-center">
                        {editPersistenceError}
                      </span>
                    ) : null}
                  </div>
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
                <button
                  onClick={handleShowAnswer}
                  className="inline-flex items-center h-10 px-5 rounded-full text-white bg-primary hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
                >
                  <Eye className="h-5 w-5 mr-2" /> Show Answer
                </button>
              )}
            </div>
            {!showAnswer ? (
              <div className="justify-self-end">
                <button
                  onClick={handleNextCard}
                  className="inline-flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 rounded-full border border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50"
                  title="Skip to next card"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-5 w-5 sm:ml-2" />
                </button>
              </div>
            ) : (
              <div />
            )}
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
        <AuthModal open={showAuthModal} subtitle={authModalSubtitleOverride} />
        <style jsx global>{katexAlignmentStyles}</style>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[90] p-1 font-sans">
        <AuthModal open={showAuthModal} subtitle={authModalSubtitleOverride} />
        <ModalContent />
      </div>
      {isMindMapModalOpen && (
        <MindMapModal
          markdown={mindMapMarkdown ?? persistedMindMapMarkdown}
          onClose={handleBackToFlashcardsView}
          onBackToFlashcards={handleBackToFlashcardsView}
          disableSignupPrompts
          streamingRequestId={activeMindMapRequestId ?? undefined}
          onRequireUpgrade={onRequireUpgrade}
          isPaidUser={isPaidUser}
          initialFocusNodeId={mindMapFocusNodeId ?? undefined}
        />
      )}
      {isMindMapModalOpen && !mindMapMarkdown && !persistedMindMapMarkdown && isMindMapGenerating && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Generating mind map…</span>
          </div>
        </div>
      )}
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
                title="Save this deck and keep studying"
                onClick={() => {
                  if (title && displayedCards) {
                    const pendingDeck = { title, cards: displayedCards };
                    localStorage.setItem('cogniguide:pending_flashcards', JSON.stringify(pendingDeck));
                  }
                  setShowLossAversionPopup(false);
                  openAuthModal();
                }}
                className="w-full h-10 px-6 text-sm font-bold text-white bg-gradient-primary rounded-full hover:bg-gradient-primary-hover transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 whitespace-nowrap"
              >
                Save & Continue
              </button>
              <button
                title="Continue without saving progress"
                onClick={onClose}
                className="w-full h-10 px-6 text-sm font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/70 transition-colors whitespace-nowrap"
              >
                Continue without saving
              </button>
            </div>
          </div>
        </div>
      )}
      {showExamDatePopup && (
        <div className="fixed inset-0 flex items-center justify-center z-[110] sm:items-start sm:pt-16">
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
                  showTimeSelector={false}
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
