import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(
  _req: NextRequest,
  context: { params?: Promise<{ shareId?: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 });
  }

  const resolvedParams = context.params ? await context.params : undefined;
  const shareId = resolvedParams?.shareId;
  if (!shareId) {
    return NextResponse.json({ ok: false, error: 'Missing share ID.' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('public_shares')
      .select('item_type, title, markdown, cards, created_at')
      .eq('share_id', shareId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to load shared item:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Share link not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, share: data });
  } catch (error) {
    console.error('Unexpected error fetching shared item:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
