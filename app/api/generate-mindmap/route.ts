import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx } from '@/lib/document-parser';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
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
  // Skip if user currently has an active subscription (paid tiers provision via webhook)
  try {
    const active = await hasActiveSubscription(userId);
    if (active) return;
  } catch {}

  // Ensure a user_credits row exists and is refilled to 8 once per calendar month
  const { data } = await supabaseAdmin
    .from('user_credits')
    .select('credits, last_refilled_at')
    .eq('user_id', userId)
    .single();

  const nowIso = new Date().toISOString();
  if (!data) {
    await supabaseAdmin.from('user_credits').insert({
      user_id: userId,
      credits: 8,
      last_refilled_at: nowIso,
    });
    return;
  }
  const last = data.last_refilled_at ? new Date(data.last_refilled_at) : null;
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

// --- Prompt Engineering ---
function constructPrompt(text: string, userInstruction: string): string {
    const basePrompt = `
Your task is to analyze the provided text and generate a mind map in Markmap Markdown format.

### Core Structure

*   **Central Topic:** Start with a Level 1 Heading (#).
*   **Main Branches:** Use first-level bullet points (-) for the primary ideas radiating from the center. These should never not have sub-branches. These should be multiple.
*   **Sub-Branches:** Use nested/indented bullet points to represent sub-topics and details, creating a clear hierarchy.
*   **Avoid long Sentences:** Mainly use concise phrases for each bullet point. Avoid lengthy sentences to maximize clarity and associative power.

### Psychological Enhancements

*   **Use Emojis as Visual Cues:** Add emojis to branches to visually categorize themes, add emphasis, and improve recall, mimicking the use of color and images.

The mind map MUST be in the same language as the content.
The output MUST be ONLY the Markdown code compatible with Markmap. Do not include any other text, explanations, or code fences like \`\`\`markdown.

`;

    const instructionSection = userInstruction
        ? `**User's custom instruction:** "${userInstruction}"`
        : '';

    return `
${basePrompt}
${instructionSection}

**Text to Analyze:**
---
${text}
---
`;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    async function respondWithStream(opts: { text: string; prompt: string; images: string[]; userId: string | null }) {
      const { text, prompt, images, userId } = opts;
      const multimodalPreamble = images.length > 0
        ? `In addition to any text provided below, you are also given ${images.length} image(s). Carefully read text inside the images (OCR) and analyze diagrams to extract key concepts and relationships. Integrate insights from both text and images into a single coherent mind map.`
        : '';
      const textToProcess = text || prompt;
      if (!textToProcess && images.length === 0) {
        return NextResponse.json({ error: 'No content provided. Please upload a file (document or image) or enter a text prompt.' }, { status: 400 });
      }
      const finalPrompt = constructPrompt(
        textToProcess || 'No text provided. Analyze the attached image(s) only and build the mind map from their content.',
        prompt || ''
      ) + (multimodalPreamble ? `\n\n${multimodalPreamble}` : '');

      // Credits
      const ONE_CREDIT_CHARS = 3800;
      const totalRawChars = (text?.length || 0) + (prompt?.length || 0);
      let creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
      const isPromptOnly = (!text && images.length === 0 && !!(prompt && prompt.trim().length > 0));
      if (images.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
      if (isPromptOnly && creditsNeeded < 1) creditsNeeded = 1;

      const userIdResolved = userId || await getUserIdFromAuthHeader(req);
      if (userIdResolved) { try { await ensureFreeMonthlyCredits(userIdResolved); } catch {} }
      if (userIdResolved && creditsNeeded > 0) {
        const ok = await deductCredits(userIdResolved, creditsNeeded);
        if (!ok) return NextResponse.json({ error: 'Insufficient credits. Upload a smaller file or' }, { status: 402 });
      }

      const encoder = new TextEncoder();
      const imageParts = images.map((url) => ({ type: 'image_url', image_url: { url } }));
      const userContent: any = imageParts.length > 0 ? [{ type: 'text', text: finalPrompt }, ...imageParts] : finalPrompt;
      const stream = await openai.chat.completions.create({
        model: 'gemini-2.5-flash-lite',
        // @ts-ignore
        reasoning_effort: 'none',
        messages: [{ role: 'user', content: userContent }],
        stream: true,
      });
      let anyTokenSent = false;
      const reservedForUserId = userIdResolved || null;
      const reservedCredits = creditsNeeded;
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream as any) {
              const token: string = chunk?.choices?.[0]?.delta?.content || '';
              if (!token) continue;
              anyTokenSent = true;
              controller.enqueue(encoder.encode(token));
            }
            controller.close();
          } catch (err) {
            if (!anyTokenSent) {
              if (reservedForUserId && reservedCredits > 0) {
                try { await refundCredits(reservedForUserId, reservedCredits); } catch {}
              }
              controller.error(err);
            } else {
              try { controller.close(); } catch {}
            }
          }
        }
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null) as { text?: string; images?: string[]; prompt?: string } | null;
      const text = (body?.text || '').toString();
      const prompt = (body?.prompt || '').toString();
      const images = Array.isArray(body?.images) ? (body!.images as string[]) : [];
      const userId = await getUserIdFromAuthHeader(req);
      return await respondWithStream({ text, prompt, images, userId });
    }

    // Fallback: multipart (legacy)
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const promptText = (formData.get('prompt') as string | null) || '';
    const images: string[] = [];
    const extractedTexts: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type.startsWith('image/')) {
        try {
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${file.type};base64,${base64}`;
          images.push(dataUrl);
          continue;
        } catch { continue; }
      }
      let text = '';
      if (file.type === 'application/pdf') text = await getTextFromPdf(buffer);
      else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') text = await getTextFromDocx(buffer);
      else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') text = await getTextFromPptx(buffer);
      else if (file.type === 'text/plain') text = buffer.toString('utf-8');
      else if (file.type === 'text/markdown' || file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown')) text = buffer.toString('utf-8');
      else continue;
      extractedTexts.push(`--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---`);
    }
    const combined = extractedTexts.join('\n\n');
    const userId = await getUserIdFromAuthHeader(req);
    return await respondWithStream({ text: combined, prompt: promptText, images, userId });

  } catch (error) {
    console.error('Error in generate-mindmap API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}
