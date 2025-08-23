import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx } from '@/lib/document-parser';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
});

// --- Supabase Server Client & Credit Helpers ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
  tags?: string[];
}

function constructFlashcardPromptFromMarkmap(markmapMarkdown: string, numCards?: number) {
  const targetCount = numCards && numCards > 0 ? numCards : 18;
  return `You are an expert instructional designer.
You will be given a mind map described in Markmap-compatible Markdown. Generate high-quality active-recall flashcards that help a learner master the content.

REQUIREMENTS:
- Output strictly as a single JSON object only. No preface, no code fences, no commentary.
- JSON schema:
  { "title": string, "cards": [ { "question": string, "answer": string, "tags": string[] } ] }
- Prefer concise questions; avoid yes/no.
- Prefer atomic, focused answers. Use bullet points when helpful.
- Include 1-3 short tags per card from node labels.
- Create about between 15 and 35 cards depending on the size of the mind map; vary difficulty.
- The flashcards should be in the same language as the mind map.

Mind map (Markmap Markdown):\n---\n${markmapMarkdown}\n---`;
}

// Streaming variant: require NDJSON with meta/card/done lines
function constructFlashcardStreamingPromptFromMarkmap(markmapMarkdown: string, numCards?: number) {
  return `You are an expert instructional designer.
You will be given a mind map described in Markmap-compatible Markdown. Generate high-quality active-recall flashcards that help a learner master the content.

STREAMING OUTPUT FORMAT (STRICT):
- Emit your response as newline-delimited JSON (NDJSON), one JSON object per line.
- Do NOT wrap in an array, do NOT include any text outside the JSON objects, and do NOT use code fences.
- Use exactly these object shapes (one per line):
  { "type": "meta", "title": string }
  { "type": "card", "question": string, "answer": string, "tags": string[] }
  { "type": "done" }
- Start with a single meta line, then stream each card as its own line, and end with a single done line.
- Produce about 15 to 35 cards depending on content size and vary difficulty.
- Keep each JSON object on ONE LINE. Escape any internal newlines as \n within strings.
- The flashcards must be in the same language as the mind map.

Mind map (Markmap Markdown):\n---\n${markmapMarkdown}\n---`;
}

function constructFlashcardPromptFromText(sourceText: string, userInstruction?: string, numCards?: number, imagesCount?: number) {
  const targetCount = numCards && numCards > 0 ? numCards : 18;
  const imagesNote = imagesCount && imagesCount > 0
    ? `You are also provided ${imagesCount} image(s). Carefully read text inside the images (OCR) and analyze diagrams to extract key concepts.`
    : '';
  const userLine = userInstruction ? `\nAdditional user instruction: ${userInstruction}` : '';
  return `You are an expert instructional designer.
You will be given source content. Generate high-quality active-recall flashcards that help a learner master the content.${userLine}

REQUIREMENTS:
- Output strictly as a single JSON object only. No preface, no code fences, no commentary.
- JSON schema:
  { "title": string, "cards": [ { "question": string, "answer": string, "tags": string[] } ] }

### Card Creation Principles
1.  **Promote Active Recall:** Questions must be open-ended to force the learner to retrieve information from memory.
    - GOOD: "What are the three core principles of spaced repetition?"
    - BAD: "Are there three core principles of spaced repetition?"

2.  **Ensure Atomicity:** Each card must focus on ONE SINGLE, ISOLATED CONCEPT. DO NOT combine multiple questions or answers on a single card.
    - GOOD: Q: "What is the primary benefit of active recall?" A: "It strengthens neural pathways, improving long-term memory."
    - BAD: Q: "What are active recall and spaced repetition?" A: "Active recall is... and spaced repetition is..."

3.  **Foster Deeper Understanding:** Go beyond simple definitions. Create questions that prompt for explanations, comparisons, or the "why" behind a concept. Use the "context_or_example" field to help the learner connect the information to a practical application or a larger framework.

4.  **Keep Answers Concise:** Answers should be clear, direct, and AS BRIEF AS POSSIBLE while remaining accurate. Use markdown bullet points for lists. Prefer one-word answers if possible.
    - GOOD: Q: "What is 1+1?" A: "2"
    - BAD: Q: "What is 1+1?" A: "The result of adding 1 and 1 is 2."

- Include 1-3 short tags per card from the content topics.
- Create about between 15 and 35 cards depending on the size of the content.
- The flashcards should be in the same language as the content.

${imagesNote}

Source content:\n---\n${sourceText}\n---`;
}

function constructFlashcardStreamingPromptFromText(sourceText: string, userInstruction?: string, numCards?: number, imagesCount?: number) {
  const imagesNote = imagesCount && imagesCount > 0
    ? `You are also provided ${imagesCount} image(s). Carefully read text inside the images (OCR) and analyze diagrams to extract key concepts.`
    : '';
  const userLine = userInstruction ? `\nAdditional user instruction: ${userInstruction}` : '';
  return `You are an expert instructional designer.
You will be given source content. Generate high-quality active-recall flashcards that help a learner master the content.${userLine}

STREAMING OUTPUT FORMAT (STRICT):
- Emit your response as newline-delimited JSON (NDJSON), one JSON object per line.
- Do NOT wrap in an array, do NOT include any text outside the JSON objects, and do NOT use code fences.
- Use exactly these object shapes (one per line):
  { "type": "meta", "title": string }
  { "type": "card", "question": string, "answer": string, "tags": string[] }
  { "type": "done" }
- Start with a single meta line, then stream each card as its own line, and end with a single done line.
- Keep each JSON object on ONE LINE. Escape any internal newlines as \n within strings.

### Card Creation Principles
1.  **Promote Active Recall:** Questions must be open-ended to force the learner to retrieve information from memory.
    - GOOD: "What are the three core principles of spaced repetition?"
    - BAD: "Are there three core principles of spaced repetition?"

2.  **Ensure Atomicity:** Each card must focus on ONE SINGLE, ISOLATED CONCEPT. DO NOT combine multiple questions or answers on a single card.
    - GOOD: Q: "What is the primary benefit of active recall?" A: "It strengthens neural pathways, improving long-term memory."
    - BAD: Q: "What are active recall and spaced repetition?" A: "Active recall is... and spaced repetition is..."

3.  **Foster Deeper Understanding:** Go beyond simple definitions. Create questions that prompt for explanations, comparisons, or the "why" behind a concept. Use the "context_or_example" field to help the learner connect the information to a practical application or a larger framework.

4.  **Keep Answers Concise:** Answers should be clear, direct, and AS BRIEF AS POSSIBLE while remaining accurate. Use markdownbullet points for lists. Prefer one-word answers if possible.
    - GOOD: Q: "What is 1+1?" A: "2"
    - BAD: Q: "What is 1+1?" A: "The result of adding 1 and 1 is 2."

- Produce about 15 to 35 cards depending on content size.
- The flashcards must be in the same language as the content.
${imagesNote}

Source content:\n---\n${sourceText}\n---`;
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

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const streamParam = url.searchParams.get('stream');
    const shouldStream = streamParam === '1' || streamParam === 'true';

    const contentType = req.headers.get('content-type') || '';

    // Helper to stream NDJSON lines from a prompt, with optional credit refund on total failure
    const streamNdjson = async (promptContent: any, refundInfo?: { userId: string; credits: number }) => {
      const encoder = new TextEncoder();
      const stream = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        // @ts-ignore
        reasoning_effort: 'none',
        messages: [{ role: 'user', content: promptContent }],
        stream: true,
      });

      let anyChunkSent = false;
      let buffer = '';
      let pendingLine: string | null = null;

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream as any) {
              const token: string = chunk?.choices?.[0]?.delta?.content || '';
              if (!token) continue;
              buffer += token;

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
                  JSON.parse(line);
                  controller.enqueue(encoder.encode(line + '\n'));
                  anyChunkSent = true;
                } catch {
                  pendingLine = line;
                }
              }
            }
            if (pendingLine) {
              try {
                JSON.parse(pendingLine);
                controller.enqueue(encoder.encode(pendingLine + '\n'));
                anyChunkSent = true;
              } catch {}
            }
            controller.close();
          } catch (err) {
            if (!anyChunkSent) {
              if (refundInfo && refundInfo.credits > 0) {
                try { await refundCredits(refundInfo.userId, refundInfo.credits); } catch {}
              }
              controller.error(err);
            } else {
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
      // Original JSON path: expects markdown
      const body = await req.json().catch(() => null) as { markdown?: string; numCards?: number } | null;
      if (!body || !body.markdown || typeof body.markdown !== 'string') {
        return NextResponse.json({ error: 'Missing required field: markdown' }, { status: 400 });
      }
      // Compute credits from markdown length (fractional allowed)
      const ONE_CREDIT_CHARS = 3800;
      const totalRawChars = body.markdown.length;
      const creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
      const userId = await getUserIdFromAuthHeader(req);
      if (userId) { try { await ensureFreeMonthlyCredits(userId); } catch {} }
      if (userId && creditsNeeded > 0) {
        const ok = await deductCredits(userId, creditsNeeded);
        if (!ok) return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan or top up.' }, { status: 402 });
      }
      if (shouldStream) {
        const streamingPrompt = constructFlashcardStreamingPromptFromMarkmap(body.markdown, body.numCards);
        const userIdForRefund = await getUserIdFromAuthHeader(req);
        return streamNdjson(streamingPrompt, (userIdForRefund && creditsNeeded > 0) ? { userId: userIdForRefund, credits: creditsNeeded } : undefined);
      }
      const prompt = constructFlashcardPromptFromMarkmap(body.markdown, body.numCards);
      const completion = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        // @ts-ignore
        reasoning_effort: 'none',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        // @ts-ignore
        response_format: { type: 'json_object' },
      });
      const content = completion.choices?.[0]?.message?.content ?? '';
      if (!content) return NextResponse.json({ error: 'No content returned from model' }, { status: 502 });
      const parsed = extractJsonObject(content);
      const cards: Flashcard[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
      if (cards.length === 0) return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 502 });
      return NextResponse.json({ title: parsed.title || null, cards });
    }

    // Multipart form-data path: files + optional prompt
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const promptText = (formData.get('prompt') as string | null) || '';
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Please upload at least one file' }, { status: 400 });
    }

    let extractedText = '';
    const extractedParts: string[] = [];
    const imageParts: { type: 'image_url'; image_url: { url: string } }[] = [];
    let totalRawChars = 0;
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = '';
      if (file.type === 'application/pdf') {
        text = await getTextFromPdf(buffer);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await getTextFromDocx(buffer);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        text = await getTextFromPptx(buffer);
      } else if (file.type === 'text/plain') {
        text = buffer.toString('utf-8');
      } else if (file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown')) {
        text = buffer.toString('utf-8');
      } else if (file.type.startsWith('image/')) {
        try {
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${file.type};base64,${base64}`;
          imageParts.push({ type: 'image_url', image_url: { url: dataUrl } });
          continue;
        } catch {
          continue;
        }
      } else {
        // skip unsupported types silently
        continue;
      }
      if (text) totalRawChars += text.length;
      extractedParts.push(`--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---`);
    }
    extractedText = extractedParts.join('\n\n');
    if (promptText) totalRawChars += promptText.length;

    if (!extractedText && imageParts.length === 0) {
      return NextResponse.json({ error: 'Could not read any supported content from the uploaded files.' }, { status: 400 });
    }

    // Compute and reserve credits (fractional allowed). Min 0.5 when image-only
    const ONE_CREDIT_CHARS = 3800;
    let creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
    if (imageParts.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
    const userId = await getUserIdFromAuthHeader(req);
    if (userId) { try { await ensureFreeMonthlyCredits(userId); } catch {} }
    if (userId && creditsNeeded > 0) {
      const ok = await deductCredits(userId, creditsNeeded);
      if (!ok) return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan or top up.' }, { status: 402 });
    }

    if (shouldStream) {
      const prompt = constructFlashcardStreamingPromptFromText(
        extractedText || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.',
        promptText,
        undefined,
        imageParts.length,
      );
      const userContent: any = imageParts.length > 0
        ? [{ type: 'text', text: prompt }, ...imageParts]
        : prompt;
      // Wrap stream to refund credits on complete failure before first line
      const encoder = new TextEncoder();
      const stream = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        // @ts-ignore
        reasoning_effort: 'none',
        messages: [{ role: 'user', content: userContent }],
        stream: true,
      });
      let anyChunkSent = false;
      let buffer = '';
      let pendingLine: string | null = null;
      const reservedForUserId = userId || null;
      const reservedCredits = creditsNeeded;
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream as any) {
              const token: string = (chunk?.choices?.[0]?.delta?.content || '');
              if (!token) continue;
              buffer += token;
              let newlineIndex = buffer.indexOf('\n');
              while (newlineIndex !== -1) {
                let line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                newlineIndex = buffer.indexOf('\n');
                if (!line) continue;
                if (pendingLine) { line = pendingLine + line; pendingLine = null; }
                try { JSON.parse(line); controller.enqueue(encoder.encode(line + '\n')); anyChunkSent = true; } catch { pendingLine = line; }
              }
            }
            if (pendingLine) {
              try { JSON.parse(pendingLine); controller.enqueue(encoder.encode(pendingLine + '\n')); anyChunkSent = true; } catch {}
            }
            controller.close();
          } catch (err) {
            if (!anyChunkSent && reservedForUserId && reservedCredits > 0) {
              try { await refundCredits(reservedForUserId, reservedCredits); } catch {}
            }
            if (!anyChunkSent) controller.error(err); else { try { controller.close(); } catch {} }
          }
        }
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }

    // Non-streaming JSON
    const prompt = constructFlashcardPromptFromText(
      extractedText || 'No text provided. Analyze the attached image(s) only and build flashcards from their content.',
      promptText,
      undefined,
      imageParts.length,
    );
    const userContent: any = imageParts.length > 0 ? [{ type: 'text', text: prompt }, ...imageParts] : prompt;
    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      // @ts-ignore
      reasoning_effort: 'none',
      messages: [{ role: 'user', content: userContent }],
      stream: false,
      // @ts-ignore
      response_format: { type: 'json_object' },
    });
    const content = completion.choices?.[0]?.message?.content ?? '';
    if (!content) return NextResponse.json({ error: 'No content returned from model' }, { status: 502 });
    const parsed = extractJsonObject(content);
    const cards: Flashcard[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
    if (cards.length === 0) return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 502 });
    return NextResponse.json({ title: parsed.title || null, cards });
  } catch (error) {
    console.error('Error in generate-flashcards API:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'An internal server error occurred.', details: message }, { status: 500 });
  }
}
