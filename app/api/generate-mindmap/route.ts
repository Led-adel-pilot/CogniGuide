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
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const promptText = formData.get('prompt') as string | null;

    let documentText = '';
    const extractedTexts: string[] = [];
    const imageParts: { type: 'image_url'; image_url: { url: string } }[] = [];
    let totalRawChars = 0;

    if (files.length > 0) {
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
            // Skip text extraction for images; they will be provided to the model directly
            continue;
          } catch (e) {
            console.warn(`Failed to process image file: ${file.name}`);
            continue;
          }
        } else {
          // Silently ignore unsupported files for now, or collect errors
          console.warn(`Unsupported file type skipped: ${file.name} (${file.type})`);
          continue;
        }
        if (text) totalRawChars += text.length;
        extractedTexts.push(`--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---`);
      }
      documentText = extractedTexts.join('\n\n');
    }

    const textToProcess = documentText || promptText;
    if (promptText) totalRawChars += promptText.length;

    if (!textToProcess && imageParts.length === 0) {
      return NextResponse.json({ error: 'No content provided. Please upload a file (document or image) or enter a text prompt.' }, { status: 400 });
    }

    // Build a multimodal-friendly prompt that also mentions images if provided
    const multimodalPreamble = imageParts.length > 0
      ? `In addition to any text provided below, you are also given ${imageParts.length} image(s). Carefully read text inside the images (OCR) and analyze diagrams to extract key concepts and relationships. Integrate insights from both text and images into a single coherent mind map.`
      : '';

    const finalPrompt = constructPrompt(
      textToProcess || 'No text provided. Analyze the attached image(s) only and build the mind map from their content.',
      promptText || ''
    ) + (multimodalPreamble ? `\n\n${multimodalPreamble}` : '');

    // Compute and reserve credits: 1 credit = 3800 characters (fractional allowed)
    const ONE_CREDIT_CHARS = 3800;
    const creditsRaw = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
    let creditsNeeded = creditsRaw;
    const isPromptOnly = (files.length === 0) && (imageParts.length === 0) && !!(promptText && promptText.trim().length > 0);
    // Enforce minimum credit for: image-only requests (0.5) OR prompt-only requests with short text (1)
    if (imageParts.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
    if (isPromptOnly && creditsNeeded < 1) creditsNeeded = 1;

    const userId = await getUserIdFromAuthHeader(req);
    // Provision monthly free credits (8) for non-subscribers before any deduction
    if (userId) {
      try { await ensureFreeMonthlyCredits(userId); } catch {}
    }
    if (userId && creditsNeeded > 0) {
      const ok = await deductCredits(userId, creditsNeeded);
      if (!ok) {
        return NextResponse.json({ error: 'Insufficient credits. Please upgrade your plan or top up.' }, { status: 402 });
      }
    }

    // Stream tokens back to the client as they arrive
    const encoder = new TextEncoder();
    const userContent: any = imageParts.length > 0
      ? [{ type: 'text', text: finalPrompt }, ...imageParts]
      : finalPrompt;

    const stream = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      // @ts-ignore
      reasoning_effort: 'none',
      messages: [{ role: 'user', content: userContent }],
      stream: true,
    });

    let anyTokenSent = false;
    const reservedForUserId = userId || null;
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
          // If streaming failed before sending anything, fall back to error JSON
          if (!anyTokenSent) {
            if (reservedForUserId && reservedCredits > 0) {
              try { await refundCredits(reservedForUserId, reservedCredits); } catch {}
            }
            controller.error(err);
          } else {
            // If some data was already sent, just close the stream
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

  } catch (error) {
    console.error('Error in generate-mindmap API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}
