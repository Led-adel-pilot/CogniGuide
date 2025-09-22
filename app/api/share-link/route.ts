import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createShareToken, type ShareableResourceType } from '@/lib/share-links';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';
    if (!token || !supabaseAdmin) return null;
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id || null;
  } catch {
    return null;
  }
}

function validateType(value: unknown): value is ShareableResourceType {
  return value === 'mindmap' || value === 'flashcards';
}

function isOwnerRow(value: unknown): value is { id: string; user_id: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.user_id === 'string';
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
    const itemId = typeof body?.itemId === 'string' ? body.itemId : null;
    const itemType = body?.itemType;

    if (!validateType(itemType) || !itemId) {
      return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
    }

    const table = itemType === 'mindmap' ? 'mindmaps' : 'flashcards';
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('id, user_id')
      .eq('id', itemId)
      .limit(1)
      .maybeSingle();

    if (error || !data || !isOwnerRow(data)) {
      return NextResponse.json({ ok: false, error: 'Item not found.' }, { status: 404 });
    }

    if (data.user_id !== userId) {
      return NextResponse.json({ ok: false, error: 'You do not have permission to share this item.' }, { status: 403 });
    }

    const token = createShareToken(itemType, itemId);
    const origin = req.nextUrl?.origin || req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const url = origin
      ? `${origin.replace(/\/$/, '')}/share/${itemType}/${token}`
      : `/share/${itemType}/${token}`;

    return NextResponse.json({ ok: true, token, url });
  } catch (error) {
    console.error('Failed to create share link:', error);
    return NextResponse.json({ ok: false, error: 'Unable to create share link.' }, { status: 500 });
  }
}
