import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

type ShareItemType = 'mindmap' | 'flashcards';
type SharedFlashcard = { question: string; answer: string };

type MindmapRow = {
  id: string;
  user_id: string;
  title: string | null;
  markdown: string | null;
};

type FlashcardsRow = {
  id: string;
  user_id: string;
  title: string | null;
  markdown: string | null;
  cards: SharedFlashcard[] | null;
};

type ShareRow = {
  id: string;
  share_id: string;
};

interface SharePayload {
  type?: string;
  id?: string;
}

const isValidType = (value: string): value is ShareItemType =>
  value === 'mindmap' || value === 'flashcards';

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return null;
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch (error) {
    console.error('Failed to extract user from auth header:', error);
    return null;
  }
}

function generateShareId() {
  return randomBytes(9).toString('hex');
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 });
  }

  let payload: SharePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const type = typeof payload.type === 'string' ? payload.type.trim() : '';
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';

  if (!isValidType(type) || !id) {
    return NextResponse.json({ ok: false, error: 'Invalid share request.' }, { status: 400 });
  }

  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (type === 'mindmap') {
      const { data: record, error: fetchError } = await supabaseAdmin
        .from('mindmaps')
        .select<MindmapRow>('id, user_id, title, markdown')
        .eq('id', id)
        .limit(1)
        .single();

      if (fetchError || !record || record.user_id !== userId) {
        return NextResponse.json({ ok: false, error: 'Item not found.' }, { status: 404 });
      }

      const { data: existingShare, error: existingError } = await supabaseAdmin
        .from('public_shares')
        .select<ShareRow>('id, share_id')
        .eq('item_type', type)
        .eq('item_id', id)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingShare) {
        await supabaseAdmin
          .from('public_shares')
          .update({
            title: record.title ?? null,
            markdown: record.markdown ?? null,
            cards: null,
          })
          .eq('id', existingShare.id);

        return NextResponse.json({ ok: true, shareId: existingShare.share_id });
      }

      const shareId = generateShareId();
      await supabaseAdmin.from('public_shares').insert({
        user_id: userId,
        item_type: type,
        item_id: id,
        title: record.title ?? null,
        markdown: record.markdown ?? null,
        cards: null,
        share_id: shareId,
      });

      return NextResponse.json({ ok: true, shareId });
    }

    const { data: record, error: fetchError } = await supabaseAdmin
      .from('flashcards')
      .select<FlashcardsRow>('id, user_id, title, markdown, cards')
      .eq('id', id)
      .limit(1)
      .single();

    if (fetchError || !record || record.user_id !== userId) {
      return NextResponse.json({ ok: false, error: 'Item not found.' }, { status: 404 });
    }

    const { data: existingShare, error: existingError } = await supabaseAdmin
      .from('public_shares')
      .select<ShareRow>('id, share_id')
      .eq('item_type', type)
      .eq('item_id', id)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingShare) {
      await supabaseAdmin
        .from('public_shares')
        .update({
          title: record.title ?? null,
          markdown: record.markdown ?? null,
          cards: record.cards ?? null,
        })
        .eq('id', existingShare.id);

      return NextResponse.json({ ok: true, shareId: existingShare.share_id });
    }

    const shareId = generateShareId();
    await supabaseAdmin.from('public_shares').insert({
      user_id: userId,
      item_type: type,
      item_id: id,
      title: record.title ?? null,
      markdown: record.markdown ?? null,
      cards: record.cards ?? null,
      share_id: shareId,
    });

    return NextResponse.json({ ok: true, shareId });
  } catch (error) {
    console.error('Failed to create share link:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
