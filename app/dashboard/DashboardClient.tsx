'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, MindmapRecord, FlashcardsRecord } from '@/lib/supabaseClient';
import Generator from '@/components/Generator';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import { BrainCircuit, LogOut, Loader2, Map as MapIcon, Coins, Zap, Sparkles, CalendarClock, Menu, X, ChevronRight } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync, loadAllDeckSchedulesAsync, upsertDeckSchedulesBulkAsync, type StoredDeckSchedule } from '@/lib/sr-store';
import { createInitialSchedule } from '@/lib/spaced-repetition';
import PricingModal from '@/components/PricingModal';
import CogniGuideLogo from '../../CogniGuide_logo.png';
import Image from 'next/image';
import posthog from 'posthog-js';
import ThemeToggle from '@/components/ThemeToggle';

type SessionUser = {
  id: string;
  email?: string;
};

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [history, setHistory] = useState<MindmapRecord[]>([]);
  const [flashcardsHistory, setFlashcardsHistory] = useState<FlashcardsRecord[]>([]);
  const [combinedHistory, setCombinedHistory] = useState<Array<
    | { type: 'mindmap'; id: string; title: string | null; created_at: string; markdown: string }
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[] }
  >>([]);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [spacedOpen, setSpacedOpen] = useState(false);
  const [dueQueue, setDueQueue] = useState<Array<{ id: string; title: string | null; cards: FlashcardType[] }>>([]);
  const [studyDueOnly, setStudyDueOnly] = useState(false);
  const [dueIndices, setDueIndices] = useState<number[] | undefined>(undefined);
  const [initialDueIndex, setInitialDueIndex] = useState<number | undefined>(undefined);
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(undefined);
  const [spacedLoading, setSpacedLoading] = useState(false);
  const [spacedError, setSpacedError] = useState<string | null>(null);
  const [spacedPrefetched, setSpacedPrefetched] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const prefetchingRef = useRef(false);
  const [totalDueCount, setTotalDueCount] = useState<number>(0);

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
      const authed = data.user ? { id: data.user.id, email: data.user.email || undefined } : null;
      setUser(authed);
      setLoading(false);
      if (!authed) {
        router.replace('/');
        return;
      }

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

          if (!insertError && insertData) {
            // Open the newly saved mind map for a seamless UX
            setMarkdown(pendingMarkdown);
            // Reload history to show the new item
            await loadAllHistory(authed.id);
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
              // Reload history to show the new item
              await loadAllHistory(authed.id);
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
          loadAllHistory(authed.id);
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

      // Load history in parallel
      const all = await loadAllHistory(authed.id);
      try { await prefetchSpacedData(all.flashcards); } catch {}

      // Add event listeners
      window.addEventListener('cogniguide:generation-complete', handleGenerationComplete);
      window.addEventListener('cogniguide:credits-updated', handleCreditsUpdated as EventListener);

      try {
        const hasUpgradeQuery = Boolean(searchParams.get('upgrade'));
        const hasLocalFlag = typeof window !== 'undefined' && (
          localStorage.getItem('cogniguide_open_upgrade') === 'true' ||
          localStorage.getItem('cogniguide_upgrade_flow') === 'true'
        );
        if (hasUpgradeQuery || hasLocalFlag) {
          setIsPricingModalOpen(true);
          if (hasLocalFlag) {
            localStorage.removeItem('cogniguide_open_upgrade');
            localStorage.removeItem('cogniguide_upgrade_flow');
          }
        }
      } catch {}
    };

    init();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
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
  }, [router, searchParams]);

  useEffect(() => {
    if (user) {
      const channel = supabase
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
              // Update cache when credits change
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
    return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('cogniguide:generation-complete', () => {});
        window.removeEventListener('cogniguide:credits-updated', () => {});
      };
    }
  }, [user]);

  const loadHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from('mindmaps')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data as unknown as MindmapRecord[]);
  };

  const loadFlashcardsHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setFlashcardsHistory(data as unknown as FlashcardsRecord[]);
  };

  const loadAllHistory = async (userId: string) => {
    const [mm, fc] = await Promise.all([
      supabase
        .from('mindmaps')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ]);
    const mmArr = (!mm.error && mm.data ? (mm.data as any as MindmapRecord[]) : []);
    const fcArr = (!fc.error && fc.data ? (fc.data as any as FlashcardsRecord[]) : []);
    setHistory(mmArr);
    setFlashcardsHistory(fcArr);
    const mmItems = mmArr.map((m) => ({
      type: 'mindmap' as const,
      id: m.id,
      title: m.title,
      created_at: m.created_at,
      markdown: m.markdown,
    }));
    const fcItems = fcArr.map((f) => ({
      type: 'flashcards' as const,
      id: f.id,
      title: f.title,
      created_at: f.created_at,
      cards: (f.cards as any) as FlashcardType[],
    }));
    const combined = [...mmItems, ...fcItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setCombinedHistory(combined);
    return { mindmaps: mmArr, flashcards: fcArr };
  };

  const extractTitle = (md: string): string => {
    const h1 = md.match(/^#\s(.*)/m)?.[1];
    if (h1) return h1.trim();
    const fm = md.match(/title:\s*(.*)/)?.[1];
    if (fm) return fm.trim();
    return 'mindmap';
  };

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
        const dIdx = schedules
          .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
          .filter((x: any) => x.due <= now)
          .map((x: any) => x.i);
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
      const dIdx = schedules
        .map((s: any, i: number) => ({ i, due: s?.due ? new Date(s.due) : now }))
        .filter((x: any) => x.due <= now)
        .map((x: any) => x.i);
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
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r bg-background p-4 flex flex-col h-screen min-h-0 transform transition-transform duration-300 md:relative md:translate-x-0 md:flex ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Image src={CogniGuideLogo} alt="CogniGuide" width={24} height={24} className="h-6 w-6" />
            <span className="font-bold">Your History</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 rounded-full hover:bg-muted md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {combinedHistory.length === 0 && (
            <div className="text-sm text-muted-foreground">No history yet.</div>
          )}
          {combinedHistory.map((item) => (
            <button
              key={`${item.type}:${item.id}`}
              onClick={() => {
                posthog.capture('history_item_opened', {
                  type: item.type,
                  item_id: item.id,
                });
                if (item.type === 'mindmap') {
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
              className="w-full text-left p-2 rounded-xl border bg-background hover:bg-muted/50 flex items-start gap-3"
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
              <div className="min-w-0">
                <div className="font-medium line-clamp-1">
                  {(() => {
                    const cleaned = removeFirstEmoji(item.title);
                    return cleaned && cleaned.length > 0
                      ? cleaned
                      : (item.type === 'mindmap' ? 'mindmap' : 'flashcards');
                  })()}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-auto border-t pt-4">
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
            className="w-full text-left p-2 rounded-xl border bg-background hover:bg-muted/50 flex items-center gap-3 mb-2"
          >
            <CalendarClock className="h-5 w-5 text-primary" />
            <span className="font-medium">Spaced repetition</span>
            {totalDueCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold min-w-[20px] h-5 px-1">
                {totalDueCount > 99 ? '99+' : totalDueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full text-left p-2 rounded-xl border bg-background hover:bg-muted/50 flex items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium line-clamp-1">{user?.email || 'User'}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" />
                <span>{(Math.floor(credits * 10) / 10).toFixed(1)} Credits Remaining</span>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-h-0">
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
        <div className="container mx-auto px-6 pb-6 mt-12">
          <div className="text-center mt-2 mb-8">
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-blue-100/50 text-blue-600 hover:bg-blue-200/50 dark:bg-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-800/50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Upgrade your Plan</span>
            </button>
          </div>
          <Generator showTitle={false} />
        </div>
      </main>

      <MindMapModal markdown={markdown} onClose={() => setMarkdown(null)} />
      <FlashcardsModal
        open={flashcardsOpen}
        title={flashcardsTitle}
        cards={flashcardsCards}
        isGenerating={false}
        error={flashcardsError}
        onClose={() => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setStudyDueOnly(false); setDueIndices(undefined); setInitialDueIndex(undefined); }}
        deckId={activeDeckId || (flashcardsCards as any)?.__deckId}
        studyDueOnly={studyDueOnly}
        dueIndices={dueIndices}
        initialIndex={initialDueIndex}
      />
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={handleClosePricingModal}
        onPurchaseComplete={() => {
          if (user) {
            loadUserCredits(user.id);
          }
        }}
      />

      {spacedOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex items-center justify-center" onClick={() => setSpacedOpen(false)}>
          <div className="bg-background rounded-[2rem] p-6 w-full max-w-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Spaced repetition</h2>
              <button onClick={() => setSpacedOpen(false)} className="px-3 py-1.5 rounded-full border">Close</button>
            </div>
            {spacedError && (
              <div className="mb-3 text-sm text-red-600">{spacedError}</div>
            )}
            {!spacedError && (
              <div className="text-sm text-muted-foreground">
                Select a deck with cards due now.
              </div>
            )}
            <div className="mt-4 grid gap-2 max-h-80 overflow-y-auto">
              {spacedLoading && (
                <div className="text-sm text-muted-foreground">Loading due decks…</div>
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
                      className="px-3 py-1.5 text-xs rounded-full border bg-background hover:bg-muted/50"
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
                      onClick={() => setIsPricingModalOpen(true)}
                      className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50"
                    >
                      Pricing
                    </button>
                  </li>
                  <li>
                    <Link href="/contact" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50">Contact</Link>
                  </li>
                  <li className="relative">
                    <button
                      onClick={() => setLegalOpen(!legalOpen)}
                      className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50 flex items-center justify-between"
                    >
                      <span>Legal</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${legalOpen ? 'rotate-90' : ''}`} />
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
    </div>
  );
}
