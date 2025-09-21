import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import EmbeddedMindMap from '@/components/EmbeddedMindMap';
import CogniGuideLogo from '../../../CogniGuide_logo.png';

export const dynamic = 'force-dynamic';

type SharedFlashcard = { question: string; answer: string };

type ShareRecord = {
  item_type: 'mindmap' | 'flashcards';
  title: string | null;
  markdown: string | null;
  cards: SharedFlashcard[] | null;
  created_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function getShareRecord(shareId: string): Promise<ShareRecord | null> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabaseAdmin
    .from('public_shares')
    .select('item_type, title, markdown, cards, created_at')
    .eq('share_id', shareId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to load share record:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return data as ShareRecord;
}

function formatShareTitle(record: ShareRecord): string {
  if (record.title && record.title.trim().length > 0) {
    return record.title.trim();
  }
  return record.item_type === 'mindmap' ? 'Mind map' : 'Flashcards';
}

function FlashcardsList({ cards }: { cards: SharedFlashcard[] }) {
  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/40 p-8 text-center text-sm text-muted-foreground">
        No flashcards to display.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card, index) => (
        <div key={`${index}-${card.question.slice(0, 12)}`} className="rounded-2xl border bg-background p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question {index + 1}
          </div>
          <h3 className="mt-2 text-base font-semibold text-foreground whitespace-pre-wrap">{card.question}</h3>
          <div className="mt-4 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
            {card.answer}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SharePage({ params }: { params: { shareId: string } }) {
  const record = await getShareRecord(params.shareId);
  if (!record) {
    notFound();
  }

  const title = formatShareTitle(record);
  const createdAt = record.created_at ? new Date(record.created_at) : null;

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-foreground">
            <Image src={CogniGuideLogo} alt="CogniGuide" width={40} height={40} className="h-10 w-10" />
            <span className="text-xl font-semibold">CogniGuide</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gradient-primary-hover"
          >
            Try CogniGuide for free
          </Link>
        </header>

        <div className="rounded-3xl border bg-background/95 p-6 shadow-xl sm:p-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              {createdAt && (
                <p className="text-sm text-muted-foreground">
                  Shared on {createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              {record.item_type === 'mindmap' ? 'Mind Map' : 'Flashcards'}
            </span>
          </div>

          <div className="mt-8">
            {record.item_type === 'mindmap' ? (
              <div className="h-[540px] w-full overflow-hidden rounded-2xl border bg-muted/30 p-4">
                {record.markdown ? (
                  <EmbeddedMindMap markdown={record.markdown} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Mind map content is unavailable.
                  </div>
                )}
              </div>
            ) : (
              <FlashcardsList cards={record.cards ?? []} />
            )}
          </div>
        </div>

        <footer className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <p>Powered by CogniGuide — create mind maps and flashcards in seconds.</p>
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Start your own study session
          </Link>
        </footer>
      </div>
    </div>
  );
}
