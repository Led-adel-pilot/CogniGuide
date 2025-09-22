import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import ShareViewer from '@/components/ShareViewer';
import { verifyShareToken } from '@/lib/share-links';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

type ViewerContext = {
  client: SupabaseClient | null;
  userId: string | null;
};

type SharedFlashcard = { question: string; answer: string };

async function getViewerContext(): Promise<ViewerContext> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { client: null, userId: null };
  }

  try {
    const cookieStore = cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          // noop in server components
        },
        remove(_name: string, _options: CookieOptions) {
          // noop in server components
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;

    if (!userId) {
      return { client: null, userId: null };
    }

    return { client: supabase, userId };
  } catch (error) {
    console.error('Failed to resolve viewer context for shared resource:', error);
    return { client: null, userId: null };
  }
}

async function saveSharedMindmapForViewer(
  viewer: ViewerContext,
  resource: { markdown: string; title: string | null; ownerId: string | null }
): Promise<void> {
  const { client, userId } = viewer;
  if (!client || !userId) return;
  if (!resource.markdown) return;
  if (resource.ownerId && resource.ownerId === userId) return;

  const { data: existing } = await client
    .from('mindmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('markdown', resource.markdown)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return;
  }

  const { error: insertError } = await client
    .from('mindmaps')
    .insert({
      user_id: userId,
      title: resource.title,
      markdown: resource.markdown,
    });

  if (insertError) {
    console.error('Failed to save shared mind map for viewer:', insertError);
  }
}

async function saveSharedFlashcardsForViewer(
  viewer: ViewerContext,
  resource: { cards: SharedFlashcard[]; title: string | null; ownerId: string | null; markdown: string | null }
): Promise<string | null> {
  const { client, userId } = viewer;
  if (!client || !userId) return null;
  if (resource.cards.length === 0) return null;
  if (resource.ownerId && resource.ownerId === userId) return null;

  const { data: existing } = await client
    .from('flashcards')
    .select('id')
    .eq('user_id', userId)
    .eq('cards', resource.cards)
    .limit(1)
    .maybeSingle();

  if (existing?.id && typeof existing.id === 'string') {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await client
    .from('flashcards')
    .insert({
      user_id: userId,
      title: resource.title,
      cards: resource.cards,
      markdown: resource.markdown ?? '',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to save shared flashcards for viewer:', insertError);
    return null;
  }

  const newId = typeof inserted?.id === 'string' ? inserted.id : null;
  return newId;
}

type SharePageProps = {
  params: { type: string; token: string };
};

export default async function SharePage({ params }: SharePageProps) {
  const { type, token } = params;
  if (type !== 'mindmap' && type !== 'flashcards') {
    notFound();
  }

  if (!supabaseAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Sharing Unavailable</h1>
          <p className="text-muted-foreground text-sm">
            Public sharing is not configured for this deployment.
          </p>
        </div>
      </div>
    );
  }

  const decoded = verifyShareToken(token);
  if (!decoded || decoded.type !== type) {
    notFound();
  }

  const table = decoded.type === 'mindmap' ? 'mindmaps' : 'flashcards';
  const columns = decoded.type === 'mindmap'
    ? 'markdown, title, created_at, user_id'
    : 'cards, title, created_at, markdown, user_id';

  const { data } = await supabaseAdmin
    .from(table)
    .select(columns)
    .eq('id', decoded.id)
    .single();

  if (!data) {
    notFound();
  }

  if (decoded.type === 'mindmap') {
    const record = data as Record<string, unknown>;
    const markdown = record.markdown;
    if (typeof markdown !== 'string' || markdown.length === 0) {
      notFound();
    }
    const title = typeof record.title === 'string' || record.title === null ? record.title : null;
    const ownerId = typeof record.user_id === 'string' ? record.user_id : null;
    const viewer = await getViewerContext();
    await saveSharedMindmapForViewer(viewer, { markdown, title, ownerId });
    return <ShareViewer type="mindmap" markdown={markdown} title={title} />;
  }

  const record = data as Record<string, unknown>;
  let cardsData = record.cards;
  if (typeof cardsData === 'string') {
    try {
      cardsData = JSON.parse(cardsData);
    } catch {
      cardsData = [];
    }
  }

  const cards = Array.isArray(cardsData) ? (cardsData as unknown[]) : [];
  const safeCards = cards.filter((card): card is SharedFlashcard => {
    if (typeof card !== 'object' || card === null) return false;
    const value = card as Record<string, unknown>;
    return typeof value.question === 'string' && typeof value.answer === 'string';
  });
  const title = typeof record.title === 'string' || record.title === null ? record.title : null;
  const markdown = typeof record.markdown === 'string' ? record.markdown : '';
  const ownerId = typeof record.user_id === 'string' ? record.user_id : null;
  const viewer = await getViewerContext();
  const viewerDeckId = await saveSharedFlashcardsForViewer(viewer, {
    cards: safeCards,
    title,
    ownerId,
    markdown,
  });

  const deckIdForViewer = viewerDeckId ?? decoded.id;

  return <ShareViewer type="flashcards" cards={safeCards} title={title} deckId={deckIdForViewer} />;
}
