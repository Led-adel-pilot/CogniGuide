import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { createClient } from '@supabase/supabase-js';
import { FEATURE_REQUIRED_TIER, MODEL_CREDIT_MULTIPLIERS, type UserTier, isPaidTier } from '@/lib/plans';
import { ensureFreeCreditsWithTrial, determineUserTier } from '@/lib/server-user-tier';

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

const EXPLANATION_CREDIT_COST = 0.2;

// Reasoning effort control: if true, use default; if false/unset, use 'none' for faster responses
const ENABLE_REASONING = process.env.ENABLE_REASONING === 'true';

const userTierCache = new Map<string, { tier: UserTier; expiresAt: number }>();
const TIER_CACHE_TTL = 5 * 60 * 1000;

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
    const { tier } = await determineUserTier(supabaseAdmin, userId);
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
- Use simple language. Avoid jargon. If you use a unfamiliar term (unfamiliar to the assumed student field, not to the general population), define it in a simpler way.
- Your explanation should use the same outline and format as the provided answer (e.g., if the answer is a 3-point list, your explanation must also be a 3-point list).
- Dont use labels like 'Question:' or 'Explanation:'.
- Your explanation should be at maximum 2 times the length of the answer.
- Your explanation MUST BE in the SAME LANGUAGE as the provided flashcard.

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

type DeckExplanationEntry = {
  question: string;
  answer: string;
  explanation: string;
  updated_at?: string;
};

type DeckExplanationMap = Record<string, DeckExplanationEntry>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseExplanationMap(raw: unknown): DeckExplanationMap {
  if (!isRecord(raw)) {
    return {};
  }

  const entries: DeckExplanationMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const { question, answer, explanation, updated_at } = value as Record<string, unknown>;
    if (typeof question !== 'string' || typeof answer !== 'string' || typeof explanation !== 'string') continue;
    entries[key] = {
      question,
      answer,
      explanation,
      ...(typeof updated_at === 'string' ? { updated_at } : {}),
    };
  }

  return entries;
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({
      error: 'Credits unavailable',
      message: 'Credit service is not configured. Please try again later.',
      code: 'CREDITS_UNAVAILABLE',
    }, { status: 503 });
  }

  let payload: {
    question?: unknown;
    answer?: unknown;
    deckTitle?: unknown;
    deckId?: unknown;
    cardIndex?: unknown;
  };
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
  const deckIdRaw = typeof payload.deckId === 'string' ? payload.deckId.trim() : '';
  const cardIndexRaw = typeof payload.cardIndex === 'number'
    ? payload.cardIndex
    : typeof payload.cardIndex === 'string'
      ? Number.parseInt(payload.cardIndex, 10)
      : undefined;
  const deckId = deckIdRaw && deckIdRaw !== 'interleaved-session' ? deckIdRaw : undefined;
  const cardIndex = typeof cardIndexRaw === 'number' && Number.isInteger(cardIndexRaw) && cardIndexRaw >= 0
    ? cardIndexRaw
    : undefined;

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

  try {
    await ensureFreeCreditsWithTrial(supabaseAdmin, userId);
  } catch (err) {
    console.warn('Failed to ensure baseline credits for explanation:', err);
  }

  const userTier = await getUserTier(userId);
  const requiredTier = FEATURE_REQUIRED_TIER.explain;
  if (requiredTier === 'paid' && !isPaidTier(userTier)) {
    return NextResponse.json({
      error: 'Upgrade required',
      message: 'Flashcard explanations require a paid plan.',
      code: 'UPGRADE_REQUIRED',
    }, { status: 403 });
  }

  let deckContext: { id: string; explanations: DeckExplanationMap } | null = null;
  let cardIndexForPersistence: number | null = null;

  if (deckId && typeof cardIndex === 'number') {
    try {
      const { data: deckData, error: deckError } = await supabaseAdmin
        .from('flashcards')
        .select('id, user_id, explanations')
        .eq('id', deckId)
        .maybeSingle();

      if (deckError) {
        console.error('Failed to load deck for flashcard explanation:', deckError);
      } else if (deckData) {
        type DeckRow = { id: string; user_id: string; explanations: unknown };
        const typedDeck = deckData as DeckRow;

        if (typedDeck.user_id !== userId) {
          return NextResponse.json({
            error: 'Deck not found',
            message: 'Unable to locate the requested flashcard deck.',
            code: 'DECK_NOT_FOUND',
          }, { status: 404 });
        }

        const existingExplanations = parseExplanationMap(typedDeck.explanations);
        const existingEntry = existingExplanations[String(cardIndex)];
        if (
          existingEntry &&
          existingEntry.question === question &&
          existingEntry.answer === answer &&
          existingEntry.explanation.trim()
        ) {
          return new Response(existingEntry.explanation, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache',
              'X-Accel-Buffering': 'no',
            },
          });
        }

        deckContext = { id: typedDeck.id, explanations: existingExplanations };
        cardIndexForPersistence = cardIndex;
      }
    } catch (error) {
      console.error('Failed to check existing flashcard explanation:', error);
    }
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
      // @ts-expect-error - OpenAI types don't properly support reasoning_effort with stream options
      model: process.env.GEMINI_MODEL_FAST,
      reasoning_effort: 'medium',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      stream_options: { include_usage: false },
    });

    const encoder = new TextEncoder();
    let hasContent = false;
    let generatedText = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
            const delta = chunk?.choices?.[0]?.delta;
            const token = extractDeltaText(delta);
            if (token) {
              hasContent = true;
              generatedText += token;
              controller.enqueue(encoder.encode(token));
            }
          }

          if (!hasContent) {
            controller.error(new Error('No explanation returned'));
          } else {
            if (
              deckContext &&
              typeof cardIndexForPersistence === 'number' &&
              generatedText.trim()
            ) {
              const explanationEntry: DeckExplanationEntry = {
                question,
                answer,
                explanation: generatedText,
                updated_at: new Date().toISOString(),
              };
              const nextExplanations: DeckExplanationMap = {
                ...deckContext.explanations,
                [String(cardIndexForPersistence)]: explanationEntry,
              };
              try {
                const { error: persistError } = await supabaseAdmin
                  .from('flashcards')
                  .update({ explanations: nextExplanations })
                  .eq('id', deckContext.id)
                  .eq('user_id', userId);
                if (persistError) {
                  console.error('Failed to persist flashcard explanation:', persistError);
                } else {
                  deckContext = { ...deckContext, explanations: nextExplanations };
                }
              } catch (persistError) {
                console.error('Unexpected error while saving flashcard explanation:', persistError);
              }
            }
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
