'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, MindmapRecord, FlashcardsRecord } from '@/lib/supabaseClient';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import { BrainCircuit, LogOut, Loader2, Map as MapIcon, Coins, Zap, Sparkles, CalendarClock } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import { loadDeckSchedule, saveDeckSchedule, loadDeckScheduleAsync, saveDeckScheduleAsync, loadAllDeckSchedulesAsync, upsertDeckSchedulesBulkAsync, type StoredDeckSchedule } from '@/lib/sr-store';
import { createInitialSchedule } from '@/lib/spaced-repetition';
import PricingModal from '@/components/PricingModal';

type SessionUser = {
  id: string;
  email?: string;
};

// Extract the first emoji from a title, if any
function extractFirstEmoji(text?: string | null): string | null {
  if (!text) return null;
  // Prefer Unicode property escapes when supported
  try {
    const re = new RegExp('\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\u200D\\p{Extended_pictographic}(?:\\uFE0F|\\uFE0E)?)*', 'u');
    const m = text.match(re);
    if (m) return m[0];
  } catch {
    // ignore if runtime doesn't support Unicode property escapes
  }
  // Flags (regional indicator pairs) e.g. 🇺🇸
  const flag = text.match(/(?:\uD83C[\uDDE6-\uDDFF]){2}/);
  if (flag) return flag[0];
  // Fallback: common BMP emoji blocks and symbols (kept narrow to avoid false positives)
  const fallback = /([\u2600-\u26FF]|[\u2700-\u27BF]|[\u2300-\u23FF]|[\u2190-\u21FF]|[\u2B00-\u2BFF]|[\u25A0-\u25FF]|\u24C2|\u3030|\u00AE|\u00A9|\u2122)/;
  const m2 = text.match(fallback);
  return m2 ? m2[0] : null;
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [history, setHistory] = useState<MindmapRecord[]>([]);
  const [flashcardsHistory, setFlashcardsHistory] = useState<FlashcardsRecord[]>([]);
  const [combinedHistory, setCombinedHistory] = useState<Array<
    | { type: 'mindmap'; id: string; title: string | null; created_at: string; markdown: string }
    | { type: 'flashcards'; id: string; title: string | null; created_at: string; cards: FlashcardType[] }
  >>([]);
  const [mode, setMode] = useState<'mindmap' | 'flashcards'>('mindmap');
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
  const prefetchingRef = useRef(false);
  const [totalDueCount, setTotalDueCount] = useState<number>(0);
  const [creditsUpdated, setCreditsUpdated] = useState(false);

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
    // Ensure initial/monthly free credits for non-subscribers on dashboard load
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken) {
        await fetch('/api/ensure-credits', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      }
    } catch {}
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (data) {
      const val = Number((data as any).credits ?? 0);
      setCredits(Number.isFinite(val) ? val : 0);
    }
  };

  useEffect(() => {
    const channelRef = { current: null as any }; 

    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = data.user ? { id: data.user.id, email: data.user.email || undefined } : null;
      setUser(authed);
      setLoading(false);
      if (!authed) {
        router.replace('/');
        return;
      }
      const all = await loadAllHistory(authed.id);
      await loadUserCredits(authed.id);

      channelRef.current = supabase.channel(`user_credits:${authed.id}`);
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_credits',
            filter: `user_id=eq.${authed.id}`,
          },
          async (payload: any) => {
            const newCredits = (payload.new as { credits: number })?.credits;
            if (typeof newCredits === 'number') {
              let prevCreditsValue = 0;
              setCredits((prevCredits) => {
                prevCreditsValue = prevCredits;
                if (newCredits > prevCredits) {
                  setCreditsUpdated(true);
                  setTimeout(() => setCreditsUpdated(false), 5000);
                }
                return newCredits;
              });

              // If credits increased (likely a purchase), refresh dashboard data
              if (newCredits > prevCreditsValue) {
                try {
                  // Refresh history data after purchase
                  const all = await loadAllHistory(authed.id);
                  // Refresh spaced repetition data
                  await prefetchSpacedData(all.flashcards);
                } catch (error) {
                  console.error('Failed to refresh dashboard after credit update:', error);
                }
              }
            }
          }
        )
        .subscribe();

      try { await prefetchSpacedData(all.flashcards); } catch {}
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [router, searchParams]);

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

  const handleFileChange = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const extractTitle = (md: string): string => {
    const h1 = md.match(/^#\s(.*)/m)?.[1];
    if (h1) return h1;
    const fm = md.match(/title:\s*(.*)/)?.[1];
    if (fm) return fm;
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

  const handleSubmit = async () => {
    if (mode === 'flashcards') {
      if (files.length === 0) {
        setError('Please upload at least one file to generate flashcards.');
        return;
      }
      setIsGenerating(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);

      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (prompt.trim()) formData.append('prompt', prompt.trim());

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch('/api/generate-flashcards?stream=1', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        // Mirror mindmap behavior: block modal and show inline notice on insufficient credits
        if (res.status === 402) {
          let msg = 'Insufficient credits. Please upgrade your plan or top up.';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsGenerating(false);
          return;
        }
        if (!res.ok) {
          let msg = 'Failed to generate flashcards';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsGenerating(false);
          return;
        }
        // Deduction occurs server-side at start; credits will refresh via realtime subscription
        setFlashcardsOpen(true);
        if (!res.body) {
          const data = await res.json().catch(() => null);
          const cards = Array.isArray(data?.cards) ? data.cards as FlashcardType[] : [];
          if (cards.length === 0) throw new Error('No cards generated');
          setFlashcardsCards(cards);
          setFlashcardsTitle(typeof data?.title === 'string' ? data.title : null);
          // Persist generated flashcards for authenticated users and refresh history
          if (user) {
            try {
              const titleToSave = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: user.id, title: titleToSave, markdown: '', cards })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setActiveDeckId((ins as any).id as string);
              }
              const all2 = await loadAllHistory(user.id);
              try { await prefetchSpacedData(all2.flashcards); } catch {}
            } catch {
              // ignore persistence errors in UI flow
            }
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let streamedTitle: string | null = null;
          const accumulated: FlashcardType[] = [];
          while (true) {
            // eslint-disable-next-line no-await-in-loop
            const { value, done } = await reader.read();
            if (done) break;
            if (value) buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
              const rawLine = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!rawLine) continue;
              try {
                const obj = JSON.parse(rawLine);
                if (obj?.type === 'meta') {
                  if (typeof obj.title === 'string' && obj.title.trim()) streamedTitle = obj.title.trim();
                } else if (obj?.type === 'card') {
                  const card: FlashcardType = {
                    question: String(obj.question || ''),
                    answer: String(obj.answer || ''),
                    tags: Array.isArray(obj.tags) ? obj.tags.map((t: any) => String(t)) : undefined,
                  };
                  accumulated.push(card);
                  setFlashcardsCards((prev) => prev ? [...prev, card] : [card]);
                }
              } catch {}
            }
          }
          setFlashcardsTitle(streamedTitle);
          if (accumulated.length === 0) throw new Error('No cards generated');
          // Persist generated flashcards for authenticated users and refresh history
          if (user) {
            try {
              const titleToSave = (streamedTitle && streamedTitle.trim()) ? streamedTitle.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: user.id, title: titleToSave, markdown: '', cards: accumulated })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setActiveDeckId((ins as any).id as string);
              }
              const all2 = await loadAllHistory(user.id);
              try { await prefetchSpacedData(all2.flashcards); } catch {}
            } catch {
              // ignore persistence errors in UI flow
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to generate flashcards');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    if (files.length === 0 && !prompt.trim()) {
      setError('Please upload at least one file or enter a text prompt.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setMarkdown(null);

    const formData = new FormData();
    if (files.length > 0) files.forEach((f) => formData.append('files', f));
    if (prompt.trim()) formData.append('prompt', prompt.trim());

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch('/api/generate-mindmap', {
        method: 'POST',
        body: formData,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          let msg = 'Failed to generate';
          try { const j = await res.json(); msg = j.error || msg; } catch {}
          throw new Error(msg);
        } else {
          throw new Error('Failed to generate');
        }
      }
      // Deduction occurs server-side at start; credits will refresh via realtime subscription
      if (!contentType.includes('text/plain')) {
        const result = await res.json();
        const md = (result?.markdown as string | undefined)?.trim();
        if (!md) throw new Error('Empty result');
        setMarkdown(md);
        if (user) {
          const title = extractTitle(md);
          await supabase.from('mindmaps').insert({ user_id: user.id, title, markdown: md });
          await loadAllHistory(user.id);
        }
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response stream');
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMarkdown(accumulated);
      }
      const md = accumulated.trim();
      if (!md) throw new Error('Empty result');
      // Save to history after stream completes
      if (user) {
        const title = extractTitle(md);
        await supabase.from('mindmaps').insert({ user_id: user.id, title, markdown: md });
        await loadAllHistory(user.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignOut = async () => {
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
      {/* Sidebar */}
      <aside className="w-72 border-r bg-muted/30 p-4 flex flex-col h-screen min-h-0">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <span className="font-bold">Your History</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {combinedHistory.length === 0 && (
            <div className="text-sm text-muted-foreground">No history yet.</div>
          )}
          {combinedHistory.map((item) => (
            <button
              key={`${item.type}:${item.id}`}
              onClick={() => {
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
                <span className={`transition-colors duration-300 ${creditsUpdated ? 'text-green-500 font-bold' : ''}`}>{(Math.floor(credits * 10) / 10).toFixed(1)} Credits Remaining</span>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-6 pt-2 pb-6 overflow-y-auto min-h-0">
        <div className="container max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-blue-100/50 text-blue-600 hover:bg-blue-200/50 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Upgrade your Plan</span>
            </button>
          </div>
          <div className="relative w-full bg-background rounded-[2rem] border border-border/20 shadow-[0_0_16px_rgba(0,0,0,0.12)] hover:shadow-[0_0_20px_rgba(0,0,0,0.16)] transition-shadow duration-300">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-center">
                <div className="inline-flex p-1 rounded-full border bg-white">
                  <button onClick={() => setMode('mindmap')} className={`px-4 py-1.5 text-sm rounded-full ${mode==='mindmap' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Mind Map</button>
                  <button onClick={() => setMode('flashcards')} className={`px-4 py-1.5 text-sm rounded-full ${mode==='flashcards' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Flashcards</button>
                </div>
              </div>
              <Dropzone onFileChange={setFiles} disabled={isGenerating || markdown !== null || flashcardsOpen} />
              <PromptForm
                onSubmit={handleSubmit}
                isLoading={isGenerating}
                prompt={prompt}
                setPrompt={setPrompt}
                disabled={isGenerating || markdown !== null || flashcardsOpen}
                filesLength={files.length}
                ctaLabel={mode==='flashcards' ? 'Generate Flashcards' : 'Generate Mind Map'}
              />
              {error && (
                <div className="mt-2 text-center p-3 bg-blue-100/50 border border-blue-400/50 text-blue-700 rounded-[1rem]">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <span className="sm:mr-2">{error}</span>
                    {typeof error === 'string' && error.toLowerCase().includes('insufficient credits') && (
                      <button
                        type="button"
                        onClick={() => setIsPricingModalOpen(true)}
                        className="px-4 py-1.5 text-sm rounded-full bg-primary text-white hover:bg-primary/90"
                      >
                        Upgrade Plan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <MindMapModal markdown={markdown} onClose={() => setMarkdown(null)} />
      <FlashcardsModal
        open={flashcardsOpen}
        title={flashcardsTitle}
        cards={flashcardsCards}
        isGenerating={isGenerating && mode==='flashcards'}
        error={flashcardsError}
        onClose={() => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setStudyDueOnly(false); setDueIndices(undefined); setInitialDueIndex(undefined); }}
        deckId={activeDeckId || (flashcardsCards as any)?.__deckId}
        studyDueOnly={studyDueOnly}
        dueIndices={dueIndices}
        initialIndex={initialDueIndex}
      />
      <PricingModal isOpen={isPricingModalOpen} onClose={handleClosePricingModal} />

      {spacedOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSpacedOpen(false)}>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
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
                      className="px-3 py-1.5 text-xs rounded-full border bg-white hover:bg-gray-50"
                      onClick={() => {
                        const arr = f.cards as any; (arr as any).__deckId = f.id; setActiveDeckId(f.id);
                        setStudyDueOnly(true);
                        const list = (dueMap[f.id] as number[]) || [];
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Settings</h2>
            <div className="p-4 rounded-[1.25rem] border bg-muted/30 mb-4">
              <div className="text-sm text-muted-foreground">Credit Balance</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Coins className="h-6 w-6 text-primary" />
                <span className={`transition-colors duration-300 ${creditsUpdated ? 'text-green-500' : ''}`}>{(Math.floor(credits * 10) / 10).toFixed(1)}</span>
              </div>
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
                <li>
                  <Link href="/legal/refund-policy" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50">Refunds</Link>
                </li>
                <li>
                  <Link href="/legal/cancellation-policy" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50">Cancellation</Link>
                </li>
                <li>
                  <Link href="/legal/terms" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50">Terms</Link>
                </li>
                <li>
                  <Link href="/legal/privacy-policy" className="block w-full p-3 rounded-[1.25rem] border bg-background hover:bg-muted/50">Privacy</Link>
                </li>
              </ul>
              <div className="text-xs text-muted-foreground text-center mt-4">© {new Date().getFullYear()} CogniGuide</div>
            </nav>

            <button onClick={handleSignOut} className="w-full text-left p-3 rounded-[1.25rem] border bg-background hover:bg-red-50 hover:border-red-200 flex items-center gap-3 text-red-600">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
