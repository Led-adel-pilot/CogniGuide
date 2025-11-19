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

    const bucket = supabaseAdmin.storage.from('uploads');

    const files = await listFilesRecursively(bucket);

    if (files.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No files to clean' });
    }

    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - 5); // Delete files older than 5 minutes

    const filesToDelete = files
      .filter(file => {
        const fileDate = getFileTimestamp(file);
        return fileDate ? fileDate < cutoff : false;
      })
      .map(file => file.path);

    if (filesToDelete.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No old files to clean' });
    }

    const { data, error: deleteError } = await bucket.remove(filesToDelete);

    if (deleteError) {
      console.error('Delete files error:', deleteError);
      return NextResponse.json({
        error: 'Failed to delete files',
        deleted: 0,
        attempted: filesToDelete.length
      }, { status: 500 });
    }

    const deletedCount = data?.length || 0;
    console.log(`Scheduled cleanup: deleted ${deletedCount} files older than 24 hours`);
    return NextResponse.json({
      deleted: deletedCount,
      attempted: filesToDelete.length
    });
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
    return NextResponse.json({ error: 'Scheduled cleanup failed', deleted: 0 }, { status: 500 });
  }
}

type StorageBucketClient = ReturnType<NonNullable<typeof supabaseAdmin>['storage']['from']>;

type ListResponse = Awaited<ReturnType<StorageBucketClient['list']>>;

type StorageFileObject = NonNullable<ListResponse['data']>[number];

type FileWithPath = StorageFileObject & { path: string };

async function listFilesRecursively(bucket: StorageBucketClient): Promise<FileWithPath[]> {
  const queue: string[] = [''];
  const seenPrefixes = new Set<string>(queue);
  const results: FileWithPath[] = [];

  while (queue.length > 0) {
    const prefix = queue.shift()!;
    let offset = 0;
    const limit = 100;

    while (true) {
      const listPrefix = prefix === '' ? undefined : prefix;
      const { data, error } = await bucket.list(listPrefix, { limit, offset });
      if (error) {
        console.error('List files error:', error, 'prefix:', prefix, 'offset:', offset);
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const file of data) {
        if (!file.name) {
          continue;
        }

        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        const normalizedPath = fullPath.replace(/^\/+/, '');

        if (!file.metadata) {
          // Directory placeholder - continue traversing.
          const normalizedDirectory = normalizedPath.replace(/\/+$/, '');
          if (!seenPrefixes.has(normalizedDirectory)) {
            seenPrefixes.add(normalizedDirectory);
            queue.push(normalizedDirectory);
          }
          continue;
        }

        results.push({ ...file, path: normalizedPath });
      }

      if (data.length < limit) {
        break;
      }

      offset += limit;
    }
  }

  return results;
}

function getFileTimestamp(file: StorageFileObject): Date | null {
  const timestamp = file.last_accessed_at || file.updated_at || file.created_at;

  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
