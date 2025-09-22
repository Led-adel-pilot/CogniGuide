import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ShareViewer from '@/components/ShareViewer';
import { verifyShareToken } from '@/lib/share-links';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
    ? 'markdown, title, created_at'
    : 'cards, title, created_at';

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
  const safeCards = cards.filter((card): card is { question: string; answer: string } => {
    if (typeof card !== 'object' || card === null) return false;
    const value = card as Record<string, unknown>;
    return typeof value.question === 'string' && typeof value.answer === 'string';
  });
  const title = typeof record.title === 'string' || record.title === null ? record.title : null;

  return <ShareViewer type="flashcards" cards={safeCards} title={title} deckId={decoded.id} />;
}
