import { supabase } from '@/lib/supabaseClient';

export type StoredDeckSchedule = {
  examDate?: string; // YYYY-MM-DD
  schedules: Array<any>; // FsrsScheduleState[], but stored as plain JSON
};

const PREFIX = 'cogniguide_sr_schedule_';

// In-memory cache to avoid redundant Supabase round-trips when the dashboard prefetches
const memorySchedules: Record<string, StoredDeckSchedule> = {};

export function getMemoryDeckSchedule(deckId: string): StoredDeckSchedule | null {
  return memorySchedules[deckId] || null;
}

export function setMemoryDeckSchedule(deckId: string, data: StoredDeckSchedule): void {
  memorySchedules[deckId] = { examDate: data.examDate, schedules: data.schedules };
}

export function loadDeckSchedule(deckId: string): StoredDeckSchedule | null {
  try {
    if (typeof window === 'undefined') return null;
    // Prefer in-memory cache when present
    const inMem = getMemoryDeckSchedule(deckId);
    if (inMem) return inMem;
    const raw = localStorage.getItem(PREFIX + deckId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const schedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];
    const examDate = typeof parsed.examDate === 'string' ? parsed.examDate : undefined;
    const result = { schedules, examDate } as StoredDeckSchedule;
    setMemoryDeckSchedule(deckId, result);
    return result;
  } catch {
    return null;
  }
}

export function saveDeckSchedule(deckId: string, data: StoredDeckSchedule): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PREFIX + deckId, JSON.stringify({
      examDate: data.examDate,
      schedules: data.schedules,
    }));
    setMemoryDeckSchedule(deckId, data);
  } catch {}
}

// Supabase-backed versions. Falls back to local storage when not authenticated.
export async function loadDeckScheduleAsync(deckId: string): Promise<StoredDeckSchedule | null> {
  try {
    // Hit fast path: in-memory cache
    const inMem = getMemoryDeckSchedule(deckId);
    if (inMem) return inMem;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return loadDeckSchedule(deckId);
    const { data, error } = await supabase
      .from('flashcards_schedule')
      .select('schedules, exam_date')
      .eq('user_id', userId)
      .eq('deck_id', deckId)
      .single();
    if (error || !data) return loadDeckSchedule(deckId);
    const result = {
      schedules: Array.isArray((data as any).schedules) ? (data as any).schedules : [],
      examDate: (data as any).exam_date || undefined,
    } as StoredDeckSchedule;
    setMemoryDeckSchedule(deckId, result);
    // Mirror to localStorage for offline/fallback
    saveDeckSchedule(deckId, result);
    return result;
  } catch {
    return loadDeckSchedule(deckId);
  }
}

export async function saveDeckScheduleAsync(deckId: string, data: StoredDeckSchedule): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      saveDeckSchedule(deckId, data);
      return;
    }
    const payload = {
      user_id: userId,
      deck_id: deckId,
      exam_date: data.examDate || null,
      schedules: data.schedules || [],
      updated_at: new Date().toISOString(),
    };
    // upsert on (user_id, deck_id)
    await supabase.from('flashcards_schedule').upsert(payload, { onConflict: 'user_id,deck_id' });
    // Keep caches in sync
    setMemoryDeckSchedule(deckId, data);
    saveDeckSchedule(deckId, data);
  } catch {
    saveDeckSchedule(deckId, data);
  }
}

// Bulk-load all deck schedules for the current user in a single round-trip.
export async function loadAllDeckSchedulesAsync(): Promise<Record<string, StoredDeckSchedule>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return {};
    const { data, error } = await supabase
      .from('flashcards_schedule')
      .select('deck_id, schedules, exam_date')
      .eq('user_id', userId);
    if (error || !data) return {};
    const map: Record<string, StoredDeckSchedule> = {};
    (data as any[]).forEach((row) => {
      const deckId = String(row.deck_id);
      const schedules = Array.isArray(row.schedules) ? row.schedules : [];
      const examDate = row.exam_date || undefined;
      const val = { schedules, examDate } as StoredDeckSchedule;
      map[deckId] = val;
      setMemoryDeckSchedule(deckId, val);
      saveDeckSchedule(deckId, val);
    });
    return map;
  } catch {
    return {};
  }
}

// Bulk upsert helper to minimize network chatter when we normalize schedules
export async function upsertDeckSchedulesBulkAsync(items: Array<{ deckId: string; data: StoredDeckSchedule }>): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      items.forEach(({ deckId, data }) => saveDeckSchedule(deckId, data));
      return;
    }
    const rows = items.map(({ deckId, data }) => ({
      user_id: userId,
      deck_id: deckId,
      exam_date: data.examDate || null,
      schedules: data.schedules || [],
      updated_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await supabase.from('flashcards_schedule').upsert(rows, { onConflict: 'user_id,deck_id' });
      rows.forEach((r) => {
        const val = { examDate: r.exam_date || undefined, schedules: r.schedules } as StoredDeckSchedule;
        setMemoryDeckSchedule(r.deck_id as string, val);
        saveDeckSchedule(r.deck_id as string, val);
      });
    }
  } catch {
    items.forEach(({ deckId, data }) => saveDeckSchedule(deckId, data));
  }
}


