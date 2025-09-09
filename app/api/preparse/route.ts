import { NextRequest, NextResponse } from 'next/server';
import { processMultipleFiles, MultiFileProcessResult } from '@/lib/document-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// In-memory cache for user tiers (userId -> { tier, expiresAt })
const userTierCache = new Map<string, { tier: 'free' | 'paid'; expiresAt: number }>();
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || !supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
        console.error('Error getting user from token in preparse:', error.message);
        return null;
    }
    return data.user?.id || null;
  } catch(e) {
    if (e instanceof Error) console.error('Exception in getUserIdFromAuthHeader in preparse:', e.message);
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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const userId = await getUserIdFromAuthHeader(req);
    const userTier = await getUserTier(userId);

    // JSON path: { bucket, objects: [{ path, name?, type?, size? }] }
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null) as any;
      const bucket = typeof body?.bucket === 'string' ? body.bucket : 'uploads';
      const objects = Array.isArray(body?.objects) ? body.objects as Array<{ path: string; name?: string; type?: string; size?: number }> : [];
      if (!objects || objects.length === 0) {
        return NextResponse.json({ error: 'No objects provided' }, { status: 400 });
      }
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Storage not configured. The SUPABASE_SERVICE_ROLE_KEY is likely missing.' }, { status: 500 });
      }

      const pseudoFiles: File[] = [] as any;
      const imageUrls: string[] = [];

      for (const obj of objects) {
        const path = obj.path;
        const name = obj.name || path.split('/')?.pop() || 'file';
        const type = obj.type || 'application/octet-stream';

        // For images, avoid downloading and return a signed URL to keep response size small
        if (type.startsWith('image/')) {
          const { data: signed, error: signErr } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 30);
          if (!signErr && signed?.signedUrl) {
            imageUrls.push(signed.signedUrl);
          }
          continue;
        }

        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error || !data) {
          continue;
        }
        const blob = data as Blob;
        const arrayBuf = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const size = typeof obj.size === 'number' ? obj.size : (blob as any)?.size || buffer.byteLength;

        // Create a minimal File-like object with required fields used by processMultipleFiles
        const fileLike: any = {
          name,
          type,
          size,
          arrayBuffer: async () => buffer,
        };
        (pseudoFiles as any).push(fileLike);
      }

      // Process text/doc files via existing logic
      const result = await processMultipleFiles(pseudoFiles as any, userTier);
      const textCombined = result.extractedParts.join('\n\n');

      // Merge in image URLs gathered above
      const allImages = [...imageUrls, ...result.imageDataUrls];

      return NextResponse.json({
        text: textCombined,
        images: allImages,
        totalRawChars: result.totalRawChars,
        maxChars: result.maxChars,
        limitExceeded: result.limitExceeded,
        includedFiles: result.includedFiles,
        excludedFiles: result.excludedFiles,
        partialFile: result.partialFile || null,
        isAuthed: userTier !== 'non-auth',
      });
    }

    // Multipart path (legacy small uploads)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];
      if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
      }

      const result = await processMultipleFiles(files, userTier);
      const textCombined = result.extractedParts.join('\n\n');
      return NextResponse.json({
        text: textCombined,
        images: result.imageDataUrls,
        totalRawChars: result.totalRawChars,
        maxChars: result.maxChars,
        limitExceeded: result.limitExceeded,
        includedFiles: result.includedFiles,
        excludedFiles: result.excludedFiles,
        partialFile: result.partialFile || null,
        isAuthed: userTier !== 'non-auth',
      });
    }

    return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 });
  } catch (error) {
    console.error('Error in preparse API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to pre-parse files.', details: errorMessage }, { status: 500 });
  }
}


