import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function getUserIdFromAuthHeader(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || !supabaseAdmin) return null;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
        console.error('Error getting user from token:', error.message);
        return null;
    }
    return data.user?.id || null;
  } catch(e) {
    if (e instanceof Error) console.error('Exception in getUserIdFromAuthHeader:', e.message);
    return null;
  }
}

function yyyymmdd() {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'unnamed_file';
  }

  // Normalize path separators and extract filename
  const normalized = name.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const filename = parts.length > 0 ? parts[parts.length - 1] : 'unnamed_file';

  // Remove or replace invalid characters, preserve extension
  const sanitized = filename.replace(/[^A-Za-z0-9._-]/g, '_');

  // Ensure result is not empty and has reasonable length
  if (!sanitized || sanitized.length === 0) {
    return 'unnamed_file';
  }

  // Limit length to prevent filesystem issues
  return sanitized.length > 100 ? sanitized.slice(0, 97) + '...' : sanitized;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server storage is not configured' }, { status: 500 });
    }
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Expected application/json' }, { status: 400 });
    }
    const body = await req.json();
    const files = Array.isArray(body?.files) ? body.files as Array<{ name: string; size: number; type?: string; key?: string }> : [];
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    const anonId = typeof body?.anonId === 'string' && body.anonId.trim().length > 0 ? body.anonId.trim() : null;
    const userId = await getUserIdFromAuthHeader(req);
    const ownerPrefix = userId ? `users/${userId}` : (anonId ? `anon/${anonId}` : `anon/${Date.now().toString(36)}`);

    const bucket = 'uploads';
    const dateDir = yyyymmdd();

    const items: { path: string; signedUrl: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const safeName = sanitizeFileName(String(f.name || `file-${i}`));

      // Use the key as-is if it's already safe, otherwise generate a new one
      let baseKey = (typeof f.key === 'string' && f.key && /^[A-Za-z0-9._-]+$/.test(f.key))
        ? f.key
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      // Additional sanitization as fallback
      baseKey = baseKey.replace(/[^A-Za-z0-9._-]/g, '_');

      let path = `${ownerPrefix}/${dateDir}/${baseKey}/${safeName}`;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);

        if (error) {
          // Handle "resource already exists" by generating a new unique suffix
          if (error.message?.includes('already exists') || error.message?.includes('resource already exists')) {
            if (attempts < maxAttempts - 1) {
              // Generate a new unique suffix and retry
              const uniqueSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
              baseKey = `${baseKey}_${uniqueSuffix}`;
              path = `${ownerPrefix}/${dateDir}/${baseKey}/${safeName}`;
              attempts++;
              continue;
            } else {
              return NextResponse.json({
                error: `Failed to create unique signed URL for ${safeName} after ${maxAttempts} attempts`
              }, { status: 500 });
            }
          } else {
            // Other error types
            return NextResponse.json({
              error: `Failed to create signed URL for ${safeName}: ${error.message}`
            }, { status: 500 });
          }
        }

        if (data) {
          items.push({ path, signedUrl: data.signedUrl });
          break;
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        return NextResponse.json({
          error: `Failed to create signed URL for ${safeName} after ${maxAttempts} attempts`
        }, { status: 500 });
      }
    }

    return NextResponse.json({ bucket, items });
  } catch (error) {
    console.error('Error creating signed upload URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

    // Provide more specific error messages for common issues
    let userFriendlyError = 'Failed to create signed upload URLs.';
    if (errorMessage.includes('already exists')) {
      userFriendlyError = 'File upload conflict detected. Please try again.';
    } else if (errorMessage.includes('storage')) {
      userFriendlyError = 'Storage service temporarily unavailable. Please try again later.';
    } else if (errorMessage.includes('permission') || errorMessage.includes('authorization')) {
      userFriendlyError = 'Upload permission denied. Please check your authentication.';
    }

    return NextResponse.json({
      error: userFriendlyError,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}


