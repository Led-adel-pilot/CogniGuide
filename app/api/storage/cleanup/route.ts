import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: 'No paths provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage.from('uploads').remove(paths);
    if (error) {
      console.error('Cleanup error:', error);
      // Don't fail the request, just log the error
      return NextResponse.json({ deleted: 0, error: error.message });
    }

    return NextResponse.json({ deleted: data?.length || 0 });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ error: 'Cleanup failed', deleted: 0 }, { status: 500 });
  }
}
