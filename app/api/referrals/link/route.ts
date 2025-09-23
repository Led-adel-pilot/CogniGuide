import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const REFERRAL_MONTHLY_LIMIT = 3;

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

function getUtcMonthRange(date: Date): { start: string; end: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function generateReferralCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

async function ensureReferralCode(userId: string): Promise<string> {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured');

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existingError && existing?.code) {
    return existing.code as string;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode();
    const { data: inserted, error } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: userId, code })
      .select('code')
      .single();

    if (!error && inserted?.code) {
      return inserted.code as string;
    }

    if (error?.code === '23505') {
      continue;
    }

    if (error) {
      throw error;
    }
  }

  throw new Error('Unable to generate a unique referral code');
}

export async function GET(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Referral program is not configured.' }, { status: 500 });
  }

  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const code = await ensureReferralCode(userId);
    const now = new Date();
    const { start, end } = getUtcMonthRange(now);

    const { count } = await supabaseAdmin
      .from('referral_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .gte('created_at', start)
      .lt('created_at', end);

    const usage = typeof count === 'number' ? count : 0;
    const origin = req.nextUrl?.origin || req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const base = origin ? origin.replace(/\/$/, '') : '';
    const link = `${base || ''}/?ref=${encodeURIComponent(code)}`;

    return NextResponse.json({
      ok: true,
      code,
      link,
      stats: {
        redemptionsThisMonth: usage,
        monthlyLimit: REFERRAL_MONTHLY_LIMIT,
        pendingCapReached: usage >= REFERRAL_MONTHLY_LIMIT,
      },
    });
  } catch (error) {
    console.error('Failed to fetch referral link:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ ok: false, error: 'Unable to fetch referral link.', details: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
