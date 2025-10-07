'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, MindmapRecord, FlashcardsRecord } from '@/lib/supabaseClient';
import Generator from '@/components/Generator';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import { BrainCircuit, LogOut, Loader2, Map as MapIcon, Coins, Zap, Sparkles, CalendarClock, Menu, X, ChevronRight, MoreHorizontal, Edit, Trash2, Share2, Link2, Copy, Check, Gift, TrendingUp, Mail, FileText, Lock, ChevronDown } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync, loadAllDeckSchedulesAsync, upsertDeckSchedulesBulkAsync, type StoredDeckSchedule } from '@/lib/sr-store';
import { createInitialSchedule } from '@/lib/spaced-repetition';
import PricingModal from '@/components/PricingModal';
import { type ModelChoice } from '@/lib/plans';
import CogniGuideLogo from '../../CogniGuide_logo.png';
import Image from 'next/image';
import posthog from 'posthog-js';
import ThemeToggle from '@/components/ThemeToggle';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

type SessionUser = {
  id: string;
  email?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  referralLastSeenId?: string | null;
};

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
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[] }
  >>([]);
  // Pagination state
  const PAGE_SIZE = 10;
  const [mmOffset, setMmOffset] = useState(0);
  const [fcOffset, setFcOffset] = useState(0);
  const [hasMoreMm, setHasMoreMm] = useState(true);
  const [hasMoreFc, setHasMoreFc] = useState(true);
  const [historyBuffer, setHistoryBuffer] = useState<Array<
    | { type: 'mindmap'; id: string; title: string | null; created_at: string; markdown: string }
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[] }
  >>([]);
  const [isHistoryInitialLoading, setIsHistoryInitialLoading] = useState(true);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>('fast');
  const [userTier, setUserTier] = useState<'free' | 'paid'>('free');
  const [tierLoading, setTierLoading] = useState<boolean>(true);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<ModelChoice | null>(null);
  const isPaidUser = userTier === 'paid';
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

  useEffect(() => {
    if (isModeMenuOpen) {
      setHoveredModel(selectedModel);
    } else {
      setHoveredModel(null);
    }
  }, [isModeMenuOpen, selectedModel]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [spacedOpen, setSpacedOpen] = useState(false);
  const [dueQueue, setDueQueue] = useState<Array<{ id: string; title: string | null; cards: FlashcardType[] }>>([]);
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ id: string; type: 'mindmap' | 'flashcards'; title: string } | null>(null);
  const [shareItem, setShareItem] = useState<{ id: string; type: 'mindmap' | 'flashcards'; title: string | null } | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharePortalReady, setIsSharePortalReady] = useState(false);
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
  const shareLinkInputRef = useRef<HTMLInputElement | null>(null);
  const shareCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referralCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referralRewardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareLinksCacheRef = useRef<Map<string, string>>(new Map());
  const lastUpgradeTriggerRef = useRef<string | null>(null);

  useEffect(() => {
    setIsSharePortalReady(true);
  }, []);

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
  useEffect(() => {
    if (shareItem) {
      const key = `${shareItem.type}:${shareItem.id}`;
      const cached = shareLinksCacheRef.current.get(key) || null;
      setShareLink(cached);
      setShareError(null);
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
        shareCopiedTimeoutRef.current = null;
      }
      setShareCopied(false);
    } else {
      setShareLink(null);
      setShareError(null);
      setShareLoading(false);
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
        shareCopiedTimeoutRef.current = null;
      }
      setShareCopied(false);
    }
  }, [shareItem]);

  useEffect(() => {
    return () => {
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
      }
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
      } catch {}
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch referral link.';
      setReferralLink(null);
      setReferralCode(null);
      setReferralStats(null);
      setReferralError(message);
      try {
        posthog.capture('referral_link_loaded', { status: 'error', message });
      } catch {}
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
    } catch {}
    void fetchReferralDetails();
  }, [isReferralOpen, fetchReferralDetails]);

  const copyTextToClipboard = async (value: string): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      if (typeof document === 'undefined') return false;
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    } catch {
      return false;
    }
  };

  const copyShareLink = async (link: string) => {
    const success = await copyTextToClipboard(link);

    if (success) {
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
      }
      setShareCopied(true);
      shareCopiedTimeoutRef.current = setTimeout(() => {
        setShareCopied(false);
        shareCopiedTimeoutRef.current = null;
      }, 2000);
    } else {
      if (shareCopiedTimeoutRef.current) {
        clearTimeout(shareCopiedTimeoutRef.current);
        shareCopiedTimeoutRef.current = null;
      }
      setShareCopied(false);
    }
  };

  const refreshUserTier = useCallback(
    async (userIdOverride?: string, options?: { skipLoadingState?: boolean }) => {
      const targetUserId = userIdOverride ?? userIdRef.current;
      if (!targetUserId) {
        setUserTier('free');
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
        const paidStatuses = new Set(['active', 'trialing', 'past_due']);
        const nextTier: 'free' | 'paid' = status && paidStatuses.has(status) ? 'paid' : 'free';
        setUserTier(nextTier);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(`cogniguide_user_tier_${targetUserId}`, nextTier);
          }
        } catch {}
      } catch (err) {
        console.error('Failed to load subscription status:', err);
        setUserTier('free');
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
      } catch {}
    } else {
      setReferralCopied(false);
      setReferralError('Unable to copy link automatically. Please copy it manually.');
    }
  };

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    referralLastSeenIdRef.current = user?.referralLastSeenId ?? null;

    if (user?.id) {
      let cachedTier: 'free' | 'paid' | null = null;
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`cogniguide_user_tier_${user.id}`);
          if (stored === 'free' || stored === 'paid') {
            cachedTier = stored;
          }
        }
      } catch {}

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
    }
  }, [user, refreshUserTier]);

  useEffect(() => {
    if (!isPaidUser && selectedModel === 'smart') {
      setSelectedModel('fast');
    }
  }, [isPaidUser, selectedModel]);

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
      } catch {}
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
      const allowed = choice === 'fast' || isPaidUser;
      try {
        posthog.capture('generation_model_option_clicked', {
          model: choice,
          allowed,
          location: 'dashboard',
        });
      } catch {}

      if (!allowed) {
        lastUpgradeTriggerRef.current = 'model-selector';
        setIsPricingModalOpen(true);
        setIsModeMenuOpen(false); // Close the popover when showing pricing modal
        return;
      }

      setSelectedModel(choice);
      setHoveredModel(choice);
      setIsModeMenuOpen(false);
    },
    [isPaidUser]
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
    } catch {}
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
        } catch {}
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
            } catch {}
          }
        }
        try {
          posthog.capture('referral_code_redeemed', { status: 'success', actor: 'redeemer', reward: rewardAmount });
        } catch {}
      } else {
        const errorMessage = result?.error || 'Referral redemption failed.';
        console.warn('Referral redemption failed:', errorMessage);
        try {
          posthog.capture('referral_code_redeemed', { status: 'failed', error: errorMessage, actor: 'redeemer' });
        } catch {}
      }
    } catch (error) {
      console.error('Error redeeming referral code:', error);
      try {
        posthog.capture('referral_code_redeemed', { status: 'error', actor: 'redeemer' });
      } catch {}
    }
  }, [showReferralRewardNotice]);

  const handleCreateShareLink = async () => {
    if (!shareItem) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/api/share-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ itemId: shareItem.id, itemType: shareItem.type })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok || !result?.token) {
        throw new Error(result?.error || 'Failed to create share link.');
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const link = typeof result.url === 'string' && result.url.length > 0
        ? result.url
        : origin
          ? `${origin.replace(/\/$/, '')}/share/${shareItem.type}/${result.token}`
          : `/share/${shareItem.type}/${result.token}`;
      const key = `${shareItem.type}:${shareItem.id}`;
      shareLinksCacheRef.current.set(key, link);
      setShareLink(link);
      await copyShareLink(link);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share link.';
      setShareError(message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    await copyShareLink(shareLink);
  };

  const handleShareButtonClick = () => {
    if (shareLoading) return;
    if (shareLink) {
      void handleCopyShareLink();
    } else {
      void handleCreateShareLink();
    }
  };

  const handleClosePricingModal = () => {
    setIsPricingModalOpen(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cogniguide_open_upgrade');
        localStorage.removeItem('cogniguide_upgrade_flow');
      }
    } catch {}
    router.replace('/dashboard', { scroll: false });
  };

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
    } catch {}

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
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const result = await response.json();
        if (result.ok && typeof result.credits === 'number') {
          setCredits(result.credits);
          // Cache the result
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(`cogniguide_credits_${userId}`, result.credits.toString());
              localStorage.setItem(`cogniguide_credits_time_${userId}`, Date.now().toString());
            }
          } catch {}
          return; // Successfully loaded credits from API response
        }
      }
    } catch {}

    // Fallback: fetch credits directly from database if API call failed
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (data) {
      const val = Number((data as any).credits ?? 0);
      const finalCredits = Number.isFinite(val) ? val : 0;
      setCredits(finalCredits);
      // Cache the fallback result too
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cogniguide_credits_${userId}`, finalCredits.toString());
          localStorage.setItem(`cogniguide_credits_time_${userId}`, Date.now().toString());
        }
      } catch {}
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
        if (authed.id) {
          initPaginatedHistory(authed.id);
          loadAllFlashcardsOnly(authed.id).then((allFlash) => {
            try { prefetchSpacedData(allFlash); } catch {}
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
          } catch {}
        }
      };

      // Load credits immediately (no dependency on history loading)
      loadUserCredits(authed.id);

      // Initialize paginated sidebar history and spaced data prefetch
      await initPaginatedHistory(authed.id);
      try {
        const allFlash = await loadAllFlashcardsOnly(authed.id);
        await prefetchSpacedData(allFlash);
      } catch {}

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
        } catch {}
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
    const key = hasUpgradeQuery ? `query:${upgradeQueryParam}` : hasLocalFlag ? 'local' : null;

    if (!key) {
      lastUpgradeTriggerRef.current = null;
      return;
    }

    if (lastUpgradeTriggerRef.current === key) {
      if (hasLocalFlag) {
        try {
          localStorage.removeItem('cogniguide_open_upgrade');
          localStorage.removeItem('cogniguide_upgrade_flow');
        } catch {}
      }
      return;
    }

    lastUpgradeTriggerRef.current = key;
    setIsPricingModalOpen(true);
    if (hasLocalFlag) {
      try {
        localStorage.removeItem('cogniguide_open_upgrade');
        localStorage.removeItem('cogniguide_upgrade_flow');
      } catch {}
    }
  }, [upgradeQueryParam]);

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
            } catch {}
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
      window.removeEventListener('cogniguide:generation-complete', () => {});
      window.removeEventListener('cogniguide:credits-updated', () => {});
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
          ...fcArr.map((f) => ({ type: 'flashcards' as const, id: f.id, title: f.title, created_at: f.created_at, cards: (f.cards as any) as FlashcardType[] })),
        ]).slice(0, PAGE_SIZE);
        setCombinedHistory(merged);
      } catch {}
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
      const queue: Array<{ id: string; title: string | null; cards: FlashcardType[] }> = [];
      let totalDue = 0;
      for (const f of fcRecords) {
        const deckId = f.id;
        const cardsArr = (f.cards as any[]) as FlashcardType[];
        let schedules = (allSchedules[deckId]?.schedules || loadDeckSchedule(deckId)?.schedules || []) as any[];
        const examDate = allSchedules[deckId]?.examDate || loadDeckSchedule(deckId)?.examDate || undefined;
        if (schedules.length !== cardsArr.length) {
          if (schedules.length > cardsArr.length) {
            schedules = schedules.slice(0, cardsArr.length);
          } else {
            const deficit = cardsArr.length - schedules.length;
            for (let i = 0; i < deficit; i++) schedules.push(createInitialSchedule(now));
          }
          const normalized: StoredDeckSchedule = { examDate, schedules };
          bulkToSave.push({ deckId, data: normalized });
          // update local cache immediately
          saveDeckSchedule(deckId, normalized);
        }
        // Check if exam date has passed - if so, don't include cards in due queue
        let dIdx: number[] = [];
        if (examDate) {
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
        } else {
          // No exam date set - include due cards normally
          dIdx = schedules
            .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
            .filter((x: any) => x.due <= now)
            .map((x: any) => x.i);
        }
        dueMap[deckId] = dIdx;
        totalDue += dIdx.length;
        if (dIdx.length > 0) {
          queue.push({ id: deckId, title: f.title, cards: cardsArr });
        }
      }
      if (bulkToSave.length > 0) {
        try { await upsertDeckSchedulesBulkAsync(bulkToSave); } catch {}
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
    const queue: Array<{ id: string; title: string | null; cards: FlashcardType[] }> = [];
    let totalDue = 0;
    for (const f of fcRecords) {
      const deckId = f.id;
      const cardsArr = (f.cards as any[]) as FlashcardType[];
      let stored = loadDeckSchedule(deckId);
      let schedules = (stored?.schedules || []) as any[];
      if (schedules.length !== cardsArr.length) {
        if (schedules.length > cardsArr.length) schedules = schedules.slice(0, cardsArr.length);
        else {
          const deficit = cardsArr.length - schedules.length;
          for (let i = 0; i < deficit; i++) schedules.push(createInitialSchedule(now));
        }
        const normalized: StoredDeckSchedule = { examDate: stored?.examDate, schedules };
        saveDeckSchedule(deckId, normalized);
      }
      // Check if exam date has passed - if so, don't include cards in due queue
      let dIdx: number[] = [];
      const examDate = stored?.examDate;
      if (examDate) {
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
      } else {
        // No exam date set - include due cards normally
        dIdx = schedules
          .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
          .filter((x: any) => x.due <= now)
          .map((x: any) => x.i);
      }
      dueMap[deckId] = dIdx;
      totalDue += dIdx.length;
      if (dIdx.length > 0) queue.push({ id: deckId, title: f.title, cards: cardsArr });
    }
    setDueQueue(queue);
    if (typeof window !== 'undefined') {
      (window as any).__cogniguide_due_map = dueMap;
    }
    setTotalDueCount(totalDue);
  };

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
    } catch {}
  }, [spacedPrefetched, flashcardsHistory]);

  const handleSignOut = async () => {
    posthog.capture('user_signed_out');
    await supabase.auth.signOut();

    // Clear the auth cookie to prevent middleware from redirecting back to dashboard
    try {
      if (typeof document !== 'undefined') {
        document.cookie = 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
      }
    } catch {}

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
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r bg-background pl-2 pt-2 pb-2 pr-0 flex flex-col h-screen min-h-0 transform transition-transform duration-300 md:relative md:translate-x-0 md:flex ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
            <button onClick={() => setIsSidebarOpen(false)} className="p-1 rounded-full hover:bg-muted md:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mb-4 pl-0 pr-2">
            <button
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
                  {totalDueCount > 99 ? '99+' : totalDueCount}
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
                        setActiveDeckId(item.id);
                        setFlashcardsCards(arr as FlashcardType[]);
                        setFlashcardsError(null);
                        setFlashcardsOpen(true);
                      }
                    }}
        className={`w-full text-left pl-2 py-2 rounded-xl flex items-start gap-2 transition-all ${
          openMenuId === itemKey
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
            onClick={() => setIsSettingsOpen(true)}
            className="w-full text-left pl-2 pr-2 py-2 rounded-xl hover:bg-muted/50 flex items-center gap-3 transition-colors"
          >
    <div className="relative h-7 w-7 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-medium text-foreground/80">
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
            <div className="min-w-0 flex-1">
              <div className="font-medium line-clamp-1">{displayName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>{(Math.floor(credits * 10) / 10).toFixed(1)} Credits</span>
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
                  return (
                    <button
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
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Image src={CogniGuideLogo} alt="CogniGuide" width={24} height={24} className="h-6 w-6" />
            <span className="font-bold">CogniGuide</span>
          </div>
          <div className="w-6" /> {/* Spacer */}
        </header>
        <div className="container mx-auto px-6 pb-6 mt-16 md:mt-10">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center mb-8 min-h-[3rem]">
              {(() => {
                const shouldShowButton = !tierLoading && !isPaidUser;
                return shouldShowButton ? (
                  <div className="flex justify-center w-full">
                    <button
                      onClick={() => setIsPricingModalOpen(true)}
                      className="upgrade-plan-btn inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mx-auto"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Upgrade your Plan</span>
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
            <Generator showTitle={false} modelChoice={selectedModel} />
          </div>
        </div>
      </main>

      <MindMapModal
        markdown={markdown}
        onClose={() => {
          setMarkdown(null);
          setActiveMindMapId(null);
          setActiveMindMapTitle(null);
        }}
        onShareMindMap={activeMindMapId ? () => setShareItem({ id: activeMindMapId, type: 'mindmap', title: activeMindMapTitle ?? null }) : undefined}
        onShareFlashcards={(deckId, title) => {
          setShareItem({ id: deckId, type: 'flashcards', title });
        }}
      />
      <FlashcardsModal
        open={flashcardsOpen}
        title={flashcardsTitle}
        cards={flashcardsCards}
        isGenerating={false}
        error={flashcardsError}
        onClose={() => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setStudyDueOnly(false); setStudyInterleaved(false); setDueIndices(undefined); setInitialDueIndex(undefined); setActiveDeckId(undefined); }}
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

      {spacedOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center" onClick={() => setSpacedOpen(false)}>
          <div className="bg-background rounded-[2rem] p-6 w-full max-w-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Spaced repetition</h2>
              <button onClick={() => setSpacedOpen(false)} className="px-3 py-1.5 rounded-full border hover:bg-muted/50 transition-colors">Close</button>
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
                return (
                  <div key={f.id} className="p-2 rounded-xl border flex items-center justify-between">
                    <div>
                      <div className="font-medium line-clamp-1">{f.title || 'flashcards'}</div>
                      <div className="text-xs text-muted-foreground">{count} due now</div>
                    </div>
                    <button
                      className="px-3 py-1.5 text-xs rounded-full border bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        const list = (dueMap[f.id] as number[]) || [];
                        posthog.capture('spaced_repetition_deck_studied', {
                          deck_id: f.id,
                          due_card_count: list.length,
                        });
                        const arr = f.cards as any; (arr as any).__deckId = f.id; setActiveDeckId(f.id);
                        setStudyDueOnly(true);
                        setDueIndices(list);
                        setInitialDueIndex(list[0] ?? 0);
                        setSpacedOpen(false);
                        setFlashcardsTitle(f.title || 'flashcards');
                        setFlashcardsCards(arr);
                        setFlashcardsError(null);
                        setFlashcardsOpen(true);
                      }}
                    >
                      Study
                    </button>
                  </div>
                );
              })}
              {!spacedLoading && dueQueue.length === 0 && (
                <div className="text-sm text-muted-foreground">No saved flashcards yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-background rounded-[2rem] p-6 w-full max-w-sm border flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex-shrink-0">Settings</h2>
            <div className="flex-1">
              <div className="p-4 rounded-[1.25rem] border bg-muted/30 mb-4">
                <div className="text-sm text-muted-foreground">Credit Balance</div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <Coins className="h-6 w-6 text-primary" />
                  <span>{(Math.floor(credits * 10) / 10).toFixed(1)}</span>
                </div>
              </div>
              <div className="mb-4">
                <ThemeToggle />
              </div>
              <nav className="mb-4">
                <ul className="space-y-2 text-sm">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setLegalOpen(false);
                        setIsSettingsOpen(false);
                        setIsReferralOpen(true);
                      }}
                      className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50 flex items-center gap-3"
                    >
                      <Gift className="h-4 w-4 text-primary" />
                      <span>Refer friends (earn credits)</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setIsPricingModalOpen(true)}
                      className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50 flex items-center gap-3"
                    >
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span>Upgrade Plan</span>
                    </button>
                  </li>
                  <li>
                    <Link href="/contact" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50 flex items-center gap-3">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>Contact</span>
                    </Link>
                  </li>
                  <li className="relative">
                    <button
                      onClick={() => setLegalOpen(!legalOpen)}
                      className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50 flex items-center gap-3"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Legal</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ml-auto ${legalOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {legalOpen && (
                      <div className="absolute left-full top-0 ml-2 z-10 bg-background border rounded-[1.25rem] p-2 shadow-lg min-w-[140px]">
                        <div className="flex flex-col space-y-1">
                          <Link href="/legal/refund-policy" className="block w-full p-2 text-xs rounded-lg border bg-background hover:bg-muted/50">Refunds</Link>
                          <Link href="/legal/cancellation-policy" className="block w-full p-2 text-xs rounded-lg border bg-background hover:bg-muted/50">Cancellation</Link>
                          <Link href="/legal/terms" className="block w-full p-2 text-xs rounded-lg border bg-background hover:bg-muted/50">Terms</Link>
                          <Link href="/legal/privacy-policy" className="block w-full p-2 text-xs rounded-lg border bg-background hover:bg-muted/50">Privacy</Link>
                        </div>
                      </div>
                    )}
                  </li>
                </ul>
              </nav>
            </div>

            <button onClick={handleSignOut} className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:border-red-800 flex items-center gap-3 text-red-600 flex-shrink-0 mt-4">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign out</span>
            </button>

            <div className="text-xs text-muted-foreground text-center mt-4">© {new Date().getFullYear()} CogniGuide</div>
          </div>
        </div>
      )}

      {isReferralOpen && (
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
      )}

      {referralRewardNotice && (
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
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {shareItem && isSharePortalReady && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[1000] flex items-center justify-center p-4"
              onClick={() => setShareItem(null)}
            >
              <div
                className="relative bg-background rounded-[1.5rem] p-6 w-full max-w-md border"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShareItem(null)}
                  className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted/60"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mb-1">
                  <h2 className="text-lg font-bold">
                    Share public link to {shareItem.type === 'mindmap' ? 'Mind Map' : 'Flashcards'}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Anyone with the link can view this {shareItem.type === 'mindmap' ? 'mind map' : 'flashcard deck'}.
                </p>
                {shareError && <div className="mb-3 text-sm text-red-600">{shareError}</div>}
                <div className="space-y-3">
                  <div className="flex rounded-full border border-border/40 bg-background shadow-inner focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40">
                    <input
                      ref={shareLinkInputRef}
                      value={shareLink ?? ''}
                      readOnly
                      placeholder="https://cogniguide.app/share/…"
                      className="flex-1 bg-transparent px-4 py-3 text-sm font-medium text-foreground border-none outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={handleShareButtonClick}
                      disabled={shareLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 mr-1 my-1"
                    >
                      {shareLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : shareLink ? (
                        shareCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      <span>
                        {shareLoading
                          ? 'Creating…'
                          : shareLink
                            ? shareCopied
                              ? 'Copied!'
                              : 'Copy link'
                            : 'Create link'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
