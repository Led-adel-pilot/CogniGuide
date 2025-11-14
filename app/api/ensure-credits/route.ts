import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureFreeCreditsWithTrial } from '@/lib/server-user-tier';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || !supabaseAdmin) return null;
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id || null;
  } catch {
    return null;
  }
}


export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const result = await ensureFreeCreditsWithTrial(supabaseAdmin, userId);
    return NextResponse.json({
      ok: true,
      credits: result.credits,
      tier: result.tierHint,
      trialEndsAt: result.trialEndsAt,
    });
  } catch (error) {
    console.error('Error in ensure-credits API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ ok: false, error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
