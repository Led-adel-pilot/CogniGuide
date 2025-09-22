import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyShareToken } from '@/lib/share-links';

type MindmapRow = {
  id: string;
  user_id: string;
  markdown: string;
  title: string | null;
};

type FlashcardsRow = {
  id: string;
  user_id: string;
  title: string | null;
  markdown: string | null;
  cards: unknown;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';
    if (!token) return null;
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Sharing is not configured.' }, { status: 500 });
  }

  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token.' }, { status: 400 });
    }

    const decoded = verifyShareToken(token);
    if (!decoded) {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 });
    }

    if (decoded.type === 'mindmap') {
      const { data, error } = await supabaseAdmin
        .from<MindmapRow>('mindmaps')
        .select('id, user_id, markdown, title')
        .eq('id', decoded.id)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ ok: false, error: 'Mind map not found.' }, { status: 404 });
      }

      if (data.user_id === userId) {
        return NextResponse.json({ ok: true, recordId: data.id, alreadyOwned: true });
      }

      const { data: existing } = await supabaseAdmin
        .from<{ id: string }>('mindmaps')
        .select('id')
        .eq('user_id', userId)
        .eq('markdown', data.markdown)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json({ ok: true, recordId: existing.id, alreadyOwned: false });
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from<{ id: string }>('mindmaps')
        .insert({
          user_id: userId,
          markdown: data.markdown,
          title: data.title,
        })
        .select('id')
        .single();

      if (insertError || !inserted?.id) {
        return NextResponse.json({ ok: false, error: 'Unable to copy mind map.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, recordId: inserted.id, alreadyOwned: false });
    }

    const { data, error } = await supabaseAdmin
      .from<FlashcardsRow>('flashcards')
      .select('id, user_id, title, markdown, cards')
      .eq('id', decoded.id)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'Flashcard deck not found.' }, { status: 404 });
    }

    if (data.user_id === userId) {
      return NextResponse.json({ ok: true, recordId: data.id, alreadyOwned: true });
    }

    const { data: existing } = await supabaseAdmin
      .from<{ id: string }>('flashcards')
      .select('id')
      .eq('user_id', userId)
      .eq('cards', data.cards)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ ok: true, recordId: existing.id, alreadyOwned: false });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from<{ id: string }>('flashcards')
      .insert({
        user_id: userId,
        title: data.title,
        markdown: data.markdown ?? '',
        cards: data.cards,
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      return NextResponse.json({ ok: false, error: 'Unable to copy flashcard deck.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, recordId: inserted.id, alreadyOwned: false });
  } catch (error) {
    console.error('Failed to import shared resource:', error);
    return NextResponse.json({ ok: false, error: 'Unable to import shared resource.' }, { status: 500 });
  }
}
