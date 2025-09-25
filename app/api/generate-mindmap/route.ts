import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx, getTextFromPlainText, processMultipleFiles } from '@/lib/document-parser';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
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

// --- Prompt Engineering ---
function constructPrompt(text: string, userInstruction: string): string {
    const basePrompt = `
Your task is to analyze the provided text and generate a mind map in Markmap Markdown format.

### Core Structure

*   **Central Topic:** Start with a Level 1 Heading (#).
*   **Main Branches:** NEVER make only one main branch. Use first-level bullet points (-) for the primary ideas radiating from the center. These should never not have sub-branches. EVERY main branch MUST HAVE sub-branches.
*   **Sub-Branches:** Use nested/indented bullet points to represent sub-topics and details, creating a clear hierarchy.
*   **Avoid long Sentences:** Mainly use concise phrases for each bullet point. Avoid lengthy sentences to maximize clarity and associative power.

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

    async function respondWithStream(opts: { text: string; prompt: string; images: string[]; userId: string | null; rawCharCount?: number }) {
      const { text, prompt, images, userId, rawCharCount } = opts;
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

      // Credits - use rawCharCount if provided (file-based), otherwise calculate from text
      const ONE_CREDIT_CHARS = 3800;
      const totalRawChars = rawCharCount !== undefined 
        ? rawCharCount // exclude prompt length for file-based billing
        : (text?.length || 0) + (prompt?.length || 0);
      let creditsNeeded = totalRawChars > 0 ? (totalRawChars / ONE_CREDIT_CHARS) : 0;
      const isPromptOnly = (!text && images.length === 0 && !!(prompt && prompt.trim().length > 0));
      if (images.length > 0 && creditsNeeded < 0.5) creditsNeeded = 0.5;
      if (isPromptOnly && creditsNeeded < 1) creditsNeeded = 1;

      const userIdResolved = userId || await getUserIdFromAuthHeader(req);
      if (userIdResolved) {
        try {
          await ensureFreeMonthlyCredits(userIdResolved);
        } catch (creditError) {
          console.warn('Failed to ensure free monthly credits:', creditError);
          // Continue processing - don't fail the request for credit setup issues
        }
      }

      if (userIdResolved && creditsNeeded > 0) {
        const currentCredits = await getCurrentCredits(userIdResolved);
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

        const ok = await deductCredits(userIdResolved, creditsNeeded);
        if (!ok) {
          return NextResponse.json({
            error: 'Credit deduction failed',
            message: 'Failed to deduct credits from your account. Please try again.',
            code: 'CREDIT_DEDUCTION_ERROR'
          }, { status: 500 });
        }
      }

      const encoder = new TextEncoder();

      // Validate image URLs before sending to API (handle both signed URLs and base64 data URLs)
      const validImages = [];
      for (const url of images) {
        try {
          if (url.startsWith('data:')) {
            // Base64 data URLs are valid
            validImages.push(url);
          } else {
            // Validate signed URLs
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

      const imageParts = validImages.map((url) => ({ type: 'image_url', image_url: { url } }));
      const userContent: any = imageParts.length > 0 ? [{ type: 'text', text: finalPrompt }, ...imageParts] : finalPrompt;

      // Reserve credit information for potential refunds
      const reservedForUserId = userIdResolved || null;
      const reservedCredits = creditsNeeded;

      // Log the total text after truncation sent to LLM and its character count
      console.log('=== MINDMAP LLM INPUT ===');
      console.log('Character count:', finalPrompt.length);
      console.log('Text content preview:', finalPrompt.substring(0, 200) + (finalPrompt.length > 200 ? '...' : ''));
      console.log('=======================');

      let stream;
      try {
        stream = await openai.chat.completions.create({
          model: 'gemini-flash-lite-latest',
          // @ts-ignore
          reasoning_effort: 'low', // Reduce thinking time for faster responses
          messages: [{ role: 'user', content: userContent }],
          stream: true,
          stream_options: { include_usage: false }, // Reduce overhead
        });
      } catch (apiError) {
        console.error('OpenAI API error:', apiError);

        // Refund credits if API call fails
        if (reservedForUserId && reservedCredits > 0) {
          try {
            await refundCredits(reservedForUserId, reservedCredits);
          } catch (refundError) {
            console.error('Failed to refund credits:', refundError);
          }
        }

        if (apiError instanceof Error) {
          // Handle specific OpenAI errors
          if (apiError.message.includes('429') || apiError.message.includes('rate limit')) {
            return NextResponse.json({
              error: 'Service temporarily busy',
              message: 'The AI service is currently at capacity. Please wait a moment and try again.',
              code: 'API_RATE_LIMITED'
            }, { status: 429 });
          }

          if (apiError.message.includes('401') || apiError.message.includes('unauthorized')) {
            return NextResponse.json({
              error: 'Service authentication failed',
              message: 'Unable to authenticate with the AI service. Please try again later.',
              code: 'API_AUTH_ERROR'
            }, { status: 503 });
          }

          if (apiError.message.includes('400') || apiError.message.includes('bad request')) {
            return NextResponse.json({
              error: 'Invalid request',
              message: 'The request format is invalid. Please check your input and try again.',
              code: 'API_BAD_REQUEST'
            }, { status: 400 });
          }

          if (apiError.message.includes('413') || apiError.message.includes('payload too large')) {
            return NextResponse.json({
              error: 'Content too large',
              message: 'The content is too large for processing. Please try with smaller files or shorter text.',
              code: 'API_PAYLOAD_TOO_LARGE'
            }, { status: 413 });
          }

          if (apiError.message.includes('500') || apiError.message.includes('502') || apiError.message.includes('503')) {
            return NextResponse.json({
              error: 'AI service unavailable',
              message: 'The AI service is temporarily unavailable. Please try again in a few minutes.',
              code: 'API_SERVICE_UNAVAILABLE'
            }, { status: 503 });
          }

          if (apiError.message.includes('content') && apiError.message.includes('policy')) {
            return NextResponse.json({
              error: 'Content policy violation',
              message: 'The content violates the service\'s usage policy. Please modify your content and try again.',
              code: 'API_CONTENT_POLICY'
            }, { status: 400 });
          }
        }

        // Generic API error
        return NextResponse.json({
          error: 'AI service error',
          message: 'Failed to process your request with the AI service. Please try again.',
          code: 'API_ERROR'
        }, { status: 503 });
      }
      let anyTokenSent = false;

      // Extract file paths from images for cleanup (only for signed URLs, not base64 data URLs)
      const filesToCleanup: string[] = [];
      if (images.length > 0) {
        images.forEach(url => {
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
            for await (const chunk of stream as any) {
              const token: string = chunk?.choices?.[0]?.delta?.content || '';
              if (!token) continue;
              anyTokenSent = true;
              controller.enqueue(encoder.encode(token));
            }
            controller.close();

            // Cleanup files after successful streaming
            if (filesToCleanup.length > 0 && anyTokenSent) {
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

            if (!anyTokenSent) {
              // If no tokens were sent, refund credits and return error response
              if (reservedForUserId && reservedCredits > 0) {
                try {
                  await refundCredits(reservedForUserId, reservedCredits);
                  console.log(`Refunded ${reservedCredits} credits due to streaming failure`);
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
              // If some tokens were sent, just close the stream gracefully
              try { controller.close(); } catch {}
            }
          }
        }
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }

    if (contentType.includes('application/json')) {
      let body: { text?: string; images?: string[]; prompt?: string } | null = null;

      try {
        body = await req.json() as { text?: string; images?: string[]; prompt?: string } | null;
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

      const text = (body.text || '').toString();
      const prompt = (body.prompt || '').toString();
      const images = Array.isArray(body.images) ? body.images.filter(img => typeof img === 'string') : [];

      // Validate input
      if (!text && !prompt && images.length === 0) {
        return NextResponse.json({
          error: 'No content provided',
          message: 'Please provide text content, a prompt, or image URLs to process.',
          code: 'NO_CONTENT'
        }, { status: 400 });
      }

      const userId = await getUserIdFromAuthHeader(req);
      return await respondWithStream({ text, prompt, images, userId });
    }

    // Fallback: multipart (legacy)
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

    // Validate files
    if (files.length === 0 && !promptText.trim()) {
      return NextResponse.json({
        error: 'No files or prompt provided',
        message: 'Please upload at least one file or provide a text prompt.',
        code: 'NO_FILES_NO_PROMPT'
      }, { status: 400 });
    }
    const extractedTexts: string[] = [];
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

    const combined = result.extractedParts.join('\n\n');
    const images = result.imageDataUrls;
    return await respondWithStream({ text: combined, prompt: promptText, images, userId: userId, rawCharCount: result.totalRawChars });

  } catch (error) {
    console.error('Error in generate-mindmap API:', error);

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
