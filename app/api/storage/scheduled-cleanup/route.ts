import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const { data: files, error } = await supabaseAdmin.storage.from('uploads').list();
    if (error) {
      console.error('List files error:', error);
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No files to clean' });
    }

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24); // Delete files older than 24 hours

    const oldFiles = files.filter(file => {
      const fileDate = new Date(file.created_at);
      return fileDate < cutoff;
    });

    if (oldFiles.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No old files to clean' });
    }

    const filesToDelete = oldFiles.map(file => file.name);
    const { data, error: deleteError } = await supabaseAdmin.storage.from('uploads').remove(filesToDelete);

    if (deleteError) {
      console.error('Delete files error:', deleteError);
      return NextResponse.json({
        error: 'Failed to delete files',
        deleted: 0,
        attempted: filesToDelete.length
      }, { status: 500 });
    }

    console.log(`Scheduled cleanup: deleted ${data?.length || 0} files older than 24 hours`);
    return NextResponse.json({
      deleted: data?.length || 0,
      attempted: filesToDelete.length
    });
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
    return NextResponse.json({ error: 'Scheduled cleanup failed', deleted: 0 }, { status: 500 });
  }
}
