import { supabase } from '@/lib/supabaseClient';

export type StoredDeckSchedule = {
  examDate?: string; // ISO datetime string (YYYY-MM-DDTHH:mm:ss.sssZ) or date-only string (YYYY-MM-DD)
  schedules: Array<any>; // FsrsScheduleState[], but stored as plain JSON
};

const PREFIX = 'cogniguide_sr_schedule_';

/**
 * Convert exam date to full datetime string with default 8:00 AM time
 * Handles both date-only strings (YYYY-MM-DD) and full datetime strings
 */
function normalizeExamDate(examDate?: string): string | undefined {
  if (!examDate) return undefined;

  // If it's already a full datetime string (contains T), return as-is
  if (examDate.includes('T')) {
    return examDate;
  }

  // If it's a date-only string, add default 8:00 AM time
  try {
    const date = new Date(examDate);
    if (isNaN(date.getTime())) return undefined;

    // Set to 8:00 AM local time, then convert to UTC
    date.setHours(8, 0, 0, 0);
    return date.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Convert datetime string to date-only string for UI display
 */
function formatExamDateForUI(examDate?: string): string {
  if (!examDate) return '';

  try {
    const date = new Date(examDate);
    if (isNaN(date.getTime())) return '';

    // Return date in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Convert datetime string to time-only string for UI display
 */
function formatExamTimeForUI(examDate?: string): string {
  if (!examDate) return '08:00'; // Default to 8:00 AM

  try {
    const date = new Date(examDate);
    if (isNaN(date.getTime())) return '08:00';

    // Return time in HH:mm format
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '08:00';
  }
}

// In-memory cache to avoid redundant Supabase round-trips when the dashboard prefetches
const memorySchedules: Record<string, StoredDeckSchedule> = {};

export { normalizeExamDate, formatExamDateForUI, formatExamTimeForUI };

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
    const normalizedExamDate = normalizeExamDate(data.examDate);
    localStorage.setItem(PREFIX + deckId, JSON.stringify({
      examDate: normalizedExamDate,
      schedules: data.schedules,
    }));
    setMemoryDeckSchedule(deckId, { ...data, examDate: normalizedExamDate });
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
    const normalizedExamDate = normalizeExamDate(data.examDate);
    const payload = {
      user_id: userId,
      deck_id: deckId,
      exam_date: normalizedExamDate || null,
      schedules: data.schedules || [],
      updated_at: new Date().toISOString(),
    };
    // upsert on (user_id, deck_id)
    await supabase.from('flashcards_schedule').upsert(payload, { onConflict: 'user_id,deck_id' });
    // Keep caches in sync
    const normalizedData = { ...data, examDate: normalizedExamDate };
    setMemoryDeckSchedule(deckId, normalizedData);
    saveDeckSchedule(deckId, normalizedData);
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
    const rows = items.map(({ deckId, data }) => {
      const normalizedExamDate = normalizeExamDate(data.examDate);
      return {
        user_id: userId,
        deck_id: deckId,
        exam_date: normalizedExamDate || null,
        schedules: data.schedules || [],
        updated_at: new Date().toISOString(),
      };
    });
    if (rows.length > 0) {
      await supabase.from('flashcards_schedule').upsert(rows, { onConflict: 'user_id,deck_id' });
      rows.forEach((r, index) => {
        const originalData = items[index].data;
        const normalizedExamDate = normalizeExamDate(originalData.examDate);
        const val = { examDate: normalizedExamDate || undefined, schedules: r.schedules } as StoredDeckSchedule;
        setMemoryDeckSchedule(r.deck_id as string, val);
        saveDeckSchedule(r.deck_id as string, val);
      });
    }
  } catch {
    items.forEach(({ deckId, data }) => saveDeckSchedule(deckId, data));
  }
}


