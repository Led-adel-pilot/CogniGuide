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
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id || null;
  } catch {
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
  return name.replace(/\\/g, '/').split('/').pop()!.replace(/[^A-Za-z0-9._-]/g, '_');
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

    const bucket = 'uploads';
    const dateDir = yyyymmdd();
    const ownerPrefix = userId ? `users/${userId}` : (anonId ? `anon/${anonId}` : `anon/${Date.now().toString(36)}`);

    const items: { path: string; token: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const safeName = sanitizeFileName(String(f.name || `file-${i}`));
      // Sanitize key strictly to avoid problematic URL characters (remove pipe "|")
      const key = (typeof f.key === 'string' && f.key)
        ? f.key.replace(/[^A-Za-z0-9._-]/g, '_')
        : Math.random().toString(36).slice(2);
      const path = `${ownerPrefix}/${dateDir}/${key}/${safeName}`;
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) {
        return NextResponse.json({ error: `Failed to create signed URL for ${safeName}` }, { status: 500 });
      }
      items.push({ path, token: data.token });
    }

    return NextResponse.json({ bucket, items });
  } catch (error) {
    console.error('Error creating signed upload URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to create signed upload URLs.', details: errorMessage }, { status: 500 });
  }
}


