import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FREE_PLAN_CREDITS } from '@/lib/plans';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

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

async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  const status = Array.isArray(data) && data.length > 0 ? (data[0] as any).status : null;
  return status === 'active' || status === 'trialing';
}

async function ensureInitialOrMonthlyFreeCredits(userId: string): Promise<{ credits: number }> {
  if (!supabaseAdmin) return { credits: FREE_PLAN_CREDITS };
  try {
    const active = await hasActiveSubscription(userId);
    if (active) {
      // For paid subscribers, just return current credits without modification
      const { data } = await supabaseAdmin
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();
      const credits = Number((data as any)?.credits ?? FREE_PLAN_CREDITS);
      return { credits: Number.isFinite(credits) ? credits : FREE_PLAN_CREDITS };
    }
  } catch {}

  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits, last_refilled_at')
    .eq('user_id', userId)
    .single();

  const nowIso = new Date().toISOString();
  if (!data) {
    // Insert new record and return credits
    await supabaseAdmin.from('user_credits').insert({
      user_id: userId,
      credits: FREE_PLAN_CREDITS,
      last_refilled_at: nowIso,
    });
    return { credits: FREE_PLAN_CREDITS };
  }

  const last = (data as any).last_refilled_at ? new Date((data as any).last_refilled_at) : null;
  const currentCredits = Number((data as any).credits ?? 0);
  const now = new Date(nowIso);

  if (!last || !isSameUtcMonth(last, now)) {
    // Update credits and return new amount
    await supabaseAdmin
      .from('user_credits')
      .update({ credits: FREE_PLAN_CREDITS, last_refilled_at: nowIso, updated_at: nowIso })
      .eq('user_id', userId);
    return { credits: FREE_PLAN_CREDITS };
  }

  // Return existing credits
  return { credits: Number.isFinite(currentCredits) ? currentCredits : FREE_PLAN_CREDITS };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    // Ensure credits and get the current amount in one operation
    const result = await ensureInitialOrMonthlyFreeCredits(userId);
    return NextResponse.json({ ok: true, credits: result.credits });
  } catch (error) {
    console.error('Error in ensure-credits API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ ok: false, error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
