"use client";

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type MindmapRecord = {
  id: string;
  user_id: string;
  title: string | null;
  markdown: string;
  created_at: string;
};

export type FlashcardsRecord = {
  id: string;
  user_id: string;
  title: string | null;
  markdown: string; // source mindmap markdown snapshot
  cards: Array<{ question: string; answer: string }>; // stored as jsonb
  created_at: string;
};


