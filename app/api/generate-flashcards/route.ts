import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { Buffer } from 'node:buffer';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx, getTextFromPlainText, processMultipleFiles } from '@/lib/document-parser';
import { MODEL_CREDIT_MULTIPLIERS, MODEL_REQUIRED_TIER, type ModelChoice } from '@/lib/plans';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  timeout: 5 * 60 * 1000, // 5 minutes timeout for slow models
  maxRetries: 0, // Disable retries for streaming
});

// --- Supabase Server Client & Credit Helpers ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const SUPABASE_IMAGE_PREFIX = 'supabase://';

async function resolveImageInputs(rawImages: string[]): Promise<{ resolved: string[]; cleanupPaths: string[] }> {
  const resolved: string[] = [];
  const cleanupPaths = new Set<string>();

  for (const raw of rawImages) {
    if (typeof raw !== 'string' || raw.trim() === '') continue;

    if (raw.startsWith('data:')) {
      resolved.push(raw);
      continue;
    }

    if (raw.startsWith(SUPABASE_IMAGE_PREFIX)) {
      if (!supabaseAdmin) {
        console.warn('Supabase client unavailable to resolve image reference');
        continue;
      }
      const withoutPrefix = raw.slice(SUPABASE_IMAGE_PREFIX.length);
      const pipeIndex = withoutPrefix.lastIndexOf('|');
      let bucketAndPath = withoutPrefix;
      let mimeType = 'image/png';
      if (pipeIndex !== -1) {
        bucketAndPath = withoutPrefix.slice(0, pipeIndex);
        const encodedMime = withoutPrefix.slice(pipeIndex + 1);
        try {
          const decoded = decodeURIComponent(encodedMime);
          if (decoded) mimeType = decoded;
        } catch {}
      }
      const firstSlash = bucketAndPath.indexOf('/');
      if (firstSlash === -1) {
        console.warn('Invalid supabase image reference (missing path):', raw);
        continue;
      }
      const bucket = bucketAndPath.slice(0, firstSlash);
      const path = bucketAndPath.slice(firstSlash + 1);
      try {
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) {
          console.error('Failed to download image from Supabase:', path, error);
          continue;
        }
        let buffer: Buffer;
        if (Buffer.isBuffer(data)) {
          buffer = data;
        } else if (data instanceof ArrayBuffer) {
          buffer = Buffer.from(data);
        } else if (data instanceof Blob) {
          buffer = Buffer.from(await data.arrayBuffer());
        } else if (typeof (data as any).arrayBuffer === 'function') {
          buffer = Buffer.from(await (data as any).arrayBuffer());
        } else {
          buffer = Buffer.from(data as any);
        }
        const base64 = buffer.toString('base64');
        resolved.push(`data:${mimeType};base64,${base64}`);
        if (bucket === 'uploads' && path) {
          cleanupPaths.add(path);
        }
      } catch (err) {
        console.error('Error resolving Supabase image reference:', err);
      }
      continue;
    }

    resolved.push(raw);
  }

  return { resolved, cleanupPaths: Array.from(cleanupPaths) };
}

// In-memory cache for user tiers (userId -> { tier, expiresAt })
const userTierCache = new Map<string, { tier: 'free' | 'paid'; expiresAt: number }>();
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
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

async function ensureFreeMonthlyCredits(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  // Paid plans are provisioned via webhook; skip free refill when active
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
  const last = (data as any).last_refilled_at ? new Date((data as any).last_refilled_at) : null;
  const now = new Date(nowIso);
  if (!last || !isSameUtcMonth(last, now)) {
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

async function getUserTier(userId: string | null): Promise<'non-auth' | 'free' | 'paid'> {
  if (!userId) return 'non-auth';
  if (!supabaseAdmin) return 'free'; // Default to free if we can't check

  // Check cache first
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

    const status = Array.isArray(data) && data.length > 0 ? (data[0] as any).status : null;
    const tier = status === 'active' || status === 'trialing' ? 'paid' : 'free';

    // Cache the result
    userTierCache.set(userId, {
      tier,
      expiresAt: Date.now() + TIER_CACHE_TTL
    });

    return tier;
  } catch {
    return 'free'; // Default to free on error
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
    .update({ credits: (current - amount), updated_at: new Date().toISOString() })
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

interface Flashcard {
  question: string;
  answer: string;
}

function buildFlashcardPrompt(opts: {
  mode: 'stream' | 'json';
  sourceContent: string;
  userInstruction?: string;
  imagesCount?: number;
  numCards?: number;
}): string {
  const { mode, sourceContent, userInstruction, imagesCount } = opts;
  const userLine = userInstruction ? `\nAdditional user instruction: ${userInstruction}` : '';
  const imagesNote = imagesCount && imagesCount > 0
    ? `You are also provided ${imagesCount} image(s). Carefully read text inside the images (OCR) and analyze diagrams to extract key concepts.`
    : '';

  const outputFormat = mode === 'stream'
    ? `STREAMING OUTPUT FORMAT (STRICT):
- Emit your response as newline-delimited JSON (NDJSON), one JSON object per line.
- Do NOT wrap in an array, do NOT include any text outside the JSON objects, and do NOT use code fences.
- Use exactly these object shapes (one per line):
  { "type": "meta", "title": string }
  { "type": "card", "question": string, "answer": string }
  { "type": "done" }
- Start with a single meta line, then stream each card as its own line, and end with a single done line.
- Keep each JSON object on ONE LINE. Escape any internal newlines as \n within strings.`
    : `OUTPUT FORMAT (STRICT):
- Output strictly as a single JSON object only. No preface, no code fences, no commentary.
- JSON schema:
  { "title": string, "cards": [ { "question": string, "answer": string } ] }`;

  const scopeLine = `You will be given source content. Generate high-quality active-recall flashcards that help a learner master the content.`;

  const languageAndCount = `- Produce about 20 to 100 cards depending on content size.
- The flashcards MUST be in the same language as the source content.`;

  const body = `You are an expert instructional designer.
${scopeLine}${userLine}

${outputFormat}

### Card Creation Principles
1.  **Promote Active Recall:** Questions must be open-ended to force the learner to retrieve information from memory.
    - GOOD: "What are the three core principles of spaced repetition?"
    - BAD: "Are there three core principles of spaced repetition?"

2.  **Ensure Atomicity:** Each card must focus on ONE SINGLE, ISOLATED CONCEPT. DO NOT combine multiple questions or answers on a single card.
    - GOOD: Q: "What is the primary benefit of active recall?" A: "It strengthens neural pathways, improving long-term memory."
    - BAD: Q: "What are active recall and spaced repetition?" A: "Active recall is... and spaced repetition is..."

3.  **Foster Deeper Understanding:** Go beyond simple definitions. Create questions that prompt for explanations, comparisons, or the "why" behind a concept.

- Keep them simple: One concept per card. Avoid cramming multiple facts onto a single flashcard.
- Be specific: Vague questions produce vague answers. Instead of "What is photosynthesis?" try "What are the three main stages of photosynthesis and where does each occur?"
- Include context: Sometimes a trigger word or phrase helps jog your memory. Adding brief context to your questions can make recall easier and more meaningful.

${languageAndCount}
${imagesNote ? `- ${imagesNote}` : ''}

Source content:\n---\n${sourceContent}\n---`;

  return body;
}

// Attempt to extract a JSON object from a possibly-noisy string
function extractJsonObject(text: string): any {
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error('Model response was not valid JSON');
}

function stripMarkdownCodeFences(text: string): string {
  let result = text.trim();
  const leadingFence = /^```(?:json)?\s*/i;
  const trailingFence = /\s*```$/;

  while (leadingFence.test(result)) {
    result = result.replace(leadingFence, '').trimStart();
  }

  while (trailingFence.test(result)) {
    result = result.replace(trailingFence, '').trimEnd();
  }

  return result;
}

const MODEL_NAMES: Record<ModelChoice, string> = {
  fast: process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash-lite',
  smart: process.env.GEMINI_MODEL_SMART || 'gemini-2.5-flash',
};

function normalizeModelChoice(model?: unknown): ModelChoice | null {
  if (typeof model !== 'string' || model.trim() === '') return 'fast';
  const lowered = model.trim().toLowerCase();
  if (lowered === 'fast' || lowered === 'smart') return lowered;
  return null;
}

type DeltaLike = ChatCompletionChunk.Choice['delta'] | { content?: unknown; reasoning?: unknown } | undefined;

function extractDeltaText(delta: DeltaLike): string {
  if (!delta) return '';
  const rawContent = delta.content as unknown;
  if (typeof rawContent === 'string') {
    return rawContent;
  }
  if (rawContent == null) {
    return '';
  }
  if (Array.isArray(rawContent)) {
    return rawContent
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
  }
  if (typeof rawContent === 'object' && 'text' in rawContent && typeof (rawContent as { text?: unknown }).text === 'string') {
    return (rawContent as { text: string }).text;
  }
  return '';
}

// Simple, consistent logging of model input
function logLlmInput(kind: string, prompt: string, modelChoice?: ModelChoice) {
  console.log(`=== ${kind} ===`);
  console.log('Character count:', prompt.length);
  console.log('Text content preview:', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''));
  if (modelChoice) {
    console.log('Model:', MODEL_NAMES[modelChoice]);
  }
  console.log('==============================');
}

// Shared non-streaming completion + JSON parsing
async function generateJsonFromModel(userContent: any, modelChoice: ModelChoice): Promise<{ title: string | null; cards: Flashcard[] }> {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: MODEL_NAMES[modelChoice],
      // @ts-ignore
      //reasoning_effort: 'none',
      messages: [{ role: 'user', content: userContent }],
      stream: false,
      // @ts-ignore
      response_format: { type: 'json_object' },
    });
  } catch (apiError) {
    console.error('OpenAI API error in generateJsonFromModel:', apiError);

    if (apiError instanceof Error) {
      // Handle specific OpenAI errors
      if (apiError.message.includes('429') || apiError.message.includes('rate limit')) {
        throw new Error('Service temporarily busy - rate limit exceeded');
      }

      if (apiError.message.includes('401') || apiError.message.includes('unauthorized')) {
        throw new Error('AI service authentication failed');
      }

      if (apiError.message.includes('400') || apiError.message.includes('bad request')) {
        throw new Error('Invalid request format for AI service');
      }

      if (apiError.message.includes('413') || apiError.message.includes('payload too large')) {
        throw new Error('Content too large for AI service processing');
      }

      if (apiError.message.includes('500') || apiError.message.includes('502') || apiError.message.includes('503')) {
        throw new Error('AI service temporarily unavailable');
      }

      if (apiError.message.includes('content') && apiError.message.includes('policy')) {
        throw new Error('Content violates AI service usage policy');
      }
    }

    // Generic API error
    throw new Error('Failed to communicate with AI service');
  }

  const content = completion.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('No content returned from model');
  const parsed = extractJsonObject(content);
  const cards: Flashcard[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
  if (cards.length === 0) throw new Error('Failed to generate flashcards');
  return { title: parsed.title || null, cards };
}

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const streamParam = url.searchParams.get('stream');
    const shouldStream = streamParam === '1' || streamParam === 'true';

    const contentType = req.headers.get('content-type') || '';

    // Helper to stream NDJSON lines from a prompt, with optional credit refund on total failure
    const streamNdjson = async (
      promptContent: any,
      modelChoice: ModelChoice,
      refundInfo?: { userId: string; credits: number },
      images?: string[],
      extraCleanupPaths: string[] = [],
    ) => {
      const encoder = new TextEncoder();
      const streamStartedAt = Date.now();
      let stream: AsyncIterable<ChatCompletionChunk>;
      try {
        stream = await openai.chat.completions.create({
          model: MODEL_NAMES[modelChoice],
          // @ts-ignore
          //reasoning_effort: 'none', // Reduce thinking time for faster responses
          messages: [{ role: 'user', content: promptContent }],
          stream: true,
          stream_options: { include_usage: false }, // Reduce overhead
        });
        console.log('[Flashcards] Opened streaming completion', {
          model: MODEL_NAMES[modelChoice],
          hasImages: Array.isArray(images) && images.length > 0,
          requestedMode: 'stream',
        });
      } catch (apiError) {
        console.error('OpenAI API error in streamNdjson:', apiError);

        // Refund credits if API call fails
        if (refundInfo && refundInfo.credits > 0) {
          try {
            await refundCredits(refundInfo.userId, refundInfo.credits);
          } catch (refundError) {
            console.error('Failed to refund credits:', refundError);
          }
        }

        if (apiError instanceof Error) {
          // Handle specific OpenAI errors
          if (apiError.message.includes('429') || apiError.message.includes('rate limit')) {
            throw new Error('Service temporarily busy - rate limit exceeded');
          }

          if (apiError.message.includes('401') || apiError.message.includes('unauthorized')) {
            throw new Error('AI service authentication failed');
          }

          if (apiError.message.includes('400') || apiError.message.includes('bad request')) {
            throw new Error('Invalid request format for AI service');
          }

          if (apiError.message.includes('413') || apiError.message.includes('payload too large')) {
            throw new Error('Content too large for AI service processing');
          }

          if (apiError.message.includes('500') || apiError.message.includes('502') || apiError.message.includes('503')) {
            throw new Error('AI service temporarily unavailable');
          }

          if (apiError.message.includes('content') && apiError.message.includes('policy')) {
            throw new Error('Content violates AI service usage policy');
          }
        }

        // Generic API error
        throw new Error('Failed to communicate with AI service');
      }

      let anyCardSent = false;
      let buffer = '';
      let pendingLine: string | null = null;
      let lastHeartbeat = Date.now();
      const HEARTBEAT_INTERVAL = 30000; // 30 seconds
      let totalChunks = 0;
      let totalChars = 0;
      let jsonObjectsEmitted = 0;
      let metaObjects = 0;
      let doneObjects = 0;
      let parseRetries = 0;
      let firstTokenAt: number | null = null;

      // Extract file paths from images for cleanup (only for signed URLs, not base64 data URLs)
      const cleanupSet = new Set<string>(extraCleanupPaths);
      if (images && images.length > 0) {
        images.forEach((url: string) => {
          if (typeof url === 'string' && url.includes('supabase') && url.includes('/uploads/') && !url.startsWith('data:')) {
            try {
              const urlObj = new URL(url);
              // Handle both signed URLs (/sign/) and public URLs (/public/)
              let path = urlObj.pathname.split('/storage/v1/object/sign/uploads/')[1] ||
                        urlObj.pathname.split('/storage/v1/object/public/uploads/')[1];
              if (path) {
                // Remove query parameters from signed URLs
                path = path.split('?')[0];
                cleanupSet.add(path);
              }
            } catch {}
          }
        });
      }
      const filesToCleanup = Array.from(cleanupSet);

      const processBufferFactory = (controller: ReadableStreamDefaultController<Uint8Array>) => {
        const emitJson = (raw: string): boolean => {
          const trimmed = raw.trim();
          if (!trimmed) return false;

          const sanitized = stripMarkdownCodeFences(trimmed);

          const parseCandidate = (candidate: string): any | null => {
            try {
              return JSON.parse(candidate);
            } catch {
              return null;
            }
          };

          const parsed = parseCandidate(trimmed) ?? (sanitized !== trimmed ? parseCandidate(sanitized) : null);

          if (!parsed) {
            parseRetries += 1;
            return false;
          }

          try {
            const line = JSON.stringify(parsed);
            controller.enqueue(encoder.encode(line + '\n'));
            jsonObjectsEmitted += 1;
            if (parsed && parsed.type === 'card') {
              if (!anyCardSent) {
                console.log('First card received from model');
              }
              anyCardSent = true;
              console.log('[Flashcards] Emitted card', {
                questionPreview: typeof parsed.question === 'string' ? parsed.question.slice(0, 80) : undefined,
                answerPreview: typeof parsed.answer === 'string' ? parsed.answer.slice(0, 80) : undefined,
                cardsStreamed: jsonObjectsEmitted,
              });
            }
            if (parsed && parsed.type === 'done') {
              console.log('Stream completed successfully');
              doneObjects += 1;
            }
            if (parsed && parsed.type === 'meta') {
              metaObjects += 1;
              console.log('[Flashcards] Meta received', {
                title: typeof parsed.title === 'string' ? parsed.title : undefined,
              });
            }
            lastHeartbeat = Date.now();
            return true;
          } catch (enqueueError) {
            console.error('[Flashcards] Failed to enqueue JSON line', enqueueError);
            parseRetries += 1;
            return false;
          }
        };

        const extractBalancedJson = (text: string): { json: string; rest: string } | null => {
          let start = -1;
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          for (let idx = 0; idx < text.length; idx++) {
            const char = text[idx];
            if (start === -1) {
              if (/\s/.test(char)) {
                continue;
              }
              if (char === '{') {
                start = idx;
                depth = 1;
                continue;
              }
              return null;
            }

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '"') {
              if (inString) {
                inString = false;
              } else {
                inString = true;
              }
              continue;
            }

            if (inString) {
              if (char === '\\') {
                escapeNext = true;
              }
              continue;
            }

            if (char === '{') {
              depth++;
              continue;
            }

            if (char === '}') {
              depth--;
              if (depth === 0) {
                const json = text.slice(start, idx + 1);
                const rest = text.slice(idx + 1);
                return { json, rest };
              }
            }
          }
          return null;
        };

        const processPending = (isFinal: boolean) => {
          while (true) {
            const combined = (pendingLine ?? '') + buffer;
            if (!combined) {
              return;
            }

            const balanced = extractBalancedJson(combined);
            if (balanced) {
              pendingLine = null;
              buffer = balanced.rest;
              if (!emitJson(balanced.json)) {
                // If parsing somehow fails here, stash the raw text and wait for more tokens
                pendingLine = balanced.json + buffer;
                buffer = '';
                return;
              }
              // Continue looping in case multiple objects were buffered without newlines
              continue;
            }

            if (isFinal) {
              const trimmed = combined.trim();
              if (!trimmed) {
                pendingLine = null;
                buffer = '';
                return;
              }

              const withoutFences = stripMarkdownCodeFences(trimmed);

              if (withoutFences !== trimmed) {
                let remaining = withoutFences;
                let emittedAny = false;

                while (true) {
                  const balanced = extractBalancedJson(remaining);
                  if (!balanced) {
                    break;
                  }

                  remaining = balanced.rest;
                  emittedAny = true;

                  if (!emitJson(balanced.json)) {
                    pendingLine = balanced.json + remaining;
                    buffer = '';
                    return;
                  }

                  if (!remaining.trim()) {
                    pendingLine = null;
                    buffer = '';
                    return;
                  }
                }

                if (emittedAny) {
                  pendingLine = remaining.trim() ? remaining : null;
                  buffer = '';
                  if (!pendingLine) {
                    return;
                  }
                }
              }

              const finalCandidate = withoutFences !== trimmed ? withoutFences : trimmed;

              if (!emitJson(finalCandidate)) {
                console.error('[Flashcards] Failed to parse final JSON chunk', {
                  snippet: finalCandidate.slice(0, 200),
                });
                throw new Error('Invalid JSON in final chunk');
              }
              pendingLine = null;
              buffer = '';
            }
            return;
          }
        };

        const processBuffer = (isFinal = false) => {
          let newlineIndex = buffer.indexOf('\n');
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf('\n');
            const candidate = (pendingLine ?? '') + line;
            pendingLine = null;
            if (!emitJson(candidate)) {
              pendingLine = candidate;
            }
          }

          processPending(isFinal);
        };

        return processBuffer;
      };

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          const processBuffer = processBufferFactory(controller);
          try {
            // Emit an immediate meta line so the client can render instantly
            try {
              const earlyMeta = JSON.stringify({ type: 'meta', title: 'flashcards' }) + '\n';
              controller.enqueue(encoder.encode(earlyMeta));
              console.log('Stream started, sent meta line');
              metaObjects += 1;
            } catch {}
            for await (const chunk of stream) {
              const now = Date.now();
              const delta = chunk?.choices?.[0]?.delta;
              const token = extractDeltaText(delta);
              totalChunks += 1;
              const deltaReasoning = delta && typeof (delta as { reasoning?: unknown }).reasoning === 'string';
              if (deltaReasoning) {
                console.log('[Flashcards] Streaming reasoning token received');
              }
              if (!token) {
                continue;
              }
              if (!firstTokenAt) {
                firstTokenAt = now;
                console.log('[Flashcards] First token received', {
                  delayMs: now - streamStartedAt,
                });
              }
              buffer += token;
              totalChars += token.length;

              // Send heartbeat if it's been too long since last activity
              if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
                try {
                  const heartbeat = JSON.stringify({ type: 'heartbeat', timestamp: now }) + '\n';
                  controller.enqueue(encoder.encode(heartbeat));
                  lastHeartbeat = now;
                } catch {}
              }

              try {
                processBuffer();
              } catch (processingError) {
                console.error('[Flashcards] Error while processing buffer', {
                  bufferedChars: buffer.length,
                  pendingLength: pendingLine?.length ?? 0,
                  parseAttempts: parseRetries,
                });
                throw processingError;
              }
            }
            processBuffer(true);
            controller.close();
            console.log('[Flashcards] Stream finished', {
              anyCardSent,
              totalChunks,
              totalChars,
              jsonObjectsEmitted,
              metaObjects,
              doneObjects,
              parseRetries,
              durationMs: Date.now() - streamStartedAt,
            });

            // Cleanup files after successful streaming
            if (filesToCleanup.length > 0 && anyCardSent) {
              try {
                await fetch(new URL('/api/storage/cleanup', req.url), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paths: filesToCleanup }),
                });
              } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
              }
            }
          } catch (err) {
            console.error('Streaming error:', err);
            console.error('[Flashcards] Streaming summary at error', {
              anyCardSent,
              totalChunks,
              totalChars,
              jsonObjectsEmitted,
              metaObjects,
              doneObjects,
              parseRetries,
              firstTokenDelayMs: firstTokenAt ? firstTokenAt - streamStartedAt : null,
            });

            if (!anyCardSent) {
              // If no cards were sent, refund credits and return error response
              if (refundInfo && refundInfo.credits > 0) {
                try {
                  await refundCredits(refundInfo.userId, refundInfo.credits);
                  console.log(`Refunded ${refundInfo.credits} credits due to streaming failure`);
                } catch (refundError) {
                  console.error('Failed to refund credits:', refundError);
                }
              }

              // For streaming errors before any content is sent, we need to handle this differently
              // since we can't use controller.error() with a Response object
              try { controller.close(); } catch {}

              // The error will be handled by the outer catch block
              throw err;
            } else {
              // If some cards were sent, just close the stream gracefully
              try { controller.close(); } catch {}
            }
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    };

    if (contentType.includes('application/json')) {
      // JSON path: supports { text, images?, prompt?, numCards? }
      let body: { numCards?: number; text?: string; images?: string[]; prompt?: string; rawCharCount?: number; model?: string } | null = null;

      try {
        body = await req.json() as { numCards?: number; text?: string; images?: string[]; prompt?: string; rawCharCount?: number; model?: string } | null;
      } catch (jsonError) {
        return NextResponse.json({
          error: 'Invalid JSON',
          message: 'The request body contains invalid JSON. Please check your request format.',
          code: 'INVALID_JSON'
        }, { status: 400 });
      }

      if (!body) {
        return NextResponse.json({
          error: 'Empty request body',
          message: 'The request body is empty. Please provide text, images, or a prompt.',
          code: 'EMPTY_REQUEST'
        }, { status: 400 });
      }

      const hasTextPayload = (typeof body.text === 'string' && body.text.trim().length > 0) || (Array.isArray(body.images) && body.images.length > 0) || (typeof body.prompt === 'string' && body.prompt.trim().length > 0);

      if (!hasTextPayload) {
        return NextResponse.json({
          error: 'No content provided',
          message: 'Please provide text, images, or prompt content to process.',
          code: 'NO_CONTENT'
        }, { status: 400 });
      }

      const modelChoice = normalizeModelChoice((body as any)?.model);
      if (!modelChoice) {
        return NextResponse.json({
          error: 'Invalid model selected',
          message: 'The requested model is not supported. Please choose either the fast or smart mode.',
          code: 'INVALID_MODEL_SELECTION'
        }, { status: 400 });
      }

      const ONE_CREDIT_CHARS = 3800;
      const userIdForCredits = await getUserIdFromAuthHeader(req);
      const userTier = await getUserTier(userIdForCredits);
      const requiredTier = MODEL_REQUIRED_TIER[modelChoice];
      if (requiredTier === 'paid' && userTier !== 'paid') {
        return NextResponse.json({
          error: 'Upgrade required for smart mode',
          message: 'Smart mode is available on paid plans. Please upgrade to access the Gemini smart model.',
          code: 'SMART_MODEL_REQUIRES_UPGRADE'
        }, { status: 403 });
      }

      if (userIdForCredits) {
        try {
          await ensureFreeMonthlyCredits(userIdForCredits);
        } catch (creditError) {
          console.warn('Failed to ensure free monthly credits:', creditError);
          // Continue processing - don't fail the request for credit setup issues
        }
      }

      // Text/images/prompt path (pre-parsed input)
      let text = typeof body.text === 'string' ? body.text : '';
      const textHasContent = text.trim().length > 0;
      if (!textHasContent) text = '';
      let promptText = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      const images = Array.isArray(body.images) ? body.images as string[] : [];
      const rawCharCount = typeof (body as any)?.rawCharCount === 'number' ? (body as any).rawCharCount as number : undefined;
      if (!text && images.length === 0 && promptText) {
        text = promptText;
        promptText = '';
      }
      // If rawCharCount is provided (from preparse), bill ONLY on truncated file text; exclude prompt length
      const creditsRaw = rawCharCount !== undefined ? rawCharCount : ((text?.length || 0) + (promptText?.length || 0));
      let creditsNeeded = creditsRaw > 0 ? (creditsRaw / ONE_CREDIT_CHARS) : 0;
      if (images.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
      if (!text && images.length === 0 && promptText && creditsNeeded < 1) creditsNeeded = 1;
      const multiplier = MODEL_CREDIT_MULTIPLIERS[modelChoice] ?? 1;
      creditsNeeded = Number((creditsNeeded * multiplier).toFixed(3));
      if (userIdForCredits && creditsNeeded > 0) {
        const currentCredits = await getCurrentCredits(userIdForCredits);
        if (currentCredits === null) {
          return NextResponse.json({
            error: 'Credits service unavailable',
            message: 'Unable to check your credit balance. Please try again later.',
            code: 'CREDITS_SERVICE_ERROR'
          }, { status: 503 });
        }

        if (currentCredits < creditsNeeded) {
          const shortfall = creditsNeeded - currentCredits;
          return NextResponse.json({
            error: 'Insufficient credits',
            message: `You need ${creditsNeeded.toFixed(1)} credits but only have ${currentCredits.toFixed(1)}. Please upload a smaller file or upgrade your plan.`,
            code: 'INSUFFICIENT_CREDITS',
            creditsNeeded: creditsNeeded,
            creditsAvailable: currentCredits,
            shortfall: shortfall
          }, { status: 402 });
        }

        const ok = await deductCredits(userIdForCredits, creditsNeeded);
        if (!ok) {
          return NextResponse.json({
            error: 'Credit deduction failed',
            message: 'Failed to deduct credits from your account. Please try again.',
            code: 'CREDIT_DEDUCTION_ERROR'
          }, { status: 500 });
        }
      }

      const { resolved: resolvedImages, cleanupPaths: supabaseCleanupPaths } = await resolveImageInputs(images);

      const validImages: string[] = [];
      for (const url of resolvedImages) {
        try {
          if (url.startsWith('data:')) {
            validImages.push(url);
          } else {
            new URL(url);
            validImages.push(url);
          }
        } catch {
          console.warn('Invalid image URL:', url);
        }
      }

      if (images.length > 0 && validImages.length === 0) {
        return NextResponse.json({
          error: 'Invalid image URLs',
          message: 'All provided image URLs are invalid. Please try uploading your images again.',
          code: 'INVALID_IMAGE_URLS'
        }, { status: 400 });
      }
      const streamingPrompt = buildFlashcardPrompt({ mode: shouldStream ? 'stream' : 'json', sourceContent: text || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.', userInstruction: promptText, imagesCount: images.length, numCards: body.numCards });

      logLlmInput('FLASHCARDS PRE-PARSED LLM INPUT', streamingPrompt, modelChoice);
      const userContent: any = validImages.length > 0
        ? [{ type: 'text', text: streamingPrompt }, ...validImages.map((url) => ({ type: 'image_url', image_url: { url } }))]
        : streamingPrompt;
      if (shouldStream) {
        return streamNdjson(
          userContent,
          modelChoice,
          (userIdForCredits && creditsNeeded > 0) ? { userId: userIdForCredits, credits: creditsNeeded } : undefined,
          validImages,
          supabaseCleanupPaths,
        );
      }
      try {
        const result = await generateJsonFromModel(userContent, modelChoice);
        if (supabaseCleanupPaths.length > 0) {
          try {
            await fetch(new URL('/api/storage/cleanup', req.url), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths: Array.from(new Set(supabaseCleanupPaths)) }),
            });
          } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError);
          }
        }
        return NextResponse.json(result);
      } catch (e) {
        console.error('Flashcard generation error:', e);
        if (e instanceof Error) {
          if (e.message.includes('No content returned')) {
            return NextResponse.json({
              error: 'No content generated',
              message: 'The AI service returned no content. Please try again with different content.',
              code: 'NO_CONTENT_GENERATED'
            }, { status: 502 });
          }
          if (e.message.includes('Failed to generate flashcards')) {
            return NextResponse.json({
              error: 'Generation failed',
              message: 'Unable to generate flashcards from the provided content. Please try with different content.',
              code: 'GENERATION_FAILED'
            }, { status: 502 });
          }
          if (e.message.includes('Model response was not valid JSON')) {
            return NextResponse.json({
              error: 'Invalid response format',
              message: 'The AI service returned an invalid response. Please try again.',
              code: 'INVALID_RESPONSE_FORMAT'
            }, { status: 502 });
          }
        }
        const sanitizedMessage = e instanceof Error ? e.message.replace(/API key|token|secret/gi, '[REDACTED]') : 'Unknown error occurred';
        return NextResponse.json({
          error: 'Flashcard generation failed',
          message: sanitizedMessage.length > 200 ? sanitizedMessage.substring(0, 200) + '...' : sanitizedMessage,
          code: 'FLASHCARD_GENERATION_ERROR'
        }, { status: 502 });
      }
    }

    // Multipart form-data path: files + optional prompt
    let formData;
    try {
      formData = await req.formData();
    } catch (formError) {
      return NextResponse.json({
        error: 'Invalid form data',
        message: 'The multipart form data is malformed. Please check your file upload.',
        code: 'INVALID_FORM_DATA'
      }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    const promptText = (formData.get('prompt') as string | null) || '';
    const modelChoice = normalizeModelChoice((formData.get('model') as string | null) || undefined);

    if (!modelChoice) {
      return NextResponse.json({
        error: 'Invalid model selected',
        message: 'The requested model is not supported. Please choose either the fast or smart mode.',
        code: 'INVALID_MODEL_SELECTION'
      }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        error: 'No files uploaded',
        message: 'Please upload at least one file to process.',
        code: 'NO_FILES_UPLOADED'
      }, { status: 400 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    const userTier = await getUserTier(userId);
    const requiredTier = MODEL_REQUIRED_TIER[modelChoice];
    if (requiredTier === 'paid' && userTier !== 'paid') {
      return NextResponse.json({
        error: 'Upgrade required for smart mode',
        message: 'Smart mode is available on paid plans. Please upgrade to access the Gemini smart model.',
        code: 'SMART_MODEL_REQUIRES_UPGRADE'
      }, { status: 403 });
    }

    // Use the new cumulative file processing logic
    let result;
    try {
      result = await processMultipleFiles(files, userTier);
    } catch (fileError) {
      console.error('File processing error:', fileError);

      if (fileError instanceof Error) {
        if (fileError.message.includes('size') || fileError.message.includes('limit')) {
          return NextResponse.json({
            error: 'File too large',
            message: 'The uploaded file(s) are too large. Please try with smaller files or fewer files.',
            code: 'FILE_SIZE_EXCEEDED'
          }, { status: 413 });
        }

        if (fileError.message.includes('format') || fileError.message.includes('type')) {
          return NextResponse.json({
            error: 'Unsupported file format',
            message: 'One or more files have an unsupported format. Please use PDF, DOCX, PPTX, or plain text files.',
            code: 'UNSUPPORTED_FORMAT'
          }, { status: 400 });
        }

        if (fileError.message.includes('corrupt') || fileError.message.includes('invalid')) {
          return NextResponse.json({
            error: 'File corrupted',
            message: 'One or more files appear to be corrupted or invalid. Please check your files and try again.',
            code: 'CORRUPTED_FILE'
          }, { status: 400 });
        }
      }

      return NextResponse.json({
        error: 'File processing failed',
        message: 'Unable to process the uploaded files. Please try again with different files.',
        code: 'FILE_PROCESSING_ERROR'
      }, { status: 400 });
    }

    const extractedText = result.extractedParts.join('\n\n');
    const imageParts: { type: 'image_url'; image_url: { url: string } }[] = result.imageDataUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));
    // Bill ONLY on truncated file text; do not include prompt length
    let totalRawChars = result.totalRawChars;

    if (!extractedText && imageParts.length === 0) {
      return NextResponse.json({
        error: 'No readable content',
        message: 'Could not extract any readable content from the uploaded files. Please ensure your files contain text or images.',
        code: 'NO_READABLE_CONTENT'
      }, { status: 400 });
    }

    // Compute and reserve credits (fractional allowed). Min 0.5 when image-only
    const ONE_CREDIT_CHARS = 3800;
    let creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
    if (imageParts.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
    const multiplier = MODEL_CREDIT_MULTIPLIERS[modelChoice] ?? 1;
    creditsNeeded = Number((creditsNeeded * multiplier).toFixed(3));
    if (userId) {
      try {
        await ensureFreeMonthlyCredits(userId);
      } catch (creditError) {
        console.warn('Failed to ensure free monthly credits:', creditError);
        // Continue processing - don't fail the request for credit setup issues
      }
    }

    if (userId && creditsNeeded > 0) {
      const currentCredits = await getCurrentCredits(userId);
      if (currentCredits === null) {
        return NextResponse.json({
          error: 'Credits service unavailable',
          message: 'Unable to check your credit balance. Please try again later.',
          code: 'CREDITS_SERVICE_ERROR'
        }, { status: 503 });
      }

      if (currentCredits < creditsNeeded) {
        const shortfall = creditsNeeded - currentCredits;
        return NextResponse.json({
          error: 'Insufficient credits',
          message: `You need ${creditsNeeded.toFixed(1)} credits but only have ${currentCredits.toFixed(1)}. Please upload a smaller file or upgrade your plan.`,
          code: 'INSUFFICIENT_CREDITS',
          creditsNeeded: creditsNeeded,
          creditsAvailable: currentCredits,
          shortfall: shortfall
        }, { status: 402 });
      }

      const ok = await deductCredits(userId, creditsNeeded);
      if (!ok) {
        return NextResponse.json({
          error: 'Credit deduction failed',
          message: 'Failed to deduct credits from your account. Please try again.',
          code: 'CREDIT_DEDUCTION_ERROR'
        }, { status: 500 });
      }
    }

    if (shouldStream) {
      const prompt = buildFlashcardPrompt({
        mode: 'stream',
        sourceContent: extractedText || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.',
        userInstruction: promptText,
        imagesCount: imageParts.length,
      });
      // Validate image URLs before sending to API (handle both signed URLs and base64 data URLs)
      const validImageParts = [];
      for (const imgPart of imageParts) {
        try {
          const url = imgPart.image_url.url;
          if (url.startsWith('data:')) {
            // Base64 data URLs are valid
            validImageParts.push(imgPart);
          } else {
            // Validate signed URLs
            new URL(url);
            validImageParts.push(imgPart);
          }
        } catch {
          console.warn('Invalid image URL:', imgPart.image_url.url);
        }
      }

      if (imageParts.length > 0 && validImageParts.length === 0) {
        return NextResponse.json({
          error: 'Invalid image URLs',
          message: 'All provided image URLs are invalid. Please try uploading your images again.',
          code: 'INVALID_IMAGE_URLS'
        }, { status: 400 });
      }

      const userContent: any = validImageParts.length > 0 ? [{ type: 'text', text: prompt }, ...validImageParts] : prompt;
      logLlmInput('FLASHCARDS STREAMING LLM INPUT', prompt, modelChoice);
      return streamNdjson(
        userContent,
        modelChoice,
        (userId && creditsNeeded > 0) ? { userId, credits: creditsNeeded } : undefined,
        validImageParts.map(img => img.image_url.url),
        [],
      );
    }

    // Non-streaming JSON
    const prompt = buildFlashcardPrompt({
      mode: 'json',
      sourceContent: extractedText || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.',
      userInstruction: promptText,
      imagesCount: imageParts.length,
    });
    // Validate image URLs before sending to API (for non-streaming path, handle both signed URLs and base64 data URLs)
    const validImagePartsNonStream = [];
    for (const imgPart of imageParts) {
      try {
        const url = imgPart.image_url.url;
        if (url.startsWith('data:')) {
          // Base64 data URLs are valid
          validImagePartsNonStream.push(imgPart);
        } else {
          // Validate signed URLs
          new URL(url);
          validImagePartsNonStream.push(imgPart);
        }
      } catch {
        console.warn('Invalid image URL:', imgPart.image_url.url);
      }
    }

    if (imageParts.length > 0 && validImagePartsNonStream.length === 0) {
      return NextResponse.json({
        error: 'Invalid image URLs',
        message: 'All provided image URLs are invalid. Please try uploading your images again.',
        code: 'INVALID_IMAGE_URLS'
      }, { status: 400 });
    }

    const userContent: any = validImagePartsNonStream.length > 0 ? [{ type: 'text', text: prompt }, ...validImagePartsNonStream] : prompt;

    logLlmInput('FLASHCARDS NON-STREAMING LLM INPUT', prompt, modelChoice);
    try {
      const result = await generateJsonFromModel(userContent, modelChoice);
      return NextResponse.json(result);
    } catch (e) {
      console.error('Flashcard generation error:', e);
      if (e instanceof Error) {
        if (e.message.includes('No content returned')) {
          return NextResponse.json({
            error: 'No content generated',
            message: 'The AI service returned no content. Please try again with different content.',
            code: 'NO_CONTENT_GENERATED'
          }, { status: 502 });
        }
        if (e.message.includes('Failed to generate flashcards')) {
          return NextResponse.json({
            error: 'Generation failed',
            message: 'Unable to generate flashcards from the provided content. Please try with different content.',
            code: 'GENERATION_FAILED'
          }, { status: 502 });
        }
        if (e.message.includes('Model response was not valid JSON')) {
          return NextResponse.json({
            error: 'Invalid response format',
            message: 'The AI service returned an invalid response. Please try again.',
            code: 'INVALID_RESPONSE_FORMAT'
          }, { status: 502 });
        }
      }
      const sanitizedMessage = e instanceof Error ? e.message.replace(/API key|token|secret/gi, '[REDACTED]') : 'Unknown error occurred';
      return NextResponse.json({
        error: 'Flashcard generation failed',
        message: sanitizedMessage.length > 200 ? sanitizedMessage.substring(0, 200) + '...' : sanitizedMessage,
        code: 'FLASHCARD_GENERATION_ERROR'
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Error in generate-flashcards API:', error);

    // Handle specific error types with appropriate status codes and messages
    if (error instanceof Error) {
      // OpenAI API errors
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        return NextResponse.json({
          error: 'Authentication failed',
          message: 'Unable to authenticate with the AI service. Please try again later.',
          code: 'AUTH_ERROR'
        }, { status: 503 });
      }

      // Rate limiting
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json({
          error: 'Service temporarily unavailable',
          message: 'The AI service is currently busy. Please wait a moment and try again.',
          code: 'RATE_LIMITED'
        }, { status: 429 });
      }

      // Content filtering/moderation
      if (error.message.includes('content') && error.message.includes('filter')) {
        return NextResponse.json({
          error: 'Content not allowed',
          message: 'The provided content could not be processed due to content restrictions.',
          code: 'CONTENT_FILTERED'
        }, { status: 400 });
      }

      // File processing errors
      if (error.message.includes('file') || error.message.includes('document')) {
        return NextResponse.json({
          error: 'File processing failed',
          message: 'Unable to process the uploaded file. Please ensure it\'s a valid document format.',
          code: 'FILE_PROCESSING_ERROR'
        }, { status: 400 });
      }

      // Database/Supabase errors
      if (error.message.includes('supabase') || error.message.includes('database')) {
        return NextResponse.json({
          error: 'Database error',
          message: 'A temporary database issue occurred. Please try again.',
          code: 'DATABASE_ERROR'
        }, { status: 503 });
      }

      // Network/timeout errors
      if (error.message.includes('timeout') || error.message.includes('network') || error.message.includes('fetch')) {
        return NextResponse.json({
          error: 'Request timeout',
          message: 'The request took too long to process. Please try with a smaller file or simpler content.',
          code: 'TIMEOUT_ERROR'
        }, { status: 408 });
      }

      // Generic OpenAI errors
      if (error.message.includes('openai') || error.message.includes('gemini')) {
        return NextResponse.json({
          error: 'AI service error',
          message: 'The AI service encountered an issue. Please try again with different content.',
          code: 'AI_SERVICE_ERROR'
        }, { status: 503 });
      }

      // Use the original error message for other cases, but sanitize it
      const sanitizedMessage = error.message.replace(/API key|token|secret/gi, '[REDACTED]');
      return NextResponse.json({
        error: 'Processing failed',
        message: sanitizedMessage.length > 200 ? sanitizedMessage.substring(0, 200) + '...' : sanitizedMessage,
        code: 'GENERIC_ERROR'
      }, { status: 500 });
    }

    // Non-Error objects
    return NextResponse.json({
      error: 'Unexpected error',
      message: 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
