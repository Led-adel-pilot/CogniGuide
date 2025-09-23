import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const REFERRAL_MONTHLY_LIMIT = 3;
const REFERRAL_REWARD_CREDITS = 30;

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

function sanitizeCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[A-Za-z0-9_-]{6,}$/u.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: 'Referral program is not configured.' }, { status: 500 });
  }

  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const codeInput = typeof body?.code === 'string' ? body.code : '';
    const code = sanitizeCode(codeInput);
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Invalid referral code.' }, { status: 400 });
    }

    const { data: referral, error: referralError } = await supabaseAdmin
      .from('referral_codes')
      .select('code, user_id')
      .eq('code', code)
      .maybeSingle();

    if (referralError || !referral) {
      return NextResponse.json({ ok: false, error: 'Referral code not found.' }, { status: 404 });
    }

    const referrerId = (referral as { user_id: string }).user_id;
    if (referrerId === userId) {
      return NextResponse.json({ ok: false, error: 'You cannot redeem your own referral code.' }, { status: 400 });
    }

    const existing = await supabaseAdmin
      .from('referral_redemptions')
      .select('id')
      .eq('referred_user_id', userId)
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json({ ok: false, error: 'Referral already redeemed for this account.' }, { status: 409 });
    }

    const { start, end } = getUtcMonthRange(new Date());
    const { count } = await supabaseAdmin
      .from('referral_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .gte('created_at', start)
      .lt('created_at', end);

    const usage = typeof count === 'number' ? count : 0;
    if (usage >= REFERRAL_MONTHLY_LIMIT) {
      return NextResponse.json({ ok: false, error: 'This referral code has reached its monthly limit.' }, { status: 409 });
    }

    const { data: redemption, error: redemptionError } = await supabaseAdmin
      .from('referral_redemptions')
      .insert({
        referrer_id: referrerId,
        referral_code: referral.code,
        referred_user_id: userId,
        reward_credits: REFERRAL_REWARD_CREDITS,
      })
      .select('id')
      .single();

    if (redemptionError) {
      if (redemptionError.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Referral already redeemed for this account.' }, { status: 409 });
      }
      throw redemptionError;
    }

    const { data: referrerCreditsResult, error: referrerCreditError } = await supabaseAdmin.rpc('increment_user_credits', {
      p_user_id: referrerId,
      p_amount: REFERRAL_REWARD_CREDITS,
    });

    if (referrerCreditError) {
      console.error('Failed to increment referral credits, rolling back redemption:', referrerCreditError);
      await supabaseAdmin.from('referral_redemptions').delete().eq('id', redemption?.id);
      return NextResponse.json({ ok: false, error: 'Unable to complete referral credit grant.' }, { status: 500 });
    }

    const { data: redeemerCreditsResult, error: redeemerCreditError } = await supabaseAdmin.rpc('increment_user_credits', {
      p_user_id: userId,
      p_amount: REFERRAL_REWARD_CREDITS,
    });

    if (redeemerCreditError) {
      console.error('Failed to increment redeemer credits, rolling back referral redemption:', redeemerCreditError);
      await supabaseAdmin.from('referral_redemptions').delete().eq('id', redemption?.id);
      try {
        await supabaseAdmin.rpc('increment_user_credits', { p_user_id: referrerId, p_amount: -REFERRAL_REWARD_CREDITS });
      } catch (rollbackError) {
        console.error('Failed to roll back referrer credits after redeemer credit failure:', rollbackError);
      }
      return NextResponse.json({ ok: false, error: 'Unable to complete referral credit grant.' }, { status: 500 });
    }

    const updatedUsage = usage + 1;
    const referrerCreditsValue = typeof referrerCreditsResult === 'number'
      ? referrerCreditsResult
      : Number(referrerCreditsResult ?? 0);
    const redeemerCreditsValue = typeof redeemerCreditsResult === 'number'
      ? redeemerCreditsResult
      : Number(redeemerCreditsResult ?? 0);

    return NextResponse.json({
      ok: true,
      reward: REFERRAL_REWARD_CREDITS,
      referrerId,
      referrerCredits: Number.isFinite(referrerCreditsValue) ? referrerCreditsValue : undefined,
      redeemerId: userId,
      redeemerReward: REFERRAL_REWARD_CREDITS,
      redeemerCredits: Number.isFinite(redeemerCreditsValue) ? redeemerCreditsValue : undefined,
      stats: {
        redemptionsThisMonth: updatedUsage,
        monthlyLimit: REFERRAL_MONTHLY_LIMIT,
      },
    });
  } catch (error) {
    console.error('Failed to redeem referral code:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ ok: false, error: 'Unable to redeem referral code.', details: message }, { status: 500 });
  }
}
