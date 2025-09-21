create table if not exists public.public_shares (
    id uuid primary key default gen_random_uuid(),
    share_id text not null unique,
    user_id uuid references auth.users(id) on delete cascade,
    item_type text not null check (item_type in ('mindmap', 'flashcards')),
    item_id uuid not null,
    title text,
    markdown text,
    cards jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists public_shares_item_unique on public.public_shares (item_type, item_id);

alter table public.public_shares enable row level security;
