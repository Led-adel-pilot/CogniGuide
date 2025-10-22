import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { createClient } from '@supabase/supabase-js';
import { MODEL_CREDIT_MULTIPLIERS, MODEL_REQUIRED_TIER } from '@/lib/plans';

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  timeout: 5 * 60 * 1000,
  maxRetries: 0,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const FAST_MODEL = process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash-lite';
const EXPLANATION_CREDIT_COST = 0.1;

type UserTier = 'non-auth' | 'free' | 'paid';

const userTierCache = new Map<string, { tier: UserTier; expiresAt: number }>();
const TIER_CACHE_TTL = 5 * 60 * 1000;

async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  type SubscriptionRow = { status: string | null };
  const subscription = Array.isArray(data) && data.length > 0 ? (data[0] as SubscriptionRow) : null;
  const status = subscription?.status ?? null;
  return status === 'active' || status === 'trialing';
}

async function ensureFreeMonthlyCredits(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const active = await hasActiveSubscription(userId);
    if (active) return;
  } catch {}
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits, last_refilled_at')
    .eq('user_id', userId)
    .single();
  const nowIso = new Date().toISOString();
  if (!data) {
    await supabaseAdmin.from('user_credits').insert({ user_id: userId, credits: 8, last_refilled_at: nowIso });
    return;
  }
  type UserCreditsRow = { credits: number | null; last_refilled_at: string | null };
  const userCredits = data as UserCreditsRow;
  const last = userCredits.last_refilled_at ? new Date(userCredits.last_refilled_at) : null;
  const now = new Date(nowIso);
  const sameMonth = last && last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth();
  if (!sameMonth) {
    await supabaseAdmin
      .from('user_credits')
      .update({ credits: 8, last_refilled_at: nowIso, updated_at: nowIso })
      .eq('user_id', userId);
  }
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

async function getUserTier(userId: string | null): Promise<UserTier> {
  if (!userId) return 'non-auth';
  if (!supabaseAdmin) return 'free';

  const cached = userTierCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tier;
  }

  try {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);
    type SubscriptionRow = { status: string | null };
    const subscription = Array.isArray(data) && data.length > 0 ? (data[0] as SubscriptionRow) : null;
    const status = subscription?.status ?? null;
    const tier: UserTier = status === 'active' || status === 'trialing' ? 'paid' : 'free';

    userTierCache.set(userId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL });

    return tier;
  } catch {
    return 'free';
  }
}

async function getCurrentCredits(userId: string): Promise<number | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();
  return data?.credits ?? null;
}

async function deductCredits(userId: string, amount: number): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const current = await getCurrentCredits(userId);
  if (current === null || current < amount) return false;
  const { error } = await supabaseAdmin
    .from('user_credits')
    .update({ credits: current - amount, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  return !error;
}

async function refundCredits(userId: string, amount: number): Promise<void> {
  if (!supabaseAdmin) return;
  const current = await getCurrentCredits(userId);
  if (current === null) return;
  await supabaseAdmin
    .from('user_credits')
    .update({ credits: current + amount, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

function buildExplanationPrompt(question: string, answer: string, deckTitle?: string): string {
  const contextLine = deckTitle ? `\n\nDeck context: This flashcard is from the "${deckTitle}" study deck.` : '';
  return `You are helping a student understand their flashcards.
Explain the following flashcard concisely so the learner grasps why the answer is correct.
- For complex words write next to them between () a simpler synonyme or a short explanation.
- Use simple language. Avoid jargon. If you must use a technical term, you're forced to define it in the simplest way possible.
- Start by refactoring the question in bold, then follow with the explanation.
- Your explanation must use the same outline and format as the provided answer (e.g., if the answer is a 3-point list, your explanation must also be a 3-point list).
- Dont use labels like 'Question:' or 'Explanation:'.
- You explanation should be at maximum 2 times the length of the answer.
- Your explanation MUST be in the SAME language as the question and answer.

${contextLine}
Question: ${question}
Answer: ${answer}`;
}

function extractDeltaText(delta: ChatCompletionChunk.Choice['delta'] | undefined): string {
  if (!delta) return '';
  const raw = delta.content as unknown;
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  if (raw && typeof raw === 'object' && 'text' in raw && typeof (raw as { text?: unknown }).text === 'string') {
    return (raw as { text: string }).text;
  }
  return '';
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({
      error: 'Credits unavailable',
      message: 'Credit service is not configured. Please try again later.',
      code: 'CREDITS_UNAVAILABLE',
    }, { status: 503 });
  }

  let payload: { question?: unknown; answer?: unknown; deckTitle?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({
      error: 'Invalid JSON',
      message: 'Request body must be valid JSON.',
      code: 'INVALID_JSON',
    }, { status: 400 });
  }

  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
  const deckTitle = typeof payload.deckTitle === 'string' ? payload.deckTitle.trim() : undefined;

  if (!question || !answer) {
    return NextResponse.json({
      error: 'Missing flashcard content',
      message: 'Both question and answer are required to generate an explanation.',
      code: 'MISSING_CONTENT',
    }, { status: 400 });
  }

  const userId = await getUserIdFromAuthHeader(req);
  if (!userId) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Sign in to generate flashcard explanations.',
      code: 'AUTH_REQUIRED',
    }, { status: 401 });
  }

  const userTier = await getUserTier(userId);
  const requiredTier = MODEL_REQUIRED_TIER.fast as 'free' | 'paid';
  if (requiredTier === 'paid' && userTier !== 'paid') {
    return NextResponse.json({
      error: 'Upgrade required',
      message: 'Flashcard explanations require a paid plan.',
      code: 'UPGRADE_REQUIRED',
    }, { status: 403 });
  }

  try {
    await ensureFreeMonthlyCredits(userId);
  } catch (err) {
    console.warn('Failed to ensure free monthly credits for explanation:', err);
  }

  const multiplier = MODEL_CREDIT_MULTIPLIERS.fast ?? 1;
  const creditsNeeded = Number((EXPLANATION_CREDIT_COST * multiplier).toFixed(3));

  const currentCredits = await getCurrentCredits(userId);
  if (currentCredits === null) {
    return NextResponse.json({
      error: 'Credits service unavailable',
      message: 'Unable to check your credit balance. Please try again later.',
      code: 'CREDITS_SERVICE_ERROR',
    }, { status: 503 });
  }

  if (currentCredits < creditsNeeded) {
    return NextResponse.json({
      error: 'Insufficient credits',
      message: `You need ${creditsNeeded.toFixed(1)} credits but only have ${currentCredits.toFixed(1)} remaining.`,
      code: 'INSUFFICIENT_CREDITS',
      creditsNeeded,
      creditsAvailable: currentCredits,
    }, { status: 402 });
  }

  const deducted = await deductCredits(userId, creditsNeeded);
  if (!deducted) {
    return NextResponse.json({
      error: 'Credit deduction failed',
      message: 'We could not deduct credits from your account. Please try again.',
      code: 'CREDIT_DEDUCTION_ERROR',
    }, { status: 500 });
  }

  const prompt = buildExplanationPrompt(question, answer, deckTitle);

  try {
    const stream = await openai.chat.completions.create({
      model: FAST_MODEL,
      // @ts-ignore
      reasoning_effort: 'none',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      stream_options: { include_usage: false },
    });

    const encoder = new TextEncoder();
    let hasContent = false;

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
            const delta = chunk?.choices?.[0]?.delta;
            const token = extractDeltaText(delta);
            if (token) {
              hasContent = true;
              controller.enqueue(encoder.encode(token));
            }
          }
          
          if (!hasContent) {
            controller.error(new Error('No explanation returned'));
          } else {
            controller.close();
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          // Refund credits on streaming error
          await refundCredits(userId, creditsNeeded).catch((refundErr) => {
            console.error('Failed to refund credits after streaming error:', refundErr);
          });
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Explain flashcard LLM error:', error);
    await refundCredits(userId, creditsNeeded).catch((refundErr) => {
      console.error('Failed to refund credits after explanation error:', refundErr);
    });

    if (error instanceof Error) {
      if (error.message.includes('429')) {
        return NextResponse.json({
          error: 'Service busy',
          message: 'The explanation service is currently busy. Please try again in a moment.',
          code: 'RATE_LIMITED',
        }, { status: 429 });
      }
      if (error.message.includes('401')) {
        return NextResponse.json({
          error: 'AI authentication failed',
          message: 'Unable to authenticate with the AI service.',
          code: 'AI_AUTH_ERROR',
        }, { status: 503 });
      }
      if (error.message.includes('413')) {
        return NextResponse.json({
          error: 'Request too large',
          message: 'Flashcard content is too large to explain.',
          code: 'REQUEST_TOO_LARGE',
        }, { status: 413 });
      }
    }

    return NextResponse.json({
      error: 'Explanation failed',
      message: 'Could not generate an explanation. Please try again.',
      code: 'EXPLANATION_ERROR',
    }, { status: 502 });
  }
}
