import { NextRequest, NextResponse } from 'next/server';
import { getTextFromDocx, getTextFromPdf, getTextFromPptx } from '@/lib/document-parser';
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

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data with files' }, { status: 400 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    const isNonAuthUser = !userId;

    const extractedParts: string[] = [];
    const imageDataUrls: string[] = [];
    let totalRawChars = 0;

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      let text = '';
      if (file.type === 'application/pdf') {
        text = await getTextFromPdf(buffer, isNonAuthUser);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await getTextFromDocx(buffer, isNonAuthUser);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        text = await getTextFromPptx(buffer, isNonAuthUser);
      } else if (file.type === 'text/plain') {
        text = buffer.toString('utf-8');
      } else if (
        file.type === 'text/markdown' ||
        file.name.toLowerCase().endsWith('.md') ||
        file.name.toLowerCase().endsWith('.markdown')
      ) {
        text = buffer.toString('utf-8');
      } else if (file.type.startsWith('image/')) {
        try {
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${file.type};base64,${base64}`;
          imageDataUrls.push(dataUrl);
          continue;
        } catch {
          continue;
        }
      } else {
        // Unsupported type; skip
        continue;
      }
      if (text) totalRawChars += text.length;
      extractedParts.push(`--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---`);
    }

    const textCombined = extractedParts.join('\n\n');
    return NextResponse.json({
      text: textCombined,
      images: imageDataUrls,
      totalRawChars,
    });
  } catch (error) {
    console.error('Error in preparse API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to pre-parse files.', details: errorMessage }, { status: 500 });
  }
}


