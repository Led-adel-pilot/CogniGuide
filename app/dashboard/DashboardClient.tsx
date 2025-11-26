'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, MindmapRecord, FlashcardsRecord, type FlashcardExplanationMap } from '@/lib/supabaseClient';
import Generator from '@/components/Generator';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import ShareLinkDialog from '@/components/ShareLinkDialog';
import { BrainCircuit, LogOut, Loader2, Map as MapIcon, Coins, Zap, Sparkles, CalendarClock, Menu, X, ChevronRight, MoreHorizontal, Edit, Trash2, Share2, Copy, Check, Gift, TrendingUp, Mail, FileText, Lock, ChevronDown, Crown } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync, loadAllDeckSchedulesAsync, upsertDeckSchedulesBulkAsync, type StoredDeckSchedule } from '@/lib/sr-store';
import { createInitialSchedule } from '@/lib/spaced-repetition';
import PricingModal from '@/components/PricingModal';
import ReverseTrialModal from '@/components/ReverseTrialModal';
import ReverseTrialEndModal from '@/components/ReverseTrialEndModal';
import OnboardingWizardModal, { WizardInputChoice, WizardModeChoice, WizardStage } from '@/components/OnboardingWizardModal';
import { requestTooltipHide } from '@/components/TooltipLayer';
import { PAID_SUBSCRIPTION_STATUSES, type ModelChoice } from '@/lib/plans';
import CogniGuideLogo from '../../CogniGuide_logo.png';
import Image from 'next/image';
import posthog from 'posthog-js';
import ThemeToggle from '@/components/ThemeToggle';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { rememberFlashcardIntent, rememberGenerationIntent } from '@/lib/generationIntent';

type SessionUser = {
  id: string;
  email?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  referralLastSeenId?: string | null;
};

type OnboardingStageState = WizardStage | 'progress';

function getMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function deriveFullNameFromMetadata(metadata: Record<string, unknown>): string | null {
  const directName =
    getMetadataString(metadata, 'full_name') ||
    getMetadataString(metadata, 'name') ||
    getMetadataString(metadata, 'preferred_username') ||
    getMetadataString(metadata, 'user_name');

  if (directName) return directName;

  const givenName = getMetadataString(metadata, 'given_name');
  const familyName = getMetadataString(metadata, 'family_name');
  const combined = [givenName, familyName].filter(Boolean).join(' ').trim();

  return combined.length > 0 ? combined : null;
}

function deriveAvatarUrlFromMetadata(metadata: Record<string, unknown>): string | null {
  return getMetadataString(metadata, 'avatar_url') || getMetadataString(metadata, 'picture');
}

function formatNameFromEmail(email?: string): string | null {
  if (!email) return null;
  const [local] = email.split('@');
  if (!local) return null;
  const words = local
    .split(/[._-]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (!words.length) return local;

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getDisplayName(user: SessionUser | null): string {
  if (!user) return 'User';
  const fromMetadata = user.fullName?.trim();
  if (fromMetadata) return fromMetadata;
  const fromEmail = formatNameFromEmail(user.email);
  if (fromEmail) return fromEmail;
  return 'User';
}

function getInitials(name: string): string {
  const words = name
    .split(/\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!words.length) {
    return name.slice(0, 2).toUpperCase();
  }

  const initials = words
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || name.slice(0, 2).toUpperCase();
}

const REFERRAL_REWARD_FALLBACK = 30;

// Extract the first emoji from a title, if any
function extractFirstEmoji(text?: string | null): string | null {
  if (!text) return null;

  // Comprehensive emoji regex that includes variation selectors and ZWJ sequences
  const emojiRegex = /([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F926}-\u{1F937}]|[\u{10000}-\u{10FFFF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F191}-\u{1F19A}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F910}-\u{1F918}]|[\u{1F980}-\u{1F984}]|[\u{1F9C0}]|[\u{1F9C0}]|[\u{1F9E0}-\u{1F9E6}]|[\u{1F90D}-\u{1F90F}]|[\u{1F9B0}-\u{1F9B3}]|[\u{1F9B8}-\u{1F9B9}]|[\u{1F9D0}-\u{1F9D2}]|[\u{1F9D5}-\u{1F9DD}]|[\u{1F9E7}-\u{1F9FF}]|[\u{1FA70}-\u{1FA73}]|[\u{1FA78}-\u{1FA7A}]|[\u{1FA80}-\u{1FA82}]|[\u{1FA90}-\u{1FA95}])(\u{FE0F})?(\u{200D}[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F926}-\u{1F937}]|[\u{10000}-\u{10FFFF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F191}-\u{1F19A}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F910}-\u{1F918}]|[\u{1F980}-\u{1F984}]|[\u{1F9C0}]|[\u{1F9C0}]|[\u{1F9E0}-\u{1F9E6}]|[\u{1F90D}-\u{1F90F}]|[\u{1F9B0}-\u{1F9B3}]|[\u{1F9B8}-\u{1F9B9}]|[\u{1F9D0}-\u{1F9D2}]|[\u{1F9D5}-\u{1F9DD}]|[\u{1F9E7}-\u{1F9FF}]|[\u{1FA70}-\u{1FA73}]|[\u{1FA78}-\u{1FA7A}]|[\u{1FA80}-\u{1FA82}]|[\u{1FA90}-\u{1FA95}])*(\u{FE0F})?/gu;

  const match = text.match(emojiRegex);
  if (match) {
    // Normalize the emoji to ensure consistent representation
    const normalized = match[0].normalize('NFC');
    return normalized;
  }

  return null;
}

// Remove the first emoji occurrence from a string (used to avoid duplicate icon + title emoji)
function removeFirstEmoji(text?: string | null): string {
  if (!text) return '';
  const e = extractFirstEmoji(text);
  if (!e) return text;
  const cleaned = text.replace(e, '').replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgradeQueryParam = searchParams.get('upgrade');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [activeMindMapId, setActiveMindMapId] = useState<string | null>(null);
  const [activeMindMapTitle, setActiveMindMapTitle] = useState<string | null>(null);
  // Full flashcards list for spaced repetition prefetching
  const [flashcardsHistory, setFlashcardsHistory] = useState<FlashcardsRecord[]>([]);
  // Sidebar combined history (paginated)
  const [combinedHistory, setCombinedHistory] = useState<Array<
    | { type: 'mindmap'; id: string; title: string | null; created_at: string; markdown: string }
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[]; mindmap_id: string | null; markdown: string | null; explanations: FlashcardExplanationMap | null }
  >>([]);
  // Pagination state
  const PAGE_SIZE = 10;
  const [mmOffset, setMmOffset] = useState(0);
  const [fcOffset, setFcOffset] = useState(0);
  const [hasMoreMm, setHasMoreMm] = useState(true);
  const [hasMoreFc, setHasMoreFc] = useState(true);
  const [historyBuffer, setHistoryBuffer] = useState<Array<
    | { type: 'mindmap'; id: string; title: string | null; created_at: string; markdown: string }
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[]; mindmap_id: string | null; markdown: string | null; explanations: FlashcardExplanationMap | null }
  >>([]);
  const [isHistoryInitialLoading, setIsHistoryInitialLoading] = useState(true);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsExplanations, setFlashcardsExplanations] = useState<FlashcardExplanationMap | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [activeDeckMindMapId, setActiveDeckMindMapId] = useState<string | null>(null);
  const [activeDeckMindMapMarkdown, setActiveDeckMindMapMarkdown] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>('fast');
  const [userTier, setUserTier] = useState<'free' | 'trial' | 'paid'>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState<boolean>(true);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<ModelChoice | null>(null);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isReverseTrialEndModalOpen, setIsReverseTrialEndModalOpen] = useState(false);
  const [trialEndStats, setTrialEndStats] = useState<{ mindmaps: number; flashcards: number; explanations: number }>({ mindmaps: 0, flashcards: 0, explanations: 0 });
  const [trialModalEligible, setTrialModalEligible] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStageState>('mode');
  const [onboardingMode, setOnboardingMode] = useState<WizardModeChoice>(null);
  const [onboardingInputChoice, setOnboardingInputChoice] = useState<WizardInputChoice>(null);
  const [onboardingPrompt, setOnboardingPrompt] = useState('');
  const [awaitingFirstOutcome, setAwaitingFirstOutcome] = useState(false);

  const trialModalSeenKeyRef = useRef<string | null>(null);
  const trialEndModalSeenKeyRef = useRef<string | null>(null);
  const onboardingSeenKeyRef = useRef<string | null>(null);
  const trialModalShownRef = useRef(false);
  const isTrialUser = userTier === 'trial';
  const isPaidUser = userTier === 'paid' || userTier === 'trial';
  const balanceDisplay = isPaidUser
    ? (Math.floor(credits * 10) / 10).toFixed(1)
    : Math.max(0, Math.floor(credits)).toString();
  const balanceLabel = isPaidUser ? 'Credits' : 'Monthly Generations left';
  const modelDetails: Record<
    ModelChoice,
    {
      label: string;
      description: string;
      lockedDescription?: string;
    }
  > = {
    fast: {
      label: 'Fast',
      description: 'Great for rapid studying sessions and everyday brainstorming.',
    },
    smart: {
      label: 'Smart',
      description: 'Produces richer, more structured outputs but consumes more credits per generation.',
      lockedDescription: 'Upgrade to unlock the Smart mode for deeper, more structured outputs. It consumes more credits per generation.',
    },
  };
  const resolvedHoveredModel = hoveredModel ?? selectedModel;
  const hoveredMessage =
    !isPaidUser && resolvedHoveredModel === 'smart'
      ? modelDetails.smart.lockedDescription ?? modelDetails.smart.description
      : modelDetails[resolvedHoveredModel].description;
  const suppressModelTooltip = isModeMenuOpen || isPricingModalOpen;
  const modelTriggerTooltip = suppressModelTooltip ? undefined : 'Change AI model';
  const suggestedTopics = [
    'Neural networks and backpropagation',
    'Photosynthesis basics and the Calvin cycle',
    'World War II causes and turning points',
    'Cardiovascular system overview',
  ];
  const hasGeneratedContent = combinedHistory.length > 0;
  const onboardingModalOpen = isOnboardingOpen && onboardingStage !== 'progress' && !hasGeneratedContent;



  type PricingModalOpenOptions = {
    name: string;
    dedupeKey?: string;
    props?: Record<string, any>;
  };

  const trackUpgradeEvent = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      try {
        posthog.capture(eventName, {
          location: 'dashboard',
          user_tier: userTier,
          is_paid_user: isPaidUser,
          is_trial_user: userTier === 'trial',
          credits_balance: credits,
          ...properties,
        });
      } catch { }
    },
    [credits, isPaidUser, userTier],
  );

  const openPricingModal = useCallback(
    ({ name, dedupeKey, props }: PricingModalOpenOptions) => {
      const key = dedupeKey ?? name;
      lastUpgradeTriggerRef.current = { key, name };
      setIsPricingModalOpen(true);
      const extraProps = props || {};
      trackUpgradeEvent('pricing_modal_opened', {
        trigger: name,
        ...extraProps,
      });
    },
    [trackUpgradeEvent],
  );

  useEffect(() => {
    if (isModeMenuOpen) {
      setHoveredModel(selectedModel);
    } else {
      setHoveredModel(null);
    }
  }, [isModeMenuOpen, selectedModel]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [spacedOpen, setSpacedOpen] = useState(false);
  const [dueQueue, setDueQueue] = useState<Array<{ id: string; title: string | null; cards: FlashcardType[]; mindmap_id?: string | null; mindmap_markdown?: string | null; explanations?: FlashcardExplanationMap | null }>>([]);
  const [studyDueOnly, setStudyDueOnly] = useState(false);
  const [studyInterleaved, setStudyInterleaved] = useState(false);
  const [dueIndices, setDueIndices] = useState<number[] | undefined>(undefined);
  const [initialDueIndex, setInitialDueIndex] = useState<number | undefined>(undefined);
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(undefined);
  const [spacedLoading, setSpacedLoading] = useState(false);
  const [spacedError, setSpacedError] = useState<string | null>(null);
  const [spacedPrefetched, setSpacedPrefetched] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const prefetchingRef = useRef(false);
  const [totalDueCount, setTotalDueCount] = useState<number>(0);
  const [cancellingDeckId, setCancellingDeckId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ id: string; type: 'mindmap' | 'flashcards'; title: string } | null>(null);
  const [shareItem, setShareItem] = useState<{ id: string; type: 'mindmap' | 'flashcards'; title: string | null } | null>(null);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{
    redemptionsThisMonth: number;
    monthlyLimit: number;
    pendingCapReached?: boolean;
  } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralRewardNotice, setReferralRewardNotice] = useState<{ amount: number } | null>(null);
  const referralRewardSeenRef = useRef<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);
  const referralLastSeenIdRef = useRef<string | null>(null);
  const referralCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referralRewardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpgradeTriggerRef = useRef<{ key: string; name: string } | null>(null);

  useEffect(() => {
    if (isModeMenuOpen) {
      requestTooltipHide();
    }
  }, [isModeMenuOpen]);

  useEffect(() => {
    if (isPricingModalOpen) {
      requestTooltipHide();
    }
  }, [isPricingModalOpen]);

  const displayName = getDisplayName(user);
  const displayInitials = getInitials(displayName);
  const avatarUrl = user?.avatarUrl ?? null;
  // Refs mirroring pagination state for async safety
  const historyBufferRef = useRef(historyBuffer);
  const hasMoreMmRef = useRef(hasMoreMm);
  const hasMoreFcRef = useRef(hasMoreFc);
  const mmOffsetRef = useRef(0);
  const fcOffsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const seenKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => { historyBufferRef.current = historyBuffer; }, [historyBuffer]);
  useEffect(() => { hasMoreMmRef.current = hasMoreMm; }, [hasMoreMm]);
  useEffect(() => { hasMoreFcRef.current = hasMoreFc; }, [hasMoreFc]);
  const handleMindMapLinked = useCallback(
    (mindmapId: string | null, markdownValue: string | null) => {
      setActiveDeckMindMapId(mindmapId);
      setActiveDeckMindMapMarkdown(markdownValue);
      const deckId = activeDeckId;
      if (!deckId || deckId === 'interleaved-session') {
        return;
      }

      const updateCombinedItems = <T extends { type: string; id: string }>(items: T[]) =>
        items.map((item) => {
          if (item.type !== 'flashcards' || item.id !== deckId) return item;
          return { ...item, mindmap_id: mindmapId ?? null, markdown: markdownValue ?? null } as T;
        }) as T[];

      setCombinedHistory((prev) => updateCombinedItems(prev));
      setHistoryBuffer((prev) => {
        const next = updateCombinedItems(prev);
        historyBufferRef.current = next;
        return next;
      });
      setFlashcardsHistory((prev) =>
        prev.map((item) =>
          item.id === deckId
            ? { ...item, mindmap_id: mindmapId ?? null, markdown: markdownValue ?? null }
            : item,
        ),
      );
      setDueQueue((prev) =>
        prev.map((deck) =>
          deck.id === deckId
            ? { ...deck, mindmap_id: mindmapId ?? null, mindmap_markdown: markdownValue ?? null }
            : deck,
        ),
      );
    },
    [activeDeckId],
  );
  useEffect(() => {
    return () => {
      if (referralCopyTimeoutRef.current) {
        clearTimeout(referralCopyTimeoutRef.current);
      }
      if (referralRewardTimeoutRef.current) {
        clearTimeout(referralRewardTimeoutRef.current);
      }
    };
  }, []);

  const fetchReferralDetails = useCallback(async () => {
    setReferralLoading(true);
    setReferralError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('You must be signed in to use referrals.');
      }
      const response = await fetch('/api/referrals/link', {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || typeof result.link !== 'string') {
        throw new Error(result?.error || 'Unable to fetch referral link.');
      }

      setReferralLink(result.link);
      setReferralCode(typeof result.code === 'string' ? result.code : null);
      const stats = result.stats;
      if (stats && typeof stats === 'object') {
        const monthlyLimit = Number((stats as any).monthlyLimit ?? 3);
        const redemptions = Number((stats as any).redemptionsThisMonth ?? 0);
        const capReached = Boolean((stats as any).pendingCapReached ?? false);
        setReferralStats({
          redemptionsThisMonth: Number.isFinite(redemptions) ? redemptions : 0,
          monthlyLimit: Number.isFinite(monthlyLimit) && monthlyLimit > 0 ? monthlyLimit : 3,
          pendingCapReached: capReached,
        });
      } else {
        setReferralStats(null);
      }
      try {
        posthog.capture('referral_link_loaded', {
          status: 'success',
          monthlyRedemptions: stats?.redemptionsThisMonth ?? 0,
        });
      } catch { }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch referral link.';
      setReferralLink(null);
      setReferralCode(null);
      setReferralStats(null);
      setReferralError(message);
      try {
        posthog.capture('referral_link_loaded', { status: 'error', message });
      } catch { }
    } finally {
      setReferralLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReferralOpen) {
      if (referralCopyTimeoutRef.current) {
        clearTimeout(referralCopyTimeoutRef.current);
        referralCopyTimeoutRef.current = null;
      }
      setReferralCopied(false);
      return;
    }

    setReferralCopied(false);
    if (referralCopyTimeoutRef.current) {
      clearTimeout(referralCopyTimeoutRef.current);
      referralCopyTimeoutRef.current = null;
    }
    try {
      posthog.capture('referral_modal_opened');
    } catch { }
    void fetchReferralDetails();
  }, [isReferralOpen, fetchReferralDetails]);

  const refreshUserTier = useCallback(
    async (userIdOverride?: string, options?: { skipLoadingState?: boolean }) => {
      const targetUserId = userIdOverride ?? userIdRef.current;
      if (!targetUserId) {
        setUserTier('free');
        setTrialEndsAt(null);
        setTierLoading(false);
        return;
      }

      if (!options?.skipLoadingState) {
        setTierLoading(true);
      }
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', targetUserId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) {
          throw error;
        }

        const status = Array.isArray(data) && data.length > 0 ? (data[0] as any).status : null;
        let nextTier: 'free' | 'trial' | 'paid' = 'free';
        let nextTrialEnds: string | null = null;
        const paidStatuses = new Set(PAID_SUBSCRIPTION_STATUSES);

        if (status && paidStatuses.has(status)) {
          nextTier = 'paid';
        } else {
          const { data: trialData } = await supabase
            .from('user_credits')
            .select('trial_ends_at')
            .eq('user_id', targetUserId)
            .maybeSingle();
          const trialEnds = typeof trialData?.trial_ends_at === 'string' ? trialData.trial_ends_at : null;
          if (trialEnds && Date.parse(trialEnds) > Date.now()) {
            nextTier = 'trial';
            nextTrialEnds = trialEnds;
          }
        }

        setTrialEndsAt(nextTrialEnds);
        setUserTier(nextTier);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`cogniguide_user_tier_${targetUserId}`, nextTier);
          }
        } catch { }
      } catch (err) {
        console.error('Failed to load subscription status:', err);
        setUserTier('free');
        setTrialEndsAt(null);
      } finally {
        setTierLoading(false);
      }
    },
    [supabase]
  );

  const handleCopyReferralLink = async () => {
    if (!referralLink) return;
    if (referralCopyTimeoutRef.current) {
      clearTimeout(referralCopyTimeoutRef.current);
      referralCopyTimeoutRef.current = null;
    }
    const success = await copyTextToClipboard(referralLink);
    if (success) {
      setReferralCopied(true);
      setReferralError(null);
      referralCopyTimeoutRef.current = setTimeout(() => {
        setReferralCopied(false);
        referralCopyTimeoutRef.current = null;
      }, 2000);
      try {
        posthog.capture('referral_link_copied');
      } catch { }
    } else {
      setReferralCopied(false);
      setReferralError('Unable to copy link automatically. Please copy it manually.');
    }
  };

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    referralLastSeenIdRef.current = user?.referralLastSeenId ?? null;

    if (user?.id) {
      onboardingSeenKeyRef.current = `cogniguide_onboarding_seen_${user.id}`;
    } else {
      onboardingSeenKeyRef.current = null;
      setIsOnboardingOpen(false);
      setOnboardingMode(null);
      setOnboardingInputChoice(null);
      setAwaitingFirstOutcome(false);
    }

    if (user?.id) {
      let cachedTier: 'free' | 'trial' | 'paid' | null = null;
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`cogniguide_user_tier_${user.id}`);
          if (stored === 'free' || stored === 'paid' || stored === 'trial') {
            cachedTier = stored;
          }
        }
      } catch { }

      if (cachedTier) {
        setUserTier(cachedTier);
        setTierLoading(false);
        void refreshUserTier(user.id, { skipLoadingState: true });
      } else {
        setTierLoading(true);
        void refreshUserTier(user.id);
      }
    } else {
      setUserTier('free');
      setTierLoading(false);
      setSelectedModel('fast');
      setTrialEndsAt(null);
      setIsTrialModalOpen(false);
      setTrialModalEligible(false);
    }
  }, [user, refreshUserTier]);

  useEffect(() => {
    if (!isPaidUser && selectedModel === 'smart') {
      setSelectedModel('fast');
    }
  }, [isPaidUser, selectedModel]);

  useEffect(() => {
    setTrialModalEligible(false);
  }, [user?.id]);

  useEffect(() => {
    if (isTrialModalOpen) {
      trialModalShownRef.current = true;
    }
  }, [isTrialModalOpen]);

  useEffect(() => {
    if (!user?.id || !trialEndsAt || userTier !== 'trial') {
      setIsTrialModalOpen(false);
      setTrialModalEligible(false);
      trialModalSeenKeyRef.current = null;
      setIsReverseTrialEndModalOpen(false);
      return;
    }
    const key = `cogniguide_trial_modal_${user.id}_${trialEndsAt}`;
    trialModalSeenKeyRef.current = key;
    let seen = false;
    try {
      if (typeof window !== 'undefined') {
        seen = localStorage.getItem(key) === '1';
      }
    } catch { }
    setTrialModalEligible(!seen);
    if (seen) {
      setIsTrialModalOpen(false);
    } else {
      setIsTrialModalOpen(true);
    }

    // Check for Reverse Trial End Modal (Day 7)
    const end = new Date(trialEndsAt);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // If 1 day or less remaining (meaning today or tomorrow it expires), trigger "Day 7" modal
    // The trial is 7 days. If diffDays <= 1, we are at the end.
    if (diffDays <= 1) {
      const endModalKey = `cogniguide_trial_end_modal_seen_${user.id}_${trialEndsAt}`;
      trialEndModalSeenKeyRef.current = endModalKey;
      let endSeen = false;
      try {
        if (typeof window !== 'undefined') {
          endSeen = localStorage.getItem(endModalKey) === '1';
        }
      } catch { }

      if (!endSeen && !tierLoading) {
        // Calculate stats and show modal
        const calculateStats = async () => {
          try {
            // Mindmaps count
            const { count: mindmapsCount } = await supabase
              .from('mindmaps')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);

            // Flashcards count and explanations count
            // We use flashcardsHistory which should be populated by now or we can fetch fresh
            // Since this might run before flashcardsHistory is fully populated, let's fetch explicitly if needed
            // But loadAllFlashcardsOnly is called on init. We can wait or just fetch.
            // To be safe and accurate, let's fetch lightweight data.
            const { data: fcData } = await supabase
              .from('flashcards')
              .select('explanations')
              .eq('user_id', user.id);

            let flashcardsCount = 0;
            let explanationsCount = 0;

            if (fcData) {
              flashcardsCount = fcData.length;
              fcData.forEach((row: any) => {
                if (row.explanations && typeof row.explanations === 'object') {
                  explanationsCount += Object.keys(row.explanations).length;
                }
              });
            }

            setTrialEndStats({
              mindmaps: mindmapsCount || 0,
              flashcards: flashcardsCount,
              explanations: explanationsCount
            });
            setIsReverseTrialEndModalOpen(true);
            // Mark as seen immediately to prevent double show on reload if they don't act?
            // Or mark seen on close? The prompt implies "On login", so once per session/day.
            // Marking on close is safer.
          } catch (e) {
            console.error("Failed to calculate trial stats", e);
          }
        };
        calculateStats();
      }
    }
  }, [user?.id, trialEndsAt, userTier, tierLoading]);



  const persistReferralRedemptionSeen = useCallback(
    async (redemptionId: string, userId: string) => {
      if (!redemptionId || !userId) {
        return;
      }
      if (referralLastSeenIdRef.current === redemptionId) {
        return;
      }
      try {
        const { error } = await supabase.auth.updateUser({
          data: { referral_last_seen_id: redemptionId },
        });
        if (error) {
          throw error;
        }
        referralLastSeenIdRef.current = redemptionId;
        setUser((prev) => (prev && prev.id === userId ? { ...prev, referralLastSeenId: redemptionId } : prev));
      } catch (error) {
        console.error('Failed to persist referral acknowledgement:', error);
      }
    },
    [setUser]
  );

  const handleDismissTrialModal = useCallback(() => {
    const key = trialModalSeenKeyRef.current;
    if (key && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, '1');
      } catch { }
    }
    setIsTrialModalOpen(false);
    setTrialModalEligible(false);
  }, []);

  const handleDismissReverseTrialEndModal = useCallback(() => {
    const key = trialEndModalSeenKeyRef.current;
    if (key && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, '1');
      } catch { }
    }
    setIsReverseTrialEndModalOpen(false);
  }, []);

  const handleUpgradeFromEndModal = useCallback(() => {
    handleDismissReverseTrialEndModal();
    openPricingModal({ name: 'reverse_trial_end_modal' });
  }, [handleDismissReverseTrialEndModal, openPricingModal]);

  const markOnboardingSeen = useCallback(() => {
    const key = onboardingSeenKeyRef.current;
    if (key && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, '1');
      } catch { }
    }
    setIsOnboardingOpen(false);
    setAwaitingFirstOutcome(false);
    setOnboardingStage('mode');
  }, []);

  const focusGeneratorArea = useCallback(() => {
    if (typeof window === 'undefined') return;
    const generatorNode = document.getElementById('generator-panel');
    if (generatorNode) {
      generatorNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const synchronizeGeneratorMode = useCallback(
    (mode: Exclude<WizardModeChoice, null>) => {
      setOnboardingMode(mode);
      if (mode === 'flashcards') {
        rememberFlashcardIntent();
      } else {
        rememberGenerationIntent('mindmap');
      }

      if (typeof window !== 'undefined') {
        try {
          const target = document.querySelector(`button[data-mode="${mode}"]`);
          if (target) {
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        } catch { }
      }

      setIsOnboardingOpen(true);
      setOnboardingStage('input');
      setOnboardingInputChoice(null);
    },
    []
  );

  const applyPromptToForm = useCallback((promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || typeof window === 'undefined') return false;
    const textarea = document.getElementById('prompt-input') as HTMLTextAreaElement | null;
    if (!textarea) return false;

    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, trimmed);
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
      textarea.focus();
      return true;
    } catch {
      return false;
    }
  }, []);

  const handlePromptPrefill = useCallback(
    (topic: string) => {
      const normalizedTopic = topic.trim();
      if (!normalizedTopic) return;
      const prefix = onboardingMode === 'flashcards' ? 'Generate flashcards about' : 'Create a mind map about';
      const promptText = `${prefix} ${normalizedTopic}`;
      setOnboardingPrompt(promptText);
      setOnboardingInputChoice('prompt');
      setAwaitingFirstOutcome(true);
      focusGeneratorArea();
      setOnboardingStage('progress');
      setIsOnboardingOpen(false);
      applyPromptToForm(promptText);
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cogniguide:onboarding-auto-submit', { detail: { reason: 'prompt-prefill' } }));
        }
      } catch { }
    },
    [applyPromptToForm, focusGeneratorArea, onboardingMode]
  );

  const handleUploadChosen = useCallback(() => {
    setOnboardingInputChoice('upload');
    setAwaitingFirstOutcome(true);
    focusGeneratorArea();
    setOnboardingStage('progress');
    setIsOnboardingOpen(false);
  }, [focusGeneratorArea]);

  const handleOnboardingModeSelect = useCallback(
    (mode: Exclude<WizardModeChoice, null>) => {
      synchronizeGeneratorMode(mode);
      setAwaitingFirstOutcome(false);
      setOnboardingInputChoice(null);
      setOnboardingStage('input');
    },
    [synchronizeGeneratorMode]
  );

  const handleBackToModeStage = useCallback(() => {
    setOnboardingStage('mode');
    setIsOnboardingOpen(true);
    setAwaitingFirstOutcome(false);
    setOnboardingInputChoice(null);
  }, []);

  const handleCloseOnboardingModal = useCallback(() => {
    setIsOnboardingOpen(false);
    if (awaitingFirstOutcome) {
      setOnboardingStage('progress');
    }
  }, [awaitingFirstOutcome]);

  const handleOnboardingPromptChange = useCallback((value: string) => {
    setOnboardingPrompt(value);
  }, []);

  useEffect(() => {
    if (!user?.id || isHistoryInitialLoading) return;
    if (combinedHistory.length > 0) {
      markOnboardingSeen();
    }
  }, [combinedHistory.length, isHistoryInitialLoading, markOnboardingSeen, user?.id]);

  useEffect(() => {
    if (!user?.id || isHistoryInitialLoading) return;
    let onboardingSeen = false;
    try {
      if (onboardingSeenKeyRef.current && typeof window !== 'undefined') {
        onboardingSeen = localStorage.getItem(onboardingSeenKeyRef.current) === '1';
      }
    } catch { }

    if (onboardingSeen || combinedHistory.length > 0) return;
    if (trialModalShownRef.current && isTrialModalOpen) return;
    if (awaitingFirstOutcome || onboardingStage === 'progress') return;
    if (isOnboardingOpen) return;

    setIsOnboardingOpen(true);
    if (!onboardingMode) {
      setOnboardingMode('mindmap');
    }
    setOnboardingStage('mode');
  }, [awaitingFirstOutcome, combinedHistory.length, isHistoryInitialLoading, isTrialModalOpen, onboardingMode, onboardingStage, user?.id]);

  const showReferralRewardNotice = useCallback((amount: number, redemptionId?: string, userIdOverride?: string) => {
    const key = redemptionId ? `referral:${redemptionId}` : `manual:${amount}`;
    if (referralRewardSeenRef.current.has(key)) {
      return;
    }
    referralRewardSeenRef.current.add(key);
    const targetUserId = userIdOverride ?? userIdRef.current;
    if (redemptionId && targetUserId) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cogniguide_referral_last_seen_${targetUserId}`, redemptionId);
        }
      } catch { }
      void persistReferralRedemptionSeen(redemptionId, targetUserId);
    }
    if (referralRewardTimeoutRef.current) {
      clearTimeout(referralRewardTimeoutRef.current);
      referralRewardTimeoutRef.current = null;
    }
    setReferralRewardNotice({ amount });
    referralRewardTimeoutRef.current = setTimeout(() => {
      setReferralRewardNotice(null);
      referralRewardTimeoutRef.current = null;
    }, 8000);
  }, [persistReferralRedemptionSeen]);

  const dismissReferralRewardNotice = useCallback(() => {
    if (referralRewardTimeoutRef.current) {
      clearTimeout(referralRewardTimeoutRef.current);
      referralRewardTimeoutRef.current = null;
    }
    setReferralRewardNotice(null);
  }, []);

  const handleSelectModel = useCallback(
    (choice: ModelChoice) => {
      requestTooltipHide();
      const allowed = choice === 'fast' || isPaidUser;
      try {
        posthog.capture('generation_model_option_clicked', {
          model: choice,
          allowed,
          location: 'dashboard',
        });
      } catch { }

      if (!allowed) {
        openPricingModal({
          name: 'model_selector_locked',
          props: { requested_model: choice },
        });
        setIsModeMenuOpen(false); // Close the popover when showing pricing modal
        return;
      }

      setSelectedModel(choice);
      setHoveredModel(choice);
      setIsModeMenuOpen(false);
    },
    [isPaidUser, openPricingModal]
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    if (user.referralLastSeenId) {
      referralRewardSeenRef.current.add(`referral:${user.referralLastSeenId}`);
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedId = localStorage.getItem(`cogniguide_referral_last_seen_${user.id}`);
      if (storedId) {
        referralRewardSeenRef.current.add(`referral:${storedId}`);
      }
    } catch { }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    const loadLatestRedemption = async () => {
      const { data, error } = await supabase
        .from('referral_redemptions')
        .select('id, reward_credits')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) {
        return;
      }
      const redemptionId = typeof data.id === 'string' && data.id ? data.id : undefined;
      if (!redemptionId) {
        return;
      }
      const key = `referral:${redemptionId}`;
      if (referralRewardSeenRef.current.has(key)) {
        return;
      }
      let storedId: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          storedId = localStorage.getItem(`cogniguide_referral_last_seen_${user.id}`);
        } catch { }
      }
      const seenId = storedId || user.referralLastSeenId || referralLastSeenIdRef.current;
      if (seenId === redemptionId) {
        referralRewardSeenRef.current.add(key);
        return;
      }
      const parsedReward = Number((data as any).reward_credits);
      const rewardAmount = Number.isFinite(parsedReward) && parsedReward > 0 ? parsedReward : REFERRAL_REWARD_FALLBACK;
      showReferralRewardNotice(rewardAmount, redemptionId, user?.id);
    };
    void loadLatestRedemption();
    return () => {
      cancelled = true;
    };
  }, [user, showReferralRewardNotice]);

  const redeemPendingReferral = useCallback(async () => {
    if (typeof window === 'undefined') return;
    let storedCode: string | null = null;
    try {
      storedCode = localStorage.getItem('cogniguide_pending_referral');
      if (!storedCode) {
        return;
      }
      localStorage.removeItem('cogniguide_pending_referral');
    } catch {
      return;
    }

    const trimmed = storedCode.trim();
    if (!trimmed) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const currentUserId = sessionData?.session?.user?.id || null;
      if (!accessToken) return;
      const response = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.ok) {
        const rawReward = Number((result as any)?.redeemerReward ?? (result as any)?.reward ?? REFERRAL_REWARD_FALLBACK);
        const rewardAmount = Number.isFinite(rawReward) && rawReward > 0 ? rawReward : REFERRAL_REWARD_FALLBACK;
        showReferralRewardNotice(rewardAmount, undefined, currentUserId || undefined);
        if (typeof (result as any)?.redeemerCredits === 'number') {
          const creditsValue = Number((result as any).redeemerCredits);
          if (Number.isFinite(creditsValue)) {
            setCredits(creditsValue);
            try {
              if (typeof window !== 'undefined' && currentUserId) {
                localStorage.setItem(`cogniguide_credits_${currentUserId}`, creditsValue.toString());
                localStorage.setItem(`cogniguide_credits_time_${currentUserId}`, Date.now().toString());
              }
            } catch { }
          }
        }
        try {
          posthog.capture('referral_code_redeemed', { status: 'success', actor: 'redeemer', reward: rewardAmount });
        } catch { }
      } else {
        const errorMessage = result?.error || 'Referral redemption failed.';
        console.warn('Referral redemption failed:', errorMessage);
        try {
          posthog.capture('referral_code_redeemed', { status: 'failed', error: errorMessage, actor: 'redeemer' });
        } catch { }
      }
    } catch (error) {
      console.error('Error redeeming referral code:', error);
      try {
        posthog.capture('referral_code_redeemed', { status: 'error', actor: 'redeemer' });
      } catch { }
    }
  }, [showReferralRewardNotice]);

  const handleClosePricingModal = useCallback(
    (reason: 'close_button' | 'overlay' | 'complete' = 'close_button') => {
      setIsPricingModalOpen(false);
      trackUpgradeEvent('pricing_modal_closed', {
        trigger: lastUpgradeTriggerRef.current?.name ?? null,
        reason,
      });
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cogniguide_open_upgrade');
          localStorage.removeItem('cogniguide_upgrade_flow');
        }
      } catch { }
      router.replace('/dashboard', { scroll: false });
    },
    [router, trackUpgradeEvent],
  );

  const loadUserCredits = async (userId: string) => {
    // Check localStorage cache first (for faster loads on same session)
    try {
      if (typeof window !== 'undefined') {
        const cachedCredits = localStorage.getItem(`cogniguide_credits_${userId}`);
        const cachedTime = localStorage.getItem(`cogniguide_credits_time_${userId}`);
        const now = Date.now();

        // Use cache if it's less than 5 minutes old
        if (cachedCredits && cachedTime && (now - parseInt(cachedTime)) < 5 * 60 * 1000) {
          setCredits(parseFloat(cachedCredits));
          // Still refresh in background for accuracy
          setTimeout(() => loadUserCreditsFromAPI(userId), 100);
          return;
        }
      }
    } catch { }

    // Load from API
    await loadUserCreditsFromAPI(userId);
  };

  const loadUserCreditsFromAPI = async (userId: string) => {
    // Ensure initial/monthly free credits for non-subscribers on dashboard load
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken) {
        const response = await fetch('/api/ensure-credits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        if (result.ok && typeof result.credits === 'number') {
          setCredits(result.credits);
          const normalizedTier = result.tier === 'paid' ? 'paid' : result.tier === 'trial' ? 'trial' : 'free';
          if (normalizedTier) {
            setUserTier(normalizedTier);
            setTierLoading(false);
          }
          const nextTrialEnds = normalizedTier === 'trial' && typeof result.trialEndsAt === 'string'
            ? result.trialEndsAt
            : null;
          setTrialEndsAt(nextTrialEnds);
          // Cache the result
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`cogniguide_credits_${userId}`, result.credits.toString());
              localStorage.setItem(`cogniguide_credits_time_${userId}`, Date.now().toString());
            }
          } catch { }
          return; // Successfully loaded credits from API response
        }
      }
    } catch (apiError) {
      console.warn('Failed to load credits via ensure API:', apiError);
    }

    // Fallback: fetch credits directly from database if API call failed
    const { data } = await supabase
      .from('user_credits')
      .select('credits, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      const val = Number((data as any).credits ?? 0);
      const finalCredits = Number.isFinite(val) ? val : 0;
      setCredits(finalCredits);
      const trialEnds = typeof (data as any).trial_ends_at === 'string' ? (data as any).trial_ends_at : null;
      const trialActive = trialEnds && Date.parse(trialEnds) > Date.now();
      if (trialActive) {
        setUserTier('trial');
        setTrialEndsAt(trialEnds);
      } else {
        setTrialEndsAt(null);
      }
      // Cache the fallback result too
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cogniguide_credits_${userId}`, finalCredits.toString());
          localStorage.setItem(`cogniguide_credits_time_${userId}`, Date.now().toString());
        }
      } catch { }
    }
  };

  useEffect(() => {
    let handleGenerationComplete: (() => void) | null = null;
    let handleCreditsUpdated: ((event: CustomEvent) => void) | null = null;

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = deriveFullNameFromMetadata(metadata);
      const avatarUrl = deriveAvatarUrlFromMetadata(metadata);
      const lastSeenFromMetadata =
        typeof metadata['referral_last_seen_id'] === 'string' ? (metadata['referral_last_seen_id'] as string) : null;
      const authed = data.user
        ? {
          id: data.user.id,
          email: data.user.email || undefined,
          fullName,
          avatarUrl,
          referralLastSeenId: lastSeenFromMetadata,
        }
        : null;
      setUser(authed);
      setLoading(false);
      if (!authed) {
        router.replace('/');
        return;
      }

      await redeemPendingReferral();

      // Check for and save a pending mind map from a pre-auth session
      try {
        const pendingMarkdown = localStorage.getItem('cogniguide:pending_mindmap');
        if (pendingMarkdown && authed.id) {
          // Clear immediately to prevent re-saving on refresh
          localStorage.removeItem('cogniguide:pending_mindmap');

          const title = extractTitle(pendingMarkdown);
          const { data: insertData, error: insertError } = await supabase
            .from('mindmaps')
            .insert({
              user_id: authed.id,
              title,
              markdown: pendingMarkdown,
            })
            .select()
            .single();

          setActiveMindMapId(null);
          setActiveMindMapTitle(null);

          if (!insertError && insertData) {
            const insertedId = typeof insertData.id === 'string' ? insertData.id : null;
            const insertedTitle = typeof insertData.title === 'string' ? insertData.title : null;
            setActiveMindMapId(insertedId);
            setActiveMindMapTitle(insertedTitle);
            // Open the newly saved mind map for a seamless UX
            setMarkdown(pendingMarkdown);
            // Reload sidebar history to show the new item
            await initPaginatedHistory(authed.id);
          } else if (insertError) {
            console.error('Failed to save pending mind map:', insertError);
          }
        }
      } catch (e) {
        console.error('Error processing pending mind map:', e);
      }

      // Check for and save a pending flashcard deck from a pre-auth session
      try {
        const pendingFlashcardsRaw = localStorage.getItem('cogniguide:pending_flashcards');
        if (pendingFlashcardsRaw && authed.id) {
          // Clear immediately to prevent re-saving
          localStorage.removeItem('cogniguide:pending_flashcards');

          const pendingDeck = JSON.parse(pendingFlashcardsRaw);
          if (pendingDeck && pendingDeck.title && Array.isArray(pendingDeck.cards)) {
            const { data: insertData, error: insertError } = await supabase
              .from('flashcards')
              .insert({
                user_id: authed.id,
                title: pendingDeck.title,
                cards: pendingDeck.cards,
                markdown: '', // No markdown since it's from a non-mindmap source
              })
              .select()
              .single();

            if (!insertError && insertData) {
              // Reload sidebar history to show the new item
              await initPaginatedHistory(authed.id);
              // Optionally, you could auto-open the new deck here
            } else if (insertError) {
              console.error('Failed to save pending flashcards:', insertError);
            }
          }
        }
      } catch (e) {
        console.error('Error processing pending flashcards:', e);
      }

      // Define event handlers
      handleGenerationComplete = () => {
        const generationFlagUserId = userIdRef.current ?? authed.id ?? null;
        if (generationFlagUserId) {
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`cogniguide:has_generated_${generationFlagUserId}`, '1');
            }
          } catch { }
        }
        if (authed.id) {
          initPaginatedHistory(authed.id);
          loadAllFlashcardsOnly(authed.id).then((allFlash) => {
            try { prefetchSpacedData(allFlash); } catch { }
          });
        }
      };

      handleCreditsUpdated = (event: CustomEvent) => {
        const { credits } = event.detail;
        if (typeof credits === 'number') {
          setCredits(credits);
          // Also update cache
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`cogniguide_credits_${authed.id}`, credits.toString());
              localStorage.setItem(`cogniguide_credits_time_${authed.id}`, Date.now().toString());
            }
          } catch { }
        }
      };

      // Load credits immediately (no dependency on history loading)
      loadUserCredits(authed.id);

      // Initialize paginated sidebar history and spaced data prefetch
      await initPaginatedHistory(authed.id);
      try {
        const allFlash = await loadAllFlashcardsOnly(authed.id);
        await prefetchSpacedData(allFlash);
      } catch { }

      // Add event listeners
      window.addEventListener('cogniguide:generation-complete', handleGenerationComplete);
      window.addEventListener('cogniguide:credits-updated', handleCreditsUpdated as EventListener);

    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
        // CRITICAL: Clear auth cookie to prevent middleware redirect loop
        try {
          if (typeof document !== 'undefined') {
            document.cookie = 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
          }
        } catch { }
        router.replace('/');
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      if (handleGenerationComplete) {
        window.removeEventListener('cogniguide:generation-complete', handleGenerationComplete);
      }
      if (handleCreditsUpdated) {
        window.removeEventListener('cogniguide:credits-updated', handleCreditsUpdated as EventListener);
      }
    };
  }, [router, redeemPendingReferral]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let hasLocalFlag = false;
    try {
      hasLocalFlag =
        localStorage.getItem('cogniguide_open_upgrade') === 'true' ||
        localStorage.getItem('cogniguide_upgrade_flow') === 'true';
    } catch {
      hasLocalFlag = false;
    }

    const hasUpgradeQuery = Boolean(upgradeQueryParam);
    const dedupeKey = hasUpgradeQuery ? `query:${upgradeQueryParam}` : hasLocalFlag ? 'local' : null;

    if (!dedupeKey) {
      lastUpgradeTriggerRef.current = null;
      return;
    }

    if (lastUpgradeTriggerRef.current?.key === dedupeKey) {
      if (hasLocalFlag) {
        try {
          localStorage.removeItem('cogniguide_open_upgrade');
          localStorage.removeItem('cogniguide_upgrade_flow');
        } catch { }
      }
      return;
    }

    const triggerName = hasUpgradeQuery ? 'upgrade_query_param' : 'local_upgrade_flag';
    openPricingModal({
      name: triggerName,
      dedupeKey,
      props: {
        auto_open: true,
        query_value: hasUpgradeQuery ? upgradeQueryParam : undefined,
        source: hasUpgradeQuery ? 'query_param' : 'local_storage',
      },
    });
    if (hasLocalFlag) {
      try {
        localStorage.removeItem('cogniguide_open_upgrade');
        localStorage.removeItem('cogniguide_upgrade_flow');
      } catch { }
    }
  }, [openPricingModal, upgradeQueryParam]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const creditsChannel = supabase
      .channel(`user_credits_change_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && typeof (payload.new as any).credits === 'number') {
            const val = Number((payload.new as any).credits ?? 0);
            const finalCredits = Number.isFinite(val) ? val : 0;
            setCredits(finalCredits);
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem(`cogniguide_credits_${user.id}`, finalCredits.toString());
                localStorage.setItem(`cogniguide_credits_time_${user.id}`, Date.now().toString());
              }
            } catch { }
          }
        }
      )
      .subscribe();

    const referralsChannel = supabase
      .channel(`referral_rewards_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'referral_redemptions',
          filter: `referrer_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = (payload.new ?? {}) as { id?: string; reward_credits?: number };
          const parsedReward = Number(newRow.reward_credits);
          const rewardAmount = Number.isFinite(parsedReward) && parsedReward > 0 ? parsedReward : REFERRAL_REWARD_FALLBACK;
          const redemptionId = typeof newRow.id === 'string' && newRow.id ? newRow.id : undefined;
          showReferralRewardNotice(rewardAmount, redemptionId, user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(creditsChannel);
      supabase.removeChannel(referralsChannel);
      window.removeEventListener('cogniguide:generation-complete', () => { });
      window.removeEventListener('cogniguide:credits-updated', () => { });
    };
  }, [user, showReferralRewardNotice]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenMenuId(null);
      setMenuPosition(null);
    };
    if (openMenuId) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [openMenuId]);

  // Infinite scroll: observe sentinel inside sidebar list
  useEffect(() => {
    if (!user) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const rootEl = listRef.current || undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMoreHistory(user.id);
        }
      }
    }, { root: rootEl, rootMargin: '0px 0px 200px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [user, hasMoreHistory, isHistoryInitialLoading]);

  // Load all flashcards for spaced repetition prefetch (separate from sidebar pagination)
  const loadAllFlashcardsOnly = async (userId: string) => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const fcArr = (!error && data ? (data as any as FlashcardsRecord[]) : []);
    setFlashcardsHistory(fcArr);
    return fcArr;
  };

  // Fetch a chunk of mindmaps
  const fetchMindmapsChunk = async (userId: string, offset: number, size: number) => {
    const { data, error } = await supabase
      .from('mindmaps')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1);
    const mmArr = (!error && data ? (data as any as MindmapRecord[]) : []);
    return mmArr.map((m) => ({
      type: 'mindmap' as const,
      id: m.id,
      title: m.title,
      created_at: m.created_at,
      markdown: m.markdown,
    }));
  };

  // Fetch a chunk of flashcards
  const fetchFlashcardsChunk = async (userId: string, offset: number, size: number) => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1);
    const fcArr = (!error && data ? (data as any as FlashcardsRecord[]) : []);
    return fcArr.map((f) => ({
      type: 'flashcards' as const,
      id: f.id,
      title: f.title,
      created_at: f.created_at,
      cards: (f.cards as any) as FlashcardType[],
      mindmap_id: f.mindmap_id ?? null,
      markdown: f.markdown ?? null,
      explanations: f.explanations ?? null,
    }));
  };

  const mergeAndSort = (arr: typeof combinedHistory) =>
    [...arr].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const fetchNextIntoBuffer = async (userId: string) => {
    if (isFetchingRef.current) return [] as typeof combinedHistory;
    isFetchingRef.current = true;
    try {
      const mmStart = mmOffsetRef.current;
      const fcStart = fcOffsetRef.current;
      const [mmItems, fcItems] = await Promise.all([
        hasMoreMmRef.current ? fetchMindmapsChunk(userId, mmStart, PAGE_SIZE) : Promise.resolve([]),
        hasMoreFcRef.current ? fetchFlashcardsChunk(userId, fcStart, PAGE_SIZE) : Promise.resolve([]),
      ]);

      if (hasMoreMmRef.current) {
        mmOffsetRef.current = mmStart + mmItems.length;
        setMmOffset(mmOffsetRef.current);
        if (mmItems.length < PAGE_SIZE) setHasMoreMm(false);
      }
      if (hasMoreFcRef.current) {
        fcOffsetRef.current = fcStart + fcItems.length;
        setFcOffset(fcOffsetRef.current);
        if (fcItems.length < PAGE_SIZE) setHasMoreFc(false);
      }

      const keyOf = (x: any) => `${x.type}:${x.id}`;
      // Seed seen with already-rendered and buffered items
      for (const it of combinedHistory) seenKeysRef.current.add(keyOf(it));
      for (const it of historyBufferRef.current) seenKeysRef.current.add(keyOf(it));

      const mergedSorted = mergeAndSort([...mmItems, ...fcItems]);
      const deduped: typeof combinedHistory = [];
      for (const item of mergedSorted) {
        const key = keyOf(item);
        if (!seenKeysRef.current.has(key)) {
          seenKeysRef.current.add(key);
          deduped.push(item);
        }
      }
      return deduped;
    } finally {
      isFetchingRef.current = false;
    }
  };

  const initPaginatedHistory = async (userId: string) => {
    setIsHistoryInitialLoading(true);
    setCombinedHistory([]);
    setHistoryBuffer([]);
    historyBufferRef.current = [];
    setMmOffset(0);
    setFcOffset(0);
    mmOffsetRef.current = 0;
    fcOffsetRef.current = 0;
    seenKeysRef.current = new Set();
    setHasMoreMm(true);
    setHasMoreFc(true);
    setHasMoreHistory(true);
    const newItems = await fetchNextIntoBuffer(userId);
    const bufferAfter = mergeAndSort([...historyBufferRef.current, ...newItems]);
    const take = Math.min(PAGE_SIZE, bufferAfter.length);
    const first = bufferAfter.slice(0, take);
    historyBufferRef.current = bufferAfter.slice(take);
    setHistoryBuffer(historyBufferRef.current);
    setCombinedHistory(first);
    if (first.length === 0) {
      // Fallback: top-10 combined if chunk APIs return empty
      try {
        const [mm, fc] = await Promise.all([
          supabase
            .from('mindmaps')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE),
          supabase
            .from('flashcards')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE),
        ]);
        const mmArr = (!mm.error && mm.data ? (mm.data as any as MindmapRecord[]) : []);
        const fcArr = (!fc.error && fc.data ? (fc.data as any as FlashcardsRecord[]) : []);
        const merged = mergeAndSort([
          ...mmArr.map((m) => ({ type: 'mindmap' as const, id: m.id, title: m.title, created_at: m.created_at, markdown: m.markdown })),
          ...fcArr.map((f) => ({
            type: 'flashcards' as const,
            id: f.id,
            title: f.title,
            created_at: f.created_at,
            cards: (f.cards as any) as FlashcardType[],
            mindmap_id: f.mindmap_id ?? null,
            markdown: f.markdown ?? null,
            explanations: f.explanations ?? null,
          })),
        ]).slice(0, PAGE_SIZE);
        setCombinedHistory(merged);
      } catch { }
    }
    setHasMoreHistory(historyBufferRef.current.length > 0 || hasMoreMmRef.current || hasMoreFcRef.current);
    setIsHistoryInitialLoading(false);
  };

  const loadMoreHistory = async (userId: string) => {
    if (isHistoryLoadingMore || !hasMoreHistory) return;
    setIsHistoryLoadingMore(true);
    try {
      if (historyBufferRef.current.length < PAGE_SIZE && (hasMoreMmRef.current || hasMoreFcRef.current)) {
        const newItems = await fetchNextIntoBuffer(userId);
        const merged = mergeAndSort([...historyBufferRef.current, ...newItems]);
        historyBufferRef.current = merged;
        setHistoryBuffer(historyBufferRef.current);
      }
      const take = Math.min(PAGE_SIZE, historyBufferRef.current.length);
      const nextChunk = historyBufferRef.current.slice(0, take);
      historyBufferRef.current = historyBufferRef.current.slice(take);
      setHistoryBuffer(historyBufferRef.current);
      setCombinedHistory((prev) => mergeAndSort([...prev, ...nextChunk]));
      setHasMoreHistory(historyBufferRef.current.length > 0 || hasMoreMmRef.current || hasMoreFcRef.current);
    } finally {
      setIsHistoryLoadingMore(false);
    }
  };

  const extractTitle = (md: string): string => {
    const h1 = md.match(/^#\s(.*)/m)?.[1];
    if (h1) return h1.trim();
    const fm = md.match(/title:\s*(.*)/)?.[1];
    if (fm) return fm.trim();
    return 'mindmap';
  };

  const referralLimit = referralStats?.monthlyLimit ?? 3;
  const referralUsed = referralStats?.redemptionsThisMonth ?? 0;
  const referralCapReached = referralStats?.pendingCapReached ?? (referralLimit > 0 ? referralUsed >= referralLimit : false);
  const referralProgress = referralLimit > 0 ? Math.min((referralUsed / referralLimit) * 100, 100) : 0;
  const referralRemaining = referralLimit > 0 ? Math.max(referralLimit - referralUsed, 0) : 0;

  const prefetchSpacedData = async (fcRecords: FlashcardsRecord[]) => {
    if (prefetchingRef.current) return;
    prefetchingRef.current = true;
    try {
      const now = new Date();
      const allSchedules = await loadAllDeckSchedulesAsync();
      const bulkToSave: Array<{ deckId: string; data: StoredDeckSchedule }> = [];
      const dueMap: Record<string, number[]> = {};
      const queue: Array<{ id: string; title: string | null; cards: FlashcardType[]; mindmap_id?: string | null; mindmap_markdown?: string | null; explanations?: FlashcardExplanationMap | null }> = [];
      let totalDue = 0;
      for (const f of fcRecords) {
        const deckId = f.id;
        const cardsArr = (f.cards as any[]) as FlashcardType[];
        const stored = allSchedules[deckId] ?? loadDeckSchedule(deckId);
        const examDate = stored?.examDate;
        const isCancelled = stored?.isCancelled ?? false;
        let schedules = (stored?.schedules || []) as any[];
        if (schedules.length !== cardsArr.length) {
          if (schedules.length > cardsArr.length) {
            schedules = schedules.slice(0, cardsArr.length);
          } else {
            const deficit = cardsArr.length - schedules.length;
            for (let i = 0; i < deficit; i++) schedules.push(createInitialSchedule(now));
          }
          const normalized: StoredDeckSchedule = { examDate, schedules, isCancelled };
          bulkToSave.push({ deckId, data: normalized });
          // update local cache immediately
          saveDeckSchedule(deckId, normalized);
        }
        // Check if exam date has passed - if so, don't include cards in due queue
        let dIdx: number[] = [];
        if (!isCancelled && examDate) {
          let examDateTime: Date;
          if (examDate.includes('T')) {
            // Full datetime string
            examDateTime = new Date(examDate);
          } else {
            // Legacy date-only string, assume end of day
            examDateTime = new Date(examDate + 'T23:59:59');
          }
          const twentyFourHoursAfterExam = new Date(examDateTime.getTime() + 24 * 60 * 60 * 1000);

          if (twentyFourHoursAfterExam >= now) {
            // Exam date is in future, today, or within the last 24 hours - include due cards
            dIdx = schedules
              .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
              .filter((x: any) => x.due <= now)
              .map((x: any) => x.i);
          }
          // If more than 24 hours have passed since the exam, dIdx remains empty
        } else if (!isCancelled) {
          // No exam date set - include due cards normally
          dIdx = schedules
            .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
            .filter((x: any) => x.due <= now)
            .map((x: any) => x.i);
        }
        dueMap[deckId] = dIdx;
        totalDue += dIdx.length;
        if (!isCancelled && dIdx.length > 0) {
          queue.push({
            id: deckId,
            title: f.title,
            cards: cardsArr,
            mindmap_id: f.mindmap_id ?? null,
            mindmap_markdown: f.markdown ?? null,
            explanations: f.explanations ?? null,
          });
        }
      }
      if (bulkToSave.length > 0) {
        try { await upsertDeckSchedulesBulkAsync(bulkToSave); } catch { }
      }
      setDueQueue(queue);
      if (typeof window !== 'undefined') {
        (window as any).__cogniguide_due_map = dueMap;
      }
      setTotalDueCount(totalDue);
      setSpacedPrefetched(true);
    } finally {
      prefetchingRef.current = false;
    }
  };

  const recomputeDueFromCache = (fcRecords: FlashcardsRecord[]) => {
    const now = new Date();
    const dueMap: Record<string, number[]> = {};
    const queue: Array<{ id: string; title: string | null; cards: FlashcardType[]; mindmap_id?: string | null; mindmap_markdown?: string | null; explanations?: FlashcardExplanationMap | null }> = [];
    let totalDue = 0;
    for (const f of fcRecords) {
      const deckId = f.id;
      const cardsArr = (f.cards as any[]) as FlashcardType[];
      const stored = loadDeckSchedule(deckId);
      const isCancelled = stored?.isCancelled ?? false;
      let schedules = (stored?.schedules || []) as any[];
      if (schedules.length !== cardsArr.length) {
        if (schedules.length > cardsArr.length) schedules = schedules.slice(0, cardsArr.length);
        else {
          const deficit = cardsArr.length - schedules.length;
          for (let i = 0; i < deficit; i++) schedules.push(createInitialSchedule(now));
        }
        const normalized: StoredDeckSchedule = { examDate: stored?.examDate, schedules, isCancelled };
        saveDeckSchedule(deckId, normalized);
      }
      // Check if exam date has passed - if so, don't include cards in due queue
      let dIdx: number[] = [];
      const examDate = stored?.examDate;
      if (!isCancelled && examDate) {
        let examDateTime: Date;
        if (examDate.includes('T')) {
          // Full datetime string
          examDateTime = new Date(examDate);
        } else {
          // Legacy date-only string, assume end of day
          examDateTime = new Date(examDate + 'T23:59:59');
        }
        const twentyFourHoursAfterExam = new Date(examDateTime.getTime() + 24 * 60 * 60 * 1000);

        if (twentyFourHoursAfterExam >= now) {
          // Exam date is in future, today, or within the last 24 hours - include due cards
          dIdx = schedules
            .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
            .filter((x: any) => x.due <= now)
            .map((x: any) => x.i);
        }
        // If more than 24 hours have passed since the exam, dIdx remains empty
      } else if (!isCancelled) {
        // No exam date set - include due cards normally
        dIdx = schedules
          .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
          .filter((x: any) => x.due <= now)
          .map((x: any) => x.i);
      }
      dueMap[deckId] = dIdx;
      totalDue += dIdx.length;
      if (!isCancelled && dIdx.length > 0) {
        queue.push({
          id: deckId,
          title: f.title,
          cards: cardsArr,
          mindmap_id: f.mindmap_id ?? null,
          mindmap_markdown: f.markdown ?? null,
          explanations: f.explanations ?? null,
        });
      }
    }
    setDueQueue(queue);
    if (typeof window !== 'undefined') {
      (window as any).__cogniguide_due_map = dueMap;
    }
    setTotalDueCount(totalDue);
  };

  const handleCancelDueDeck = useCallback(
    async (deckId: string) => {
      if (cancellingDeckId) return;
      setSpacedError(null);
      setCancellingDeckId(deckId);

      const dueMapFromWindow =
        (typeof window !== 'undefined' && (window as any).__cogniguide_due_map
          ? ((window as any).__cogniguide_due_map as Record<string, number[]>)
          : {}) ?? {};
      const existingDueCount = Array.isArray(dueMapFromWindow[deckId]) ? dueMapFromWindow[deckId].length : 0;
      const deckIndex = dueQueue.findIndex((deck) => deck.id === deckId);
      const deckEntry = deckIndex >= 0 ? dueQueue[deckIndex] : undefined;

      setDueQueue((prev) => prev.filter((deck) => deck.id !== deckId));
      if (typeof window !== 'undefined') {
        const updatedMap = { ...dueMapFromWindow, [deckId]: [] };
        (window as any).__cogniguide_due_map = updatedMap;
      }
      setTotalDueCount((prev) => Math.max(0, prev - existingDueCount));

      try {
        let stored = loadDeckSchedule(deckId);
        if (!stored) {
          stored = await loadDeckScheduleAsync(deckId);
        }
        const now = new Date();
        const desiredLength = deckEntry?.cards.length ?? stored?.schedules?.length ?? 0;
        const schedules = Array.isArray(stored?.schedules) ? [...(stored?.schedules ?? [])] : [];
        if (desiredLength > 0) {
          if (schedules.length > desiredLength) {
            schedules.length = desiredLength;
          } else if (schedules.length < desiredLength) {
            const deficit = desiredLength - schedules.length;
            for (let i = 0; i < deficit; i++) {
              schedules.push(createInitialSchedule(now));
            }
          }
        }
        const updated: StoredDeckSchedule = {
          examDate: stored?.examDate,
          schedules,
          isCancelled: true,
        };
        await saveDeckScheduleAsync(deckId, updated);
        posthog.capture('spaced_repetition_deck_cancelled', {
          deck_id: deckId,
          due_card_count: existingDueCount,
        });
      } catch (error) {
        console.error(`Failed to cancel spaced repetition deck ${deckId}:`, error);
        setSpacedError('Failed to cancel deck. Please try again.');
        setDueQueue((prev) => {
          if (!deckEntry) return prev;
          const next = [...prev];
          const insertAt = deckIndex >= 0 && deckIndex <= next.length ? deckIndex : next.length;
          next.splice(insertAt, 0, deckEntry);
          return next;
        });
        if (typeof window !== 'undefined') {
          const currentMap = ((window as any).__cogniguide_due_map as Record<string, number[]>) || {};
          const revertedMap = { ...currentMap };
          if (Array.isArray(dueMapFromWindow[deckId])) {
            revertedMap[deckId] = dueMapFromWindow[deckId];
          } else {
            delete revertedMap[deckId];
          }
          (window as any).__cogniguide_due_map = revertedMap;
        }
        setTotalDueCount((prev) => prev + existingDueCount);
      } finally {
        setCancellingDeckId(null);
      }
    },
    [cancellingDeckId, dueQueue],
  );

  const handleDeleteItem = async (itemType: 'mindmap' | 'flashcards', itemId: string) => {
    if (!user) return;
    posthog.capture('history_item_deleted', { type: itemType, item_id: itemId });
    const confirmation = window.confirm('Are you sure you want to delete this item? This action cannot be undone.');
    if (confirmation) {
      const tableName = itemType === 'mindmap' ? 'mindmaps' : 'flashcards';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemId);

      if (error) {
        alert('Failed to delete item. Please try again.');
        console.error('Deletion error:', error);
      } else {
        setCombinedHistory((prev) => prev.filter((item) => item.id !== itemId));
        if (itemType === 'flashcards') {
          setFlashcardsHistory((prev) => {
            const newHistory = prev.filter((f) => f.id !== itemId);
            recomputeDueFromCache(newHistory);
            return newHistory;
          });
        }
      }
    }
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleRenameItem = async (itemId: string, itemType: 'mindmap' | 'flashcards', newTitle: string) => {
    if (!user) return;

    posthog.capture('history_item_renamed', { type: itemType, item_id: itemId });

    const tableName = itemType === 'mindmap' ? 'mindmaps' : 'flashcards';
    const { data, error } = await supabase
      .from(tableName)
      .update({ title: newTitle })
      .eq('id', itemId)
      .select();

    if (error || !data) {
      alert('Failed to rename item. Please try again.');
      console.error('Rename error:', error);
    } else {
      setCombinedHistory((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, title: newTitle } : item))
      );
      if (itemType === 'mindmap' && itemId === activeMindMapId) {
        setActiveMindMapTitle(newTitle);
      }
      if (itemType === 'flashcards') {
        setFlashcardsHistory((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, title: newTitle } : item))
        );
        if (itemId === activeDeckId) {
          setFlashcardsTitle(newTitle);
        }
      }
    }
    setRenamingItem(null);
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  useEffect(() => {
    try {
      const dueMap = (typeof window !== 'undefined' && (window as any).__cogniguide_due_map) || {};
      const total = Object.values(dueMap).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      setTotalDueCount(total);
    } catch { }
  }, [spacedPrefetched, flashcardsHistory]);

  const handleSignOut = async () => {
    posthog.capture('user_signed_out');
    await supabase.auth.signOut();

    // Clear the auth cookie to prevent middleware from redirecting back to dashboard
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
      }
    } catch { }

    router.replace('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r bg-background pl-2 pt-2 pb-2 pr-0 flex flex-col h-screen min-h-0 transform transition-transform duration-300 md:relative md:translate-x-0 md:flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          <div className="flex items-center justify-between gap-2 mb-4 pl-0 pr-2">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-muted/50 transition-colors"
              title="Refresh page"
            >
              <Image src={CogniGuideLogo} alt="CogniGuide" width={24} height={24} className="h-6 w-6" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-full hover:bg-muted md:hidden"
              title="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-4 pl-0 pr-2">
            <button
              title="Review due decks"
              onClick={async () => {
                setSpacedOpen(true);
                setSpacedError(null);
                if (!spacedPrefetched) {
                  setSpacedLoading(true);
                  try { await prefetchSpacedData(flashcardsHistory); } catch (err: any) { setSpacedError(err?.message || 'Failed to load due decks'); } finally { setSpacedLoading(false); }
                }
                // Ensure UI reflects latest due based on cached schedules even if no network
                recomputeDueFromCache(flashcardsHistory);
              }}
              className="w-full text-left pl-2 pr-2 py-3 rounded-xl hover:bg-muted/50 flex items-center gap-3 transition-colors"
            >
              <CalendarClock className="h-5 w-5 text-primary" />
              <span className="font-medium">Spaced repetition</span>
              {totalDueCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold min-w-[20px] h-5 px-1 spaced-due-badge">
                  {totalDueCount > 9999 ? '9999+' : totalDueCount}
                </span>
              )}
            </button>
          </div>
          <div className="mb-4 pl-2 pr-2">
            <span className="text-muted-foreground text-sm">Your History</span>
          </div>
          <div className="space-y-2 pl-0 pr-2">
            {isHistoryInitialLoading && (
              <div className="space-y-2 pl-0 pr-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="pl-2 pr-2 py-3 rounded-xl border bg-muted/20 animate-pulse">
                    <div className="h-4 w-24 bg-muted rounded mb-2" />
                    <div className="h-3 w-40 bg-muted rounded" />
                  </div>
                ))}
              </div>
            )}
            {!isHistoryInitialLoading && combinedHistory.length === 0 && (
              <div className="text-sm text-muted-foreground pl-0 pr-0">No history yet.</div>
            )}
            {combinedHistory.map((item) => {
              const itemKey = `${item.type}:${item.id}`;
              const isRenaming = renamingItem?.id === item.id;
              return (
                <div key={itemKey} className="relative group">
                  <button
                    title={(function () {
                      const cleaned = removeFirstEmoji(item.title);
                      return cleaned && cleaned.length > 0
                        ? cleaned
                        : (item.type === 'mindmap' ? 'mindmap' : 'flashcards');
                    })()}
                    onClick={() => {
                      if (openMenuId === itemKey || isRenaming) return;
                      posthog.capture('history_item_opened', {
                        type: item.type,
                        item_id: item.id,
                      });
                      if (item.type === 'mindmap') {
                        setActiveMindMapId(item.id);
                        setActiveMindMapTitle(item.title ?? null);
                        setMarkdown(item.markdown);
                      } else {
                        setFlashcardsTitle(item.title || 'flashcards');
                        // Attach a temporary symbol on cards array to carry deck id into modal
                        const arr = (item.cards as FlashcardType[]) as any;
                        (arr as any).__deckId = item.id;
                        setActiveDeckMindMapId(item.mindmap_id ?? null);
                        setActiveDeckMindMapMarkdown(item.markdown ?? null);
                        setActiveDeckId(item.id);
                        setFlashcardsCards(arr as FlashcardType[]);
                        setFlashcardsExplanations(item.explanations ?? null);
                        setFlashcardsError(null);
                        setFlashcardsOpen(true);
                      }
                    }}
                    className={`w-full text-left pl-2 py-2 rounded-xl flex items-start gap-2 transition-all ${openMenuId === itemKey
                      ? 'pr-8 bg-muted/50'
                      : 'pr-2 group-hover:pr-8 hover:bg-muted/50'
                      }`}
                  >
                    <div className="mt-0.5 text-gray-600">
                      {(() => {
                        const e = extractFirstEmoji(item.title);
                        if (e) {
                          return (
                            <span className="inline-flex h-5 w-5 items-center justify-center text-[18px] leading-none">
                              {e}
                            </span>
                          );
                        }
                        return item.type === 'mindmap' ? (
                          <MapIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <FlashcardIcon className="h-5 w-5 text-primary" />
                        );
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          defaultValue={renamingItem.title}
                          autoFocus
                          onBlur={(e) => handleRenameItem(item.id, item.type, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameItem(item.id, item.type, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                              setRenamingItem(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm font-medium bg-transparent border border-primary rounded-md px-1 py-0.5 -ml-1"
                        />
                      ) : (
                        <div className="font-medium line-clamp-1">
                          {(() => {
                            const cleaned = removeFirstEmoji(item.title);
                            return cleaned && cleaned.length > 0
                              ? cleaned
                              : (item.type === 'mindmap' ? 'mindmap' : 'flashcards');
                          })()}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{formatDate(new Date(item.created_at))} {formatTime(new Date(item.created_at), { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </button>
                  <div className={`absolute top-1/2 -translate-y-1/2 right-2 ${openMenuId === itemKey ? 'visible' : 'invisible group-hover:visible'}`} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (openMenuId === itemKey) {
                          setOpenMenuId(null);
                          setMenuPosition(null);
                        } else {
                          setOpenMenuId(itemKey);
                          setMenuPosition({ x: rect.left, y: rect.bottom });
                        }
                      }}
                      className="p-1 rounded-full text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {isHistoryLoadingMore && (
              <div className="flex items-center justify-center py-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading more…
              </div>
            )}
            {hasMoreHistory && !isHistoryInitialLoading && (
              <div ref={loadMoreRef} className="h-4" />
            )}
          </div>
        </div>
        <div className="border-t pt-2 space-y-2 pl-0 pr-2">
          <button
            title="Settings"
            onClick={() => setIsSettingsOpen(true)}
            className="w-full text-left pl-2 pr-2 py-2 rounded-xl hover:bg-muted/50 flex items-center gap-3 transition-colors"
          >
            <div className="relative">
              <div className={cn(
                "relative h-7 w-7 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-medium text-foreground/80",
                isPaidUser && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}>
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${displayName} avatar`}
                    fill
                    sizes="28px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span>{displayInitials}</span>
                )}
              </div>
              {isPaidUser && (
                <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-[2px] shadow-sm border border-background z-10">
                  <Crown className="h-2.5 w-2.5 fill-current" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium line-clamp-1">{displayName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>{balanceDisplay} {balanceLabel}</span>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* History item dropdown menu - positioned outside scrollable sidebar */}
      {openMenuId && menuPosition && (
        <div className="fixed inset-0 z-50" onClick={() => { setOpenMenuId(null); setMenuPosition(null); }}>
          <div
            className="fixed w-32 bg-background border rounded-lg shadow-lg p-1 z-50"
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
            }}
          >
            <button
              title="Share link with friends"
              onClick={() => {
                const [type, id] = openMenuId.split(':');
                const currentItem = combinedHistory.find(item => item.id === id && item.type === type);
                setShareItem({ id, type: type as 'mindmap' | 'flashcards', title: currentItem?.title ?? null });
                setOpenMenuId(null);
                setMenuPosition(null);
              }}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              title="Rename item"
              onClick={() => {
                const [type, id] = openMenuId.split(':');
                // Find the current title from the combinedHistory
                const currentItem = combinedHistory.find(item => item.id === id);
                const currentTitle = currentItem?.title || '';
                setRenamingItem({ id, type: type as 'mindmap' | 'flashcards', title: currentTitle });
                setOpenMenuId(null);
                setMenuPosition(null);
              }}
              className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-muted flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Rename
            </button>
            <button
              title="Delete item"
              onClick={() => {
                const [type, id] = openMenuId.split(':');
                setOpenMenuId(null);
                setMenuPosition(null);
                handleDeleteItem(type as 'mindmap' | 'flashcards', id);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-h-0 relative">
        {/* Models selector positioned at top left edge with sidebar */}
        <div className="absolute top-20 left-2 z-20 md:left-4 md:top-4">
          <Popover open={isModeMenuOpen} onOpenChange={setIsModeMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted/70"
                aria-haspopup="listbox"
                aria-expanded={isModeMenuOpen}
                aria-label="Change AI model"
                data-tooltip={modelTriggerTooltip}
              >
                <div className="flex items-center gap-1">
                  <span className="text-lg font-semibold">{modelDetails[selectedModel].label}</span>
                  <span className="text-sm text-muted-foreground">Mode</span>
                </div>
                {!tierLoading && !isPaidUser && selectedModel === 'smart' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <Lock className="h-3 w-3" /> Pro
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition group-hover:translate-y-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[260px] border-none bg-muted/50 p-2 shadow-xl backdrop-blur rounded-2xl"
            >
              <div className="flex flex-col gap-1" role="listbox" aria-label="Generation modes">
                {(['fast', 'smart'] as ModelChoice[]).map((choice) => {
                  const isActive = selectedModel === choice;
                  const locked = choice === 'smart' && !isPaidUser;
                  const optionLabel = locked ? 'Smart' : modelDetails[choice].label;
                  const shortDescription = choice === 'fast' ? 'Quick generation' : 'Detailed outputs';
                  const tooltipText =
                    choice === 'smart'
                      ? 'Produces richer, more structured outputs. Consumes more credits.'
                      : 'Baseline model responds quickly and uses the fewest credits.';
                  return (
                    <button
                      title={tooltipText}
                      key={choice}
                      type="button"
                      onClick={() => handleSelectModel(choice)}
                      onMouseEnter={() => setHoveredModel(choice)}
                      onFocus={() => setHoveredModel(choice)}
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        'group flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition',
                        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/70'
                      )}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold leading-none">{optionLabel}</span>
                            {!tierLoading && locked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                <Lock className="h-3 w-3" /> Subscriber Access
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5">{shortDescription}</span>
                        </div>
                        {isActive && <Check className="ml-auto h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <header className="md:hidden flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-sm px-6 py-3 border-b z-10">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2"
            title="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Image src={CogniGuideLogo} alt="CogniGuide" width={24} height={24} className="h-6 w-6" />
            <span className="font-bold">CogniGuide</span>
          </div>
          <div className="w-6" /> {/* Spacer */}
        </header>
        <div className="container mx-auto px-6 pb-6 mt-16 md:mt-10">
          <div className="max-w-3xl mx-auto" id="generator-panel">
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center mb-8 min-h-[3rem]">
              {(() => {
                const isTrialEndingSoon = (() => {
                  if (tierLoading || userTier !== 'trial' || !trialEndsAt) return false;
                  const end = new Date(trialEndsAt);
                  const now = new Date();
                  const diffTime = end.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays <= 5 && diffDays >= 0;
                })();

                const shouldShowButton = !tierLoading && userTier !== 'paid' && !isTrialEndingSoon;

                let trialWarning = null;
                if (isTrialEndingSoon && trialEndsAt) {
                  const end = new Date(trialEndsAt);
                  const now = new Date();
                  const diffTime = end.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  trialWarning = (
                    <div className="flex justify-center w-full">
                      <button
                        type="button"
                        onClick={() => openPricingModal({ name: 'trial_expiring_pill' })}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold cursor-pointer transition-colors hover:bg-amber-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/30"
                        title="You are currently exceeding the Free plan limits. Upgrade to keep these credits valid."
                        aria-label="Open pricing to keep your trial benefits"
                      >
                        <CalendarClock className="h-4 w-4" />
                        <span>Trial ends in {diffDays} {diffDays === 1 ? 'day' : 'days'}</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {shouldShowButton ? (
                      <div className="flex justify-center w-full">
                        <button
                          title="View pricing plans"
                          onClick={() => openPricingModal({ name: 'dashboard_upgrade_cta' })}
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border pill-soft-sky text-sm font-semibold cursor-pointer transition-colors shadow-sm mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Upgrade your Plan</span>
                        </button>
                      </div>
                    ) : null}
                    {trialWarning}
                  </>
                );
              })()}
            </div>
            <Generator
              showTitle={false}
              modelChoice={selectedModel}
              isPaidSubscriber={isPaidUser}
              onRequireUpgrade={(reason) =>
                openPricingModal({
                  name: 'generator_require_upgrade',
                  props: reason ? { reason } : undefined,
                })
              }
              freeGenerationsRemaining={!isPaidUser ? credits : undefined}
            />
          </div>
        </div>
      </main >

      <MindMapModal
        markdown={markdown}
        onClose={() => {
          setMarkdown(null);
          setActiveMindMapId(null);
          setActiveMindMapTitle(null);
        }}
        onShareMindMap={activeMindMapId ? () => setShareItem({ id: activeMindMapId, type: 'mindmap', title: activeMindMapTitle ?? null }) : undefined}
        isPaidUser={isPaidUser}
        onRequireUpgrade={(reason) =>
          openPricingModal({
            name: 'mindmap_modal',
            props: reason ? { reason } : undefined,
          })
        }
      />
      <FlashcardsModal
        open={flashcardsOpen}
        title={flashcardsTitle}
        cards={flashcardsCards}
        explanations={flashcardsExplanations ?? null}
        isGenerating={false}
        error={flashcardsError}
        onClose={() => {
          setFlashcardsOpen(false);
          setFlashcardsCards(null);
          setFlashcardsExplanations(null);
          setFlashcardsError(null);
          setStudyDueOnly(false);
          setStudyInterleaved(false);
          setDueIndices(undefined);
          setInitialDueIndex(undefined);
          setActiveDeckId(undefined);
          setActiveDeckMindMapId(null);
          setActiveDeckMindMapMarkdown(null);
        }}
        onReviewDueCards={(indices) => {
          if (!indices || indices.length === 0) {
            return;
          }
          setStudyDueOnly(true);
          setStudyInterleaved(false);
          setDueIndices(indices);
          setInitialDueIndex(indices[0]);
        }}
        deckId={activeDeckId || (flashcardsCards as any)?.__deckId}
        studyDueOnly={studyDueOnly}
        studyInterleaved={studyInterleaved}
        interleavedDecks={studyInterleaved ? dueQueue : undefined}
        dueIndices={dueIndices}
        initialIndex={initialDueIndex}
        onShare={activeDeckId && activeDeckId !== 'interleaved-session' ? () => setShareItem({ id: activeDeckId, type: 'flashcards', title: flashcardsTitle ?? null }) : undefined}
        isPaidUser={isPaidUser}
        isTrialUser={isTrialUser}
        onRequireUpgrade={(reason) =>
          openPricingModal({
            name: 'flashcards_modal',
            props: reason ? { reason } : undefined,
          })
        }
        mindMapModelChoice={selectedModel}
        linkedMindMapId={activeDeckMindMapId}
        linkedMindMapMarkdown={activeDeckMindMapMarkdown}
        onMindMapLinked={handleMindMapLinked}
      />
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={handleClosePricingModal}
        onPurchaseComplete={() => {
          if (user) {
            loadUserCredits(user.id);
            void refreshUserTier(user.id);
          }
        }}
      />

      {
        spacedOpen && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center" onClick={() => setSpacedOpen(false)}>
            <div className="bg-background rounded-[2rem] p-6 w-full max-w-2xl border" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Spaced repetition</h2>
                <button
                  onClick={() => setSpacedOpen(false)}
                  className="px-3 py-1.5 rounded-full border hover:bg-muted/50 transition-colors"
                >
                  Close
                </button>
              </div>
              {spacedError && (
                <div className="mb-3 text-sm text-red-600">{spacedError}</div>
              )}
              {!spacedError && (
                <div className="text-sm text-muted-foreground">
                  Select a deck with cards due now, or study all due cards interleaved for best results.
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
                {spacedLoading && (
                  <div className="text-sm text-muted-foreground">Loading due decks…</div>
                )}
                {!spacedLoading && dueQueue.length > 0 && (
                  <div className="p-2 rounded-xl border flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium line-clamp-1 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Interleaving Mode
                      </div>
                      <div className="text-xs text-muted-foreground">Shuffle cards from multiple decks for better retention and learning efficiency</div>
                    </div>
                    <button
                      title="Start interleaved study session"
                      className="px-3 py-1.5 text-xs rounded-full border bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        const dueMap = (typeof window !== 'undefined' && (window as any).__cogniguide_due_map) || {};
                        const allDueCards = dueQueue.flatMap(deck => {
                          const dueIndexes = (dueMap[deck.id] as number[]) || [];
                          return dueIndexes.map(cardIndex => ({
                            ...deck.cards[cardIndex],
                            deckId: deck.id,
                            cardIndex: cardIndex,
                            deckTitle: deck.title || 'flashcards'
                          }));
                        });

                        // Intelligent interleaving to avoid consecutive cards from the same deck
                        const interleavedCards = [];
                        if (allDueCards.length > 0) {
                          const cardsByDeck = new Map<string, any[]>();
                          for (const card of allDueCards) {
                            if (!cardsByDeck.has(card.deckId)) {
                              cardsByDeck.set(card.deckId, []);
                            }
                            cardsByDeck.get(card.deckId)!.push(card);
                          }

                          let lastDeckId: string | null = null;
                          const totalCards = allDueCards.length;
                          while (interleavedCards.length < totalCards) {
                            let availableDeckIds = Array.from(cardsByDeck.keys()).filter(id => cardsByDeck.get(id)!.length > 0);
                            let candidateDeckIds = availableDeckIds.filter(id => id !== lastDeckId);

                            if (candidateDeckIds.length === 0) {
                              candidateDeckIds = availableDeckIds;
                            }

                            if (candidateDeckIds.length === 0) {
                              break;
                            }

                            const nextDeckId = candidateDeckIds[Math.floor(Math.random() * candidateDeckIds.length)];
                            const deckCards = cardsByDeck.get(nextDeckId)!;
                            const nextCard = deckCards.shift()!;

                            interleavedCards.push(nextCard);
                            lastDeckId = nextDeckId;
                          }
                        }

                        // Create a composite deck for the modal
                        const interleavedDeck = {
                          id: 'interleaved-session',
                          title: 'Interleaved Study',
                          cards: interleavedCards
                        };

                        const interleavedIndices = interleavedCards.map((_: any, i: number) => i);

                        posthog.capture('spaced_repetition_interleaved_started', {
                          deck_count: dueQueue.length,
                          total_due_card_count: interleavedCards.length,
                        });

                        setFlashcardsTitle(interleavedDeck.title);
                        setFlashcardsCards(interleavedDeck.cards as any); // cast needed due to deckId
                        setFlashcardsExplanations(null);
                        setActiveDeckMindMapId(null);
                        setActiveDeckMindMapMarkdown(null);
                        setActiveDeckId(interleavedDeck.id);
                        setStudyDueOnly(true); // to enable SR logic
                        setStudyInterleaved(true);
                        setDueIndices(interleavedIndices);
                        setInitialDueIndex(0);
                        setSpacedOpen(false);
                        setFlashcardsOpen(true);
                      }}
                    >
                      Study
                    </button>
                  </div>
                )}
                {!spacedLoading && dueQueue.map((f) => {
                  const dueMap = (typeof window !== 'undefined' && (window as any).__cogniguide_due_map) || {};
                  const count = Array.isArray(dueMap[f.id]) ? (dueMap[f.id] as number[]).length : 0;
                  const isCancelling = cancellingDeckId === f.id;
                  return (
                    <div key={f.id} className="p-2 rounded-xl border flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-1">{f.title || 'flashcards'}</div>
                        <div className="text-xs text-muted-foreground">{count} due now</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          title="Remove deck from due list"
                          className={cn(
                            'px-3 py-1.5 text-xs rounded-full border hover:bg-muted/50 transition-colors',
                            isCancelling ? 'opacity-60 cursor-not-allowed' : '',
                          )}
                          onClick={() => handleCancelDueDeck(f.id)}
                          disabled={isCancelling}
                        >
                          Cancel
                        </button>
                        <button
                          className={cn(
                            'px-3 py-1.5 text-xs rounded-full border bg-primary text-primary-foreground hover:bg-primary/90',
                            isCancelling ? 'opacity-60 cursor-not-allowed' : '',
                          )}
                          onClick={() => {
                            const list = (dueMap[f.id] as number[]) || [];
                            posthog.capture('spaced_repetition_deck_studied', {
                              deck_id: f.id,
                              due_card_count: list.length,
                            });
                            const arr = f.cards as any;
                            (arr as any).__deckId = f.id;
                            setActiveDeckMindMapId(f.mindmap_id ?? null);
                            setActiveDeckMindMapMarkdown(f.mindmap_markdown ?? null);
                            setActiveDeckId(f.id);
                            setStudyDueOnly(true);
                            setDueIndices(list);
                            setInitialDueIndex(list[0] ?? 0);
                            setSpacedOpen(false);
                            setFlashcardsTitle(f.title || 'flashcards');
                            setFlashcardsCards(arr);
                            setFlashcardsExplanations(f.explanations ?? null);
                            setFlashcardsError(null);
                            setFlashcardsOpen(true);
                          }}
                          disabled={isCancelling}
                        >
                          Study
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!spacedLoading && dueQueue.length === 0 && (
                  <div className="text-sm text-muted-foreground">No saved flashcards yet.</div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {
        isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300" onClick={() => setIsSettingsOpen(false)}>
            <div
              className="bg-background/95 backdrop-blur-xl rounded-2xl p-4 pb-2 w-full max-w-sm border border-border/50 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Settings</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto -mx-2 px-2 py-1 min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {/* Credits Card */}
                <div className="relative overflow-hidden px-4 py-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent mb-3 group flex-shrink-0">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors duration-500"></div>
                  <div className="relative z-10">
                    <div className="text-xs font-medium text-muted-foreground mb-0.5">Available Credits</div>
                    <div className="text-2xl font-bold flex items-center gap-2 text-foreground">
                      <Coins className="h-6 w-6 text-primary animate-pulse" />
                      <span>{(Math.floor(credits * 10) / 10).toFixed(1)}</span>
                    </div>
                    {/*
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      openPricingModal({ name: 'settings_credits_card' });
                    }}
                    className="mt-1 flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline decoration-primary/50 underline-offset-2"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Get more credits
                  </button>
                  */}
                  </div>
                </div>

                {/* Theme Toggle Wrapper */}
                <div className="mb-3 px-1 flex-shrink-0">
                  <ThemeToggle />
                </div>

                {/* Menu */}
                <nav className="space-y-1">
                  <button
                    title="Open referral rewards"
                    type="button"
                    onClick={() => {
                      setLegalOpen(false);
                      setIsSettingsOpen(false);
                      setIsReferralOpen(true);
                    }}
                    className="w-full text-left p-2 rounded-[1.25rem] hover:bg-muted/60 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="p-1.5 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-200">
                      <Gift className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground/80 group-hover:text-foreground text-sm">Refer friends</span>
                  </button>

                  <button
                    title="Open upgrade options"
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      openPricingModal({ name: 'settings_upgrade_link' });
                    }}
                    className="w-full text-left p-2 rounded-[1.25rem] hover:bg-muted/60 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground/80 group-hover:text-foreground text-sm">Upgrade Plan</span>
                  </button>

                  <Link
                    href="/contact"
                    className="w-full text-left p-2 rounded-[1.25rem] hover:bg-muted/60 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group"
                  >
                    <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground/80 group-hover:text-foreground text-sm">Contact Support</span>
                  </Link>

                  <div className="relative">
                    <button
                      title="Show legal links"
                      onClick={() => setLegalOpen(!legalOpen)}
                      className="w-full text-left p-2 rounded-[1.25rem] hover:bg-muted/60 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group"
                    >
                      <div className="p-1.5 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 group-hover:scale-110 transition-transform duration-200">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-foreground/80 group-hover:text-foreground text-sm">Legal</span>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-300 ${legalOpen ? 'rotate-90' : ''}`} />
                    </button>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${legalOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="pl-[3rem] pr-2 py-1 space-y-1">
                        <Link href="/legal/refund-policy" className="block w-full p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors">Refund Policy</Link>
                        <Link href="/legal/cancellation-policy" className="block w-full p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors">Cancellation Policy</Link>
                        <Link href="/legal/terms" className="block w-full p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors">Terms of Service</Link>
                        <Link href="/legal/privacy-policy" className="block w-full p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors">Privacy Policy</Link>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left p-2 rounded-[1.25rem] hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-[0.98] transition-all duration-200 flex items-center gap-3 group"
                    title="Sign out of CogniGuide"
                  >
                    <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-200">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 text-sm">Sign out</span>
                  </button>
                </nav>
              </div>
              <div className="text-xs text-muted-foreground/60 text-center py-1.5 mt-1 font-medium flex-shrink-0">
                © {new Date().getFullYear()} CogniGuide
              </div>
            </div>
          </div>
        )
      }

      {
        isReferralOpen && (
          <div
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setIsReferralOpen(false)}
          >
            <div
              className="relative bg-background rounded-[1.5rem] p-6 w-full max-w-lg border"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsReferralOpen(false)}
                className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted/60"
                title="Close referral modal"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Refer friends & earn credits</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Share your link so you and your friend each earn <span className="font-semibold text-foreground">30 credits</span> when they sign in using it
                (up to {referralLimit} rewards per calendar month for you).
              </p>
              {referralError && (
                <div className="mb-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                  {referralError}
                </div>
              )}
              {referralLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex rounded-full border border-border/40 bg-background shadow-inner focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40">
                    <input
                      value={referralLink ?? ''}
                      readOnly
                      placeholder="https://cogniguide.app/?ref=yourcode"
                      className="flex-1 bg-transparent px-4 py-3 text-sm font-medium text-foreground border-none outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={handleCopyReferralLink}
                      disabled={referralLoading || !referralLink}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 mr-1 my-1"
                      title="Copy referral link"
                    >
                      {referralLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : referralLink ? (
                        referralCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>
                        {referralCopied ? 'Copied!' : referralLoading ? 'Loading…' : 'Copy link'}
                      </span>
                    </button>
                  </div>
                  <div className="rounded-[1.25rem] border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly rewards</span>
                      <span className="font-semibold">{referralUsed} / {referralLimit}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${referralProgress}%` }}
                      />
                    </div>
                    {referralCapReached ? (
                      <p className="text-xs text-muted-foreground">
                        You&apos;ve reached this month&apos;s cap. Invite more friends next month for additional credits.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Invite {referralRemaining} more friend{referralRemaining === 1 ? '' : 's'} to maximize this month&apos;s rewards.
                      </p>
                    )}
                    {referralCode && (
                      <p className="text-xs text-muted-foreground">
                        Referral code: <span className="font-mono font-medium text-foreground">{referralCode}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        referralRewardNotice && (
          <div className="fixed bottom-6 right-6 z-[60]">
            <div className="pointer-events-auto flex w-80 items-start gap-3 rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Gift className="h-5 w-5" />
              </div>
              <div className="flex-1 text-sm text-foreground">
                <p className="text-base font-semibold">Referral bonus applied</p>
                <p className="mt-1 text-sm text-muted-foreground">You and your friend each earned {referralRewardNotice.amount} bonus credits. Enjoy exploring CogniGuide!</p>
              </div>
              <button
                type="button"
                onClick={dismissReferralRewardNotice}
                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                aria-label="Dismiss referral bonus notice"
                title="Dismiss notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      }

      <ShareLinkDialog
        open={Boolean(shareItem?.id)}
        onClose={() => setShareItem(null)}
        resourceId={shareItem?.id ?? null}
        resourceType={shareItem?.type ?? 'mindmap'}
        resourceTitle={shareItem?.title ?? null}
      />
      <ReverseTrialModal
        open={isTrialModalOpen && Boolean(user && trialEndsAt)}
        onClose={handleDismissTrialModal}
        trialEndsAt={trialEndsAt}
      />
      <OnboardingWizardModal
        open={onboardingModalOpen}
        stage={onboardingStage === 'progress' ? 'input' : onboardingStage}
        selectedMode={onboardingMode}
        inputChoice={onboardingInputChoice}
        customPrompt={onboardingPrompt}
        suggestedTopics={suggestedTopics}
        onBackToMode={handleBackToModeStage}
        onModeSelect={handleOnboardingModeSelect}
        onUploadChosen={handleUploadChosen}
        onPromptPrefill={handlePromptPrefill}
        onCustomPromptChange={handleOnboardingPromptChange}
        onSkip={markOnboardingSeen}
        onClose={handleCloseOnboardingModal}
      />
      <ReverseTrialEndModal
        open={isReverseTrialEndModalOpen && Boolean(user && trialEndsAt)}
        onClose={handleDismissReverseTrialEndModal}
        onUpgrade={handleUpgradeFromEndModal}
        stats={trialEndStats}
      />
    </div >
  );
}
