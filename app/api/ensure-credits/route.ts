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

async function ensureInitialOrMonthlyFreeCredits(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const active = await hasActiveSubscription(userId);
    if (active) return; // Paid plans handled via webhook
  } catch {}
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits, last_refilled_at')
    .eq('user_id', userId)
    .single();
  const nowIso = new Date().toISOString();
  if (!data) {
    await supabaseAdmin.from('user_credits').insert({
      user_id: userId,
      credits: FREE_PLAN_CREDITS,
      last_refilled_at: nowIso,
    });
    return;
  }
  const last = (data as any).last_refilled_at ? new Date((data as any).last_refilled_at) : null;
  const now = new Date(nowIso);
  if (!last || !isSameUtcMonth(last, now)) {
    await supabaseAdmin
      .from('user_credits')
      .update({ credits: FREE_PLAN_CREDITS, last_refilled_at: nowIso, updated_at: nowIso })
      .eq('user_id', userId);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    await ensureInitialOrMonthlyFreeCredits(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
