alter table public.flashcards
  add column if not exists explanations jsonb not null default '{}'::jsonb;

comment on column public.flashcards.explanations is
  'Persisted AI explanations keyed by card index and scoped to each deck.';
