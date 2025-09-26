import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx, getTextFromPlainText, processMultipleFiles } from '@/lib/document-parser';
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
  sourceType: 'markmap' | 'text';
  sourceContent: string;
  userInstruction?: string;
  imagesCount?: number;
  numCards?: number;
}): string {
  const { mode, sourceType, sourceContent, userInstruction, imagesCount } = opts;
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

  const scopeLine = sourceType === 'markmap'
    ? `You will be given a mind map described in Markmap-compatible Markdown. Generate high-quality active-recall flashcards that help a learner master the content.`
    : `You will be given source content. Generate high-quality active-recall flashcards that help a learner master the content.`;

  const languageAndCount = sourceType === 'markmap'
    ? `- Produce about 20 to 100 cards depending on content size.
- The flashcards MUST be in the same language as the mind map.`
    : `- Produce about 20 to 100 cards depending on content size.
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

4.  **Keep Answers Concise:** Answers should be clear, direct, and AS BRIEF AS POSSIBLE while remaining accurate. Use markdown bullet points for lists. Prefer one-word answers if possible.
    - GOOD: Q: "What is 1+1?" A: "2"
    - BAD: Q: "What is 1+1?" A: "The result of adding 1 and 1 is 2."

${languageAndCount}
${imagesNote ? `- ${imagesNote}` : ''}

${sourceType === 'markmap' ? 'Mind map (Markmap Markdown):' : 'Source content:'}\n---\n${sourceContent}\n---`;

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

// Simple, consistent logging of model input
function logLlmInput(kind: string, prompt: string) {
  console.log(`=== ${kind} ===`);
  console.log('Character count:', prompt.length);
  console.log('Text content preview:', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''));
  console.log('==============================');
}

// Shared non-streaming completion + JSON parsing
async function generateJsonFromModel(userContent: any): Promise<{ title: string | null; cards: Flashcard[] }> {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: 'gemini-flash-lite-latest',
      // @ts-ignore
      reasoning_effort: 'none',
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
    const streamNdjson = async (promptContent: any, refundInfo?: { userId: string; credits: number }, images?: string[]) => {
      const encoder = new TextEncoder();
      let stream;
      try {
        stream = await openai.chat.completions.create({
          model: 'gemini-flash-lite-latest',
          // @ts-ignore
          reasoning_effort: 'none', // Reduce thinking time for faster responses
          messages: [{ role: 'user', content: promptContent }],
          stream: true,
          stream_options: { include_usage: false }, // Reduce overhead
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

      let anyChunkSent = false;
      let anyCardSent = false;
      let buffer = '';
      let pendingLine: string | null = null;
      let lastHeartbeat = Date.now();
      const HEARTBEAT_INTERVAL = 30000; // 30 seconds
      const STREAM_TIMEOUT = 4 * 60 * 1000; // 4 minutes total timeout for the entire stream

      // Extract file paths from images for cleanup (only for signed URLs, not base64 data URLs)
      const filesToCleanup: string[] = [];
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
                filesToCleanup.push(path);
              }
            } catch {}
          }
        });
      }

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Emit an immediate meta line so the client can render instantly
            try {
              const earlyMeta = JSON.stringify({ type: 'meta', title: 'flashcards' }) + '\n';
              controller.enqueue(encoder.encode(earlyMeta));
              anyChunkSent = true; // do not count as card
              console.log('Stream started, sent meta line');
            } catch {}
            for await (const chunk of stream as any) {
              const token: string = chunk?.choices?.[0]?.delta?.content || '';
              if (!token) continue;

              // Check for overall stream timeout
              const now = Date.now();
              if (now - lastHeartbeat > STREAM_TIMEOUT) {
                console.warn('Stream timeout detected, ending stream');
                controller.close();
                break;
              }

              buffer += token;

              // Send heartbeat if it's been too long since last activity
              if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
                try {
                  const heartbeat = JSON.stringify({ type: 'heartbeat', timestamp: now }) + '\n';
                  controller.enqueue(encoder.encode(heartbeat));
                  lastHeartbeat = now;
                } catch {}
              }

              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                let line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                newlineIndex = buffer.indexOf('\n');
                if (!line) continue;
                if (pendingLine) {
                  line = pendingLine + line;
                  pendingLine = null;
                }
                try {
                  const obj = JSON.parse(line);
                  controller.enqueue(encoder.encode(line + '\n'));
                  anyChunkSent = true;
                  if (obj && obj.type === 'card') {
                    anyCardSent = true;
                    if (!anyCardSent) console.log('First card received from model');
                  }
                  if (obj && obj.type === 'done') {
                    console.log('Stream completed successfully');
                  }
                  lastHeartbeat = Date.now(); // Reset heartbeat on successful message
                } catch {
                  pendingLine = line;
                }
              }
            }
            if (pendingLine) {
              try {
                const obj = JSON.parse(pendingLine);
                controller.enqueue(encoder.encode(pendingLine + '\n'));
                anyChunkSent = true;
                if (obj && obj.type === 'card') anyCardSent = true;
              } catch {}
            }
            controller.close();

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
      // Enhanced JSON path: supports either { markdown } OR { text, images?, prompt?, numCards? }
      let body: { markdown?: string; numCards?: number; text?: string; images?: string[]; prompt?: string } | null = null;

      try {
        body = await req.json() as { markdown?: string; numCards?: number; text?: string; images?: string[]; prompt?: string } | null;
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
          message: 'The request body is empty. Please provide markdown, text, images, or a prompt.',
          code: 'EMPTY_REQUEST'
        }, { status: 400 });
      }

      const hasMarkdown = typeof body.markdown === 'string' && body.markdown.trim().length > 0;
      const hasTextPayload = (typeof body.text === 'string' && body.text.length > 0) || (Array.isArray(body.images) && body.images.length > 0) || (typeof body.prompt === 'string' && body.prompt.trim().length > 0);

      if (!hasMarkdown && !hasTextPayload) {
        return NextResponse.json({
          error: 'No content provided',
          message: 'Please provide either markdown content or text/images/prompt content to process.',
          code: 'NO_CONTENT'
        }, { status: 400 });
      }

      const ONE_CREDIT_CHARS = 3800;
      const userIdForCredits = await getUserIdFromAuthHeader(req);
      if (userIdForCredits) {
        try {
          await ensureFreeMonthlyCredits(userIdForCredits);
        } catch (creditError) {
          console.warn('Failed to ensure free monthly credits:', creditError);
          // Continue processing - don't fail the request for credit setup issues
        }
      }

      if (hasMarkdown) {
        const totalRawChars = body.markdown!.length;
        const creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
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
        if (shouldStream) {
          const streamingPrompt = buildFlashcardPrompt({ mode: 'stream', sourceType: 'markmap', sourceContent: body.markdown!, numCards: body.numCards });

          logLlmInput('FLASHCARDS MARKDOWN STREAMING LLM INPUT', streamingPrompt);

          return streamNdjson(streamingPrompt, (userIdForCredits && creditsNeeded > 0) ? { userId: userIdForCredits, credits: creditsNeeded } : undefined, undefined);
        }
        const prompt = buildFlashcardPrompt({ mode: 'json', sourceType: 'markmap', sourceContent: body.markdown!, numCards: body.numCards });

        logLlmInput('FLASHCARDS MARKDOWN NON-STREAMING LLM INPUT', prompt);
        try {
          const result = await generateJsonFromModel(prompt);
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

      // Text/images/prompt path (pre-parsed input)
      const text = (body.text || '').toString();
      const promptText = (body.prompt || '').toString();
      const images = Array.isArray(body.images) ? body.images as string[] : [];
      const rawCharCount = typeof (body as any)?.rawCharCount === 'number' ? (body as any).rawCharCount as number : undefined;
      // If rawCharCount is provided (from preparse), bill ONLY on truncated file text; exclude prompt length
      const creditsRaw = rawCharCount !== undefined ? rawCharCount : ((text?.length || 0) + (promptText?.length || 0));
      let creditsNeeded = creditsRaw > 0 ? (creditsRaw / ONE_CREDIT_CHARS) : 0;
      if (images.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
      if (!text && images.length === 0 && promptText && creditsNeeded < 1) creditsNeeded = 1;
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
      const streamingPrompt = buildFlashcardPrompt({ mode: shouldStream ? 'stream' : 'json', sourceType: 'text', sourceContent: text || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.', userInstruction: promptText, imagesCount: images.length, numCards: body.numCards });

      logLlmInput('FLASHCARDS PRE-PARSED LLM INPUT', streamingPrompt);
      const userContent: any = images.length > 0
        ? [{ type: 'text', text: streamingPrompt }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
        : streamingPrompt;
      if (shouldStream) {
        return streamNdjson(userContent, (userIdForCredits && creditsNeeded > 0) ? { userId: userIdForCredits, credits: creditsNeeded } : undefined, images);
      }
      try {
        const result = await generateJsonFromModel(userContent);
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

    if (!files || files.length === 0) {
      return NextResponse.json({
        error: 'No files uploaded',
        message: 'Please upload at least one file to process.',
        code: 'NO_FILES_UPLOADED'
      }, { status: 400 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    const userTier = await getUserTier(userId);

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
        sourceType: 'text',
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
      logLlmInput('FLASHCARDS STREAMING LLM INPUT', prompt);
      return streamNdjson(userContent, (userId && creditsNeeded > 0) ? { userId, credits: creditsNeeded } : undefined, validImageParts.map(img => img.image_url.url));
    }

    // Non-streaming JSON
    const prompt = buildFlashcardPrompt({
      mode: 'json',
      sourceType: 'text',
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

    logLlmInput('FLASHCARDS NON-STREAMING LLM INPUT', prompt);
    try {
      const result = await generateJsonFromModel(userContent);
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
