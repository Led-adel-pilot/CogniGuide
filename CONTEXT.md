# CogniGuide Application Context

## 1. Technology Stack & Build System
- **Framework & Runtime**: The project is a Next.js 15.4 application running on React 19 with pnpm-managed workspaces. Key scripts expose Turbopack dev, production build, and lint commands.【F:package.json†L2-L57】
- **Client Libraries**: Core dependencies include Supabase for authentication/storage, OpenAI SDK (used with Gemini endpoints) for LLM streaming, PostHog analytics, TS-FSRS for spaced repetition, Mammoth/PDF-Parse/PPTX parsing utilities, React Markdown + remark-gfm for rendering, Radix UI primitives, and Tailwind merge helpers.【F:package.json†L11-L41】
- **Tooling**: ESLint 9 with the Next.js shareable config, Tailwind CSS v4 PostCSS tooling, TypeScript 5, and next-sitemap are configured for development workflows.【F:package.json†L43-L55】
- **CSS Optimization**: Tailwind now ships with an explicit `tailwind.config.js`/`tailwind.config.ts` bridge and production builds run PurgeCSS via `postcss.config.cjs` to strip unused utilities while respecting safelisted dynamic classes.【F:tailwind.config.js†L1-L17】【F:postcss.config.cjs†L1-L34】

## 2. Global Application Shell & Theming
- **Root Layout**: `app/layout.tsx` establishes global metadata (OpenGraph, Twitter, robots), structured data for a SoftwareApplication, Google verification, favicon links, and preconnects for PostHog assets. It injects an inline script that restores the saved theme before hydration and wraps the app in a Poppins font body with a modal root container.【F:app/layout.tsx†L1-L162】
- **Site Metadata**: Shared SEO text, URLs, contact email, and keyword arrays live in `lib/siteMetadata.ts` and are imported wherever metadata is constructed.【F:lib/siteMetadata.ts†L1-L23】
- **Theme Control**: `components/ThemeToggle.tsx` persists user theme selections in localStorage, synchronises the `<html>` `data-theme` attribute, listens for system preference changes, and renders a dropdown selector with Lucide icons.【F:components/ThemeToggle.tsx†L1-L129】

## 3. Routing & Page Modules
### 3.1 Home (`app/page.tsx` & `components/HomeLanding.tsx`)
- The root page is statically rendered and delegates to `HomeLanding`, extending metadata with study-focused keywords.【F:app/page.tsx†L1-L38】
- `HomeLanding` handles auth state, referral code persistence, and cookie mirroring for middleware via Supabase listeners. It dynamically loads Auth, Mind Map, and Flashcard demo modals while mounting the `Generator`, `EmbeddedMindMap`, and `EmbeddedFlashcards` immediately to prioritise fast-first interaction and lower bounce rates on the marketing surface.【F:components/HomeLanding.tsx†L1-L199】

### 3.2 AI Mind Map Generator Landing
- `app/ai-mind-map-generator/page.tsx` publishes a dedicated marketing page with extensive SEO metadata, JSON-LD (SoftwareApplication, FAQ, breadcrumbs), and renders `MindMapGeneratorLanding` which hosts product content drawn from `lib/data/mindMapGeneratorFaqs` while mounting its `Generator` preview immediately for a snappier first impression.【F:app/ai-mind-map-generator/page.tsx†L1-L143】【F:lib/data/mindMapGeneratorFaqs.ts†L1-L28】
- Programmatic flashcard routes render `FlashcardGeneratorLanding`, which now loads the embedded flashcard deck on first paint to honour the fast-loading UX mandate and minimise landing-page bounce.【F:components/FlashcardGeneratorLanding.tsx†L1-L200】

### 3.3 Dashboard Experience
- `app/dashboard/page.tsx` wraps `DashboardClient` in a suspense boundary with a spinner fallback.【F:app/dashboard/page.tsx†L1-L16】
- `DashboardClient` is a comprehensive client module managing Supabase-authenticated state, credit balances, Paddle upgrade flows, mode switching between fast/smart models, referral tracking, share link generation, spaced repetition modals, and streaming history. It orchestrates Spaced Repetition queue state (`dueQueue`, `dueIndices`), referral link fetches, clipboard utilities, PostHog instrumentation, and share link caching.【F:app/dashboard/DashboardClient.tsx†L1-L400】

### 3.4 Pricing
- The `/pricing` route renders `PricingHeader` plus the interactive `PricingClient`. Metadata introduces plan descriptions.【F:app/pricing/page.tsx†L1-L20】
- `components/PricingClient.tsx` loads Paddle’s checkout SDK, keeps billing cycle state, fetches previews via `Paddle.PricePreview`, syncs Supabase subscriptions, and coordinates upgrade flow flags. It conditionally launches an `AuthModal` when unauthenticated users attempt to buy.【F:components/PricingClient.tsx†L1-L200】

### 3.5 Contact
- `/contact` provides static support content and renders `ContactForm`, which currently captures PostHog events and shows a placeholder alert on submission.【F:app/contact/page.tsx†L1-L37】【F:app/contact/ContactForm.tsx†L1-L33】

### 3.6 Shareable Views
- `/share/[type]/[token]` validates signed tokens, fetches public records via Supabase service client, and renders either a `MindMapModal` or `FlashcardsModal` through `ShareViewer`. Invalid tokens fall back to a 404.【F:app/share/[type]/[token]/page.tsx†L1-L112】
- `ShareViewer` mounts the appropriate modal, auto-imports shared decks into an authenticated user’s Supabase account via `/api/share-link/import`, and redirects home when closed.【F:components/ShareViewer.tsx†L1-L131】

### 3.7 Legal & Sitemap
- `app/sitemap.ts` enumerates key static routes and produces weekly updating sitemap entries, prioritising the homepage and pricing page higher for crawlers.【F:app/sitemap.ts†L1-L26】

## 4. Core Client Components
- **Generator Workflow**: `components/Generator.tsx` coordinates file uploads (via signed Supabase URLs), local cache of pre-parsed text (`/api/preparse`), prompt handling, non-auth throttling experiments, Supabase auth gating, and toggles between mind map and flashcard generation modes with streaming responses. It dynamically loads `AuthModal`, `MindMapModal`, and `FlashcardsModal` to minimise SSR bundles.【F:components/Generator.tsx†L1-L120】
- **Dropzone**: Handles drag/drop, deduplication, PostHog analytics, upload progress display, and file pruning based on allowed name/size whitelists. It exposes hooks for parent components to block opening or reset state.【F:components/Dropzone.tsx†L1-L200】
- **PromptForm**: Provides adaptive placeholders per mode, intercepts submit/Enter actions to emit PostHog metrics, auto-resizes the textarea, and exposes call-to-action labelling for both generator modes.【F:components/PromptForm.tsx†L1-L178】
- **MindMapModal** (not shown above) visualises streamed Markmap Markdown, exporting to SVG/PNG/PDF through html-to-image and jspdf integrations, coordinates KaTeX rendering, node interactions, and share/export affordances. Embedded flashcard-driven streams now track a `finalizedRequestIdRef` so the renderer ignores redundant post-stream updates, eliminating the mind map flicker seen when generation completed inside `FlashcardsModal`. (See file for exact UI flows.)【F:components/MindMapModal.tsx†L1-L200】
- **FlashcardsModal**: Implements TS-FSRS scheduling, Supabase persistence, exam date controls, KaTeX rendering for cards, interleaved study queues, analytics for study behaviour, and gating that prompts sign-up when anonymous users close generated decks.【F:components/FlashcardsModal.tsx†L1-L200】
 - **FlashcardsModal**: Implements TS-FSRS scheduling, Supabase persistence, exam date controls, KaTeX rendering for cards, interleaved study queues, analytics for study behaviour, and gating that prompts sign-up when anonymous users close generated decks. A new Explain/Back control replaces the former due-status pill, calling `/api/explain-flashcard` to surface Gemini fast-mode explanations inline while displaying loading and error states.【F:components/FlashcardsModal.tsx†L1-L200】
- **Embedded Visuals**: `EmbeddedMindMap` bootstraps the canvas-only renderer with interactions disabled and ensures KaTeX assets are present. `EmbeddedFlashcards` ships a sample deck for marketing previews by mounting `FlashcardsModal` in embedded mode.【F:components/EmbeddedMindMap.tsx†L1-L52】【F:components/EmbeddedFlashcards.tsx†L1-L58】
- **AuthModal**: Offers magic-link and Google OAuth flows, persists upgrade redirect hints, and tracks sign-ups in PostHog. It clears local state when the modal closes.【F:components/AuthModal.tsx†L1-L117】

## 5. API Routes
### 5.1 Content Preparation & Generation
- **`/api/preparse`**: Accepts JSON or multipart uploads, determines user tier via Supabase admin auth, downloads Supabase Storage objects, converts supported document types (PDF, DOCX, PPTX, text) to raw text, extracts base64 images, enforces cumulative character limits by tier, and returns combined text/images/metadata for client caching.【F:app/api/preparse/route.ts†L1-L175】
- **`/api/generate-mindmap`**: Streams Gemini chat completions (OpenAI-compatible) with optional image inputs, enforces credit deductions based on raw character count and model multiplier, handles smart model tier restrictions, cleans up temporary uploads, and surfaces detailed error codes. It supports JSON bodies for pre-parsed content and legacy multipart for direct uploads.【F:app/api/generate-mindmap/route.ts†L1-L713】
- **`/api/generate-flashcards`**: Mirrors the mind map endpoint but produces NDJSON streams for cards. It shares credit enforcement, tier checks, Supabase integration, and prompt construction tailored for flashcard generation and optional Markmap sources.【F:app/api/generate-flashcards/route.ts†L1-L200】
 - **`/api/explain-flashcard`**: Auth-required JSON endpoint that charges 0.1 credits (fast tier) to request concise Gemini explanations for a given flashcard question/answer pair, ensuring monthly free-credit refresh, refunding on provider errors, and returning plain JSON responses.【F:app/api/explain-flashcard/route.ts†L1-L200】

### 5.2 Credits & Billing
- **`/api/ensure-credits`**: Authenticates users, checks for active subscriptions, and seeds or monthly-refreshes free credits in `user_credits`, skipping paid accounts whose balances are managed elsewhere.【F:app/api/ensure-credits/route.ts†L1-L123】
- **`/api/refill-credits`**: Vercel cron-protected endpoint that iterates active Paddle subscriptions, refills `user_credits` using plan-specific allowances when the last refill is older than a month.【F:app/api/refill-credits/route.ts†L1-L66】【F:vercel.json†L2-L10】
- **`/api/paddle-webhook`**: Verifies Paddle HMAC signatures, handles subscription lifecycle events, updates `customers`/`subscriptions`, and upserts credits using plan metadata. It logs unhandled events and ensures credits align with the latest plan.【F:app/api/paddle-webhook/route.ts†L1-L173】

### 5.3 Sharing & Referrals
- **`/api/share-link`**: Validates ownership of mind maps or flashcards, then issues signed share tokens plus canonical URLs using HMAC utilities from `lib/share-links.ts`.【F:app/api/share-link/route.ts†L1-L83】【F:lib/share-links.ts†L1-L75】
- **`/api/share-link/import`**: Auth-required endpoint that clones shared records into the caller’s Supabase tables, deduplicating by content when possible.【F:app/api/share-link/import/route.ts†L1-L168】
- **`/api/referrals/link`**: Generates or retrieves unique referral codes, enforces monthly redemption limits, and returns shareable referral URLs with usage stats.【F:app/api/referrals/link/route.ts†L1-L123】
- **`/api/referrals/redeem`**: Validates codes, prevents self-referrals, applies monthly caps, inserts redemption records, and atomically increments credits for both parties via a Supabase RPC function with rollback safety.【F:app/api/referrals/redeem/route.ts†L1-L170】

### 5.4 Storage Utilities
- **`/api/storage/get-signed-uploads`**: Issues signed Supabase upload URLs with sanitised paths, supports anonymous and authed namespaces, and retries to avoid collisions.【F:app/api/storage/get-signed-uploads/route.ts†L1-L155】
- **`/api/storage/cleanup`**: Removes temporary uploads after successful generation streams, returning counts but swallowing errors to avoid failing client flows.【F:app/api/storage/cleanup/route.ts†L1-L33】
- **`/api/storage/scheduled-cleanup`**: Vercel cron endpoint that recursively lists storage prefixes, deletes files older than 24 hours, and reports attempts/deletions with defensive error logging.【F:app/api/storage/scheduled-cleanup/route.ts†L1-L133】【F:vercel.json†L2-L10】

## 6. Libraries & Utilities
- **Document Parsing**: `lib/document-parser.ts` abstracts DOCX/PDF/PPTX/plain text extraction using Mammoth, pdf-parse, pptx-text-parser, and tier-aware truncation. It enforces per-tier character ceilings, aggregates multi-file uploads, tracks included/excluded files, and returns image data URLs for Gemini processing.【F:lib/document-parser.ts†L1-L198】
- **Mind Map Renderer**: `lib/markmap-renderer.ts` provides a bespoke Markmap alternative: parsing custom Markdown, measuring nodes with cached hidden DOM, handling zoom/pan gestures, theme-aware colour palettes, KaTeX rendering, animation state, and interaction toggles for collapse/expand behaviours.【F:lib/markmap-renderer.ts†L1-L200】
- **Spaced Repetition**: `lib/spaced-repetition.ts` configures TS-FSRS, defines schedule state, applies exam date constraints (including 24-hour grace rules), and returns updated schedules after grading.【F:lib/spaced-repetition.ts†L1-L118】
- **Schedule Persistence**: `lib/sr-store.ts` normalises exam dates, mirrors schedules between localStorage, in-memory caches, and Supabase `flashcards_schedule`. It offers synchronous and async load/save helpers plus bulk upsert utilities.【F:lib/sr-store.ts†L1-L231】
- **KaTeX Loader**: Lazily loads KaTeX CSS/JS assets with requestIdleCallback support to render math inside mind maps and flashcards.【F:lib/katex-loader.ts†L1-L156】
- **Supabase Client**: `lib/supabaseClient.ts` initialises the browser Supabase instance with persistent sessions and exports row typings for `mindmaps` and `flashcards` tables.【F:lib/supabaseClient.ts†L1-L28】
- **Plan Metadata**: `lib/plans.ts` defines credit allowances, Paddle price IDs, and model multipliers/tiers, plus helpers to resolve plans from price IDs.【F:lib/plans.ts†L1-L54】
- **Utilities**: `lib/utils.ts` exposes Tailwind-aware class merging and locale-aware date/time formatting helpers for dashboards and modals.【F:lib/utils.ts†L1-L33】

## 7. Supabase Schema & Server Assets
- Migrations define referral program tables, credit increment RPCs, and upgrades to `flashcards_schedule.exam_date` to store timestamps with default 8am conversion. These align with referral/redeem logic and exam scheduling in the client.【F:supabase/migrations/20240404120000_add_referral_program.sql†L1-L65】【F:supabase/migrations/add_exam_time_to_flashcards_schedule.sql†L1-L59】

## 8. Instrumentation, Middleware & Config
- PostHog is initialised client-side with ingestion rewrites; Next config also rewrites `/ingest` routes, sets immutable caching on static assets, and disables trailing-slash redirects to satisfy PostHog API expectations.【F:instrumentation-client.ts†L1-L9】【F:next.config.ts†L1-L46】
- `middleware.ts` redirects authenticated users (tracked via lightweight cookie or Supabase session cookie) away from `/` to `/dashboard`, ensuring quick auth gating for marketing pages.【F:middleware.ts†L1-L37】
- `vercel.json` schedules nightly credit refills and storage cleanup cron jobs, and marks sitemap/robots outputs with `X-Robots-Tag: noindex` headers.【F:vercel.json†L1-L31】

## 9. UI Primitives & Styling
- The `components/ui` directory wraps Radix primitives with Tailwind variants, providing reusable `Button`, `Popover`, `Card`, `Input`, `Label`, and `Calendar` helpers. Buttons leverage class-variance-authority for variant/size theming, while others expose consistent classNames via the shared `cn` utility.【F:components/ui/button.tsx†L1-L59】【F:lib/utils.ts†L1-L6】

## 10. Ancillary Assets
- Global styles in `app/globals.css` (not detailed here) supply CSS variables for light/dark themes, typography, and Markmap visuals in conjunction with `lib/markmap-renderer`. The repository also includes marketing assets (`CogniGuide_logo.png`, icons) and documentation (APP_DOC.md, event tracking notes) that describe product strategy.


## Supabase tables:

```customers
create table public.customers (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  paddle_customer_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint customers_pkey primary key (id),
  constraint customers_paddle_customer_id_key unique (paddle_customer_id),
  constraint customers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

```flashcards
create table public.flashcards (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text null,
  markdown text not null,
  cards jsonb not null,
  created_at timestamp with time zone not null default now(),
  constraint flashcards_pkey primary key (id),
  constraint flashcards_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint flashcards_cards_is_array check ((jsonb_typeof(cards) = 'array'::text))
) TABLESPACE pg_default;

create index IF not exists flashcards_user_id_created_at_idx on public.flashcards using btree (user_id, created_at desc) TABLESPACE pg_default;
```


```flashcards_schedule
create table public.flashcards_schedule (
  user_id uuid not null,
  deck_id uuid not null,
  schedules jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  exam_date timestamp with time zone null,
  is_cancelled boolean not null default false,
  constraint flashcards_schedule_pkey primary key (user_id, deck_id),
  constraint flashcards_schedule_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

```mindmaps
create table public.mindmaps (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text null,
  markdown text not null,
  created_at timestamp with time zone not null default now(),
  constraint mindmaps_pkey primary key (id),
  constraint mindmaps_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists mindmaps_user_id_created_at_idx on public.mindmaps using btree (user_id, created_at desc) TABLESPACE pg_default;
```


```referral_codes
create table public.referral_codes (
  user_id uuid not null,
  code text not null,
  created_at timestamp with time zone not null default now(),
  constraint referral_codes_pkey primary key (user_id),
  constraint referral_codes_code_key unique (code),
  constraint referral_codes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

```referral_redemptions
create table public.referral_redemptions (
  id uuid not null default gen_random_uuid (),
  referrer_id uuid not null,
  referral_code text not null,
  referred_user_id uuid not null,
  reward_credits numeric(12, 6) not null default 30,
  created_at timestamp with time zone not null default now(),
  constraint referral_redemptions_pkey primary key (id),
  constraint referral_redemptions_referred_user_id_key unique (referred_user_id),
  constraint referral_redemptions_referral_code_fkey foreign KEY (referral_code) references referral_codes (code) on delete CASCADE,
  constraint referral_redemptions_referred_user_id_fkey foreign KEY (referred_user_id) references auth.users (id) on delete CASCADE,
  constraint referral_redemptions_referrer_id_fkey foreign KEY (referrer_id) references auth.users (id) on delete CASCADE,
  constraint referral_redemptions_reward_positive check ((reward_credits > (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists referral_redemptions_referrer_created_idx on public.referral_redemptions using btree (referrer_id, created_at) TABLESPACE pg_default;
```

```subscriptions
create table public.subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  paddle_subscription_id text not null,
  status text null,
  plan text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_paddle_subscription_id_key unique (paddle_subscription_id),
  constraint subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

```user_credits
create table public.user_credits (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  credits numeric(12, 6) not null default 0,
  last_refilled_at timestamp with time zone null,
  updated_at timestamp with time zone not null default now(),
  constraint user_credits_pkey primary key (id),
  constraint user_credits_user_id_key unique (user_id),
  constraint user_credits_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_credits_nonnegative check ((credits >= (0)::numeric))
) TABLESPACE pg_default;
```

