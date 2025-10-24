alter table public.flashcards
  add column if not exists mindmap_id uuid references public.mindmaps (id) on delete set null;

create index if not exists flashcards_mindmap_id_idx
  on public.flashcards (mindmap_id);

comment on column public.flashcards.mindmap_id is 'Linked mind map identifier generated from the same deck.';
