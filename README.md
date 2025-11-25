# CogniGuide Application Context

## 1. Product Overview
- CogniGuide uses Google Gemini-powered reasoning to turn uploaded PDFs, DOCX/PPTX decks, Markdown, and images into interactive, exportable mind maps plus spaced-repetition flashcard decks with hints such as exam-date-aware scheduling, referral bonuses, and shareable links described in README.md and surfaced through components/Generator.tsx and components/FlashcardsModal.tsx.
- The AI pipeline streams Markmap markdown and flashcard JSON so the UI can render partial results immediately, enforces file caching/credit bookkeeping, surfaces real-time credit balances, handles credit tier switches (fast vs smart models), and offers referral/reward dialogs orchestrated inside app/dashboard/DashboardClient.tsx, components/HomeLanding.tsx, and related modals.

## 2. Marketing, Programmatic, & Share Surfaces
- Public marketing content is composed with the App Router: / renders HomeLanding, /ai-mind-map-generator and /ai-flashcard-generator mount rich landing modules, /pricing loads PricingClient/PricingHeader, /blog/* serves static posts, /contact hosts ContactForm.tsx, and /legal/* exposes policy pages; the layout in app/layout.tsx (metadata, structured data, theme-reset script) and lib/siteMetadata.ts supply shared SEO defaults.
- Programmatic SEO pages live under app/programmatic/flashcards/[slug] but immediately redirect to the canonical URL defined in lib/programmatic/flashcardPages.ts, which reads generated metadata, FAQ JSON-LD, and use-case data produced by scripts/generate_programmatic_flashcards.py, scripts/assign_subhubs.py, and the data/ CSV/JSON assets.
- Share links and imports are backed by lib/share-links.ts (HMAC tokens) plus app/api/share-link/route.ts and app/api/share-link/import/route.ts, while app/share/[type]/[token]/page.tsx renders ShareViewer.tsx, opens MindMapModal/FlashcardsModal, and optionally mirrors the deck into the authenticated user via supabase helpers.

## 3. Authenticated Experience
- /dashboard is a Suspense-wrapped client entry (app/dashboard/DashboardClient.tsx) that manages Supabase auth, credit balances (cache + localStorage), Paddle checkout flows, referral tracking, share-link creation, spaced-repetition queues, streaming history, and toggles between mind-map vs flashcard generators.
- The generation UI stitches together components/Dropzone.tsx (featuring instant client-side image previews), PromptForm.tsx, Generator.tsx, EmbeddedMindMap.tsx, and EmbeddedFlashcards.tsx so uploads, prompt overrides, mode switches, and previews happen in one panel; FlashcardsModal.tsx itself handles grading, spaced repetition navigation, Explain Flashcard calls, and credits, and Generator.tsx now surfaces a yellow warning when PDF uploads contain little or no selectable text (scanned images) so users know to run OCR first as well as a matching high-demand warning whenever Gemini rate limits fire so users understand we're at capacity and should retry later.
- Reverse Trial timing now waits ~30 seconds after the first study modal opens (MindMapModal.tsx or FlashcardsModal.tsx) in a session and only while the user is in the trial tier; MindMapModal/FlashcardsModal emit `cogniguide:study-modal-opened` and DashboardClient coordinates the delay before showing components/ReverseTrialModal.tsx, whether the content was opened from the history sidebar or right after generation.
- After ReverseTrialModal, DashboardClient now opens an onboarding wizard with a Zeigarnik-style progress tracker that asks users whether they are mind-map-first or flashcards-first, then walks them through a Dropzone-styled upload card plus pill-shaped sample prompts/custom prompt entry (including a "Don’t have a file" path that autofills PromptForm) until their first study asset is created.
- components/MindMapModal.tsx renders the Markmap output with lib/markmap-renderer.ts plus styles/mindmap.css, while components/ShareLinkDialog.tsx, ShareTriggerButton.tsx, ShareViewer, and the Flashcard components keep sharing/embedding consistent across dashboards and marketing modals.

## 4. Client Components & Styling
- UI primitives are built on shadcn-like helpers under components/ui/ (button, card, input, label, popover) plus components/ThemeToggle.tsx (localStorage + system detection) and components/TooltipLayer.tsx for layered modal tooltips.
- TooltipLayer now exposes a `requestTooltipHide` helper that DashboardClient.tsx calls whenever the AI model dropdown opens or the upgrade modal appears, ensuring the “Change AI model” tooltip never lingers when free users click the locked Smart mode, and tooltips wait ~180ms by default (override with `data-tooltip-delay`) before appearing to reduce flicker.
- Global styling lives in app/globals.css (Tailwind 4 @config/@source directives, imported fonts from public/fonts, custom scrollbar tweaks, button animations), styles/mindmap.css, and styles assets referenced by export buttons for mind maps.
- Shared utilities such as components/FlashcardIcon.tsx, components/PricingTiers.tsx, components/PricingModal.tsx, and components/ShareViewer.tsx keep the marketing + dashboard UI in sync with the rest of the experience.

## 5. Library & Document Tooling
- Document ingestion relies on lib/document-parser.ts (mammoth, pdf-parse, pptx-text-parser, plain text handling, caching, ts-fsrs character budget awareness) together with lib/katex-loader.ts, lib/markmap-renderer.ts, lib/utils.ts, and lib/copy-to-clipboard.ts for rendering and exporting math-heavy nodes.
- lib/supabaseClient.ts (supabase auth + session persistence) plus lib/siteMetadata.ts, lib/plans.ts, and lib/share-links.ts provide shared constants for SEO, plan costs, credit multipliers, and secure share tokens.
- lib/server-user-tier.ts centralizes tier detection, Reverse Trial provisioning, and monthly refills so every API can grant the 7-day/1,000-credit Student experience before falling back to the standard free allowance.
- Spaced repetition state is managed via lib/spaced-repetition.ts (FSRS scheduling, exam-date clamping) and the lib/sr-store.ts cache/localStorage helpers that mirror flashcards_schedule so the UI always stays synced and minimizes Supabase round-trips.
- Programmatic content helpers (lib/programmatic/*) expose metadata builders, FAQ/feature structures, and generated slug maps; lib/programmatic/metadata.ts emits structured data, lib/programmatic/useCaseData.ts and scripts/* keep SEO copy aligned with real-world decks.

## 6. API & Backend Workflows
- Generation endpoints (app/api/generate-mindmap/route.ts, app/api/generate-flashcards/route.ts) stream from the OpenAI-compatible Gemini endpoint, resolve Supabase storage images, cache user tiers, enforce credit multipliers (lib/plans.ts), and clean up temporary uploads; components/Generator.tsx and FlashcardsModal.tsx consume those streams to show progressive output.
- app/api/explain-flashcard/route.ts spins up another streaming call when users tap Explain, deducts and refunds credits via the same Supabase tables, enforces paid-tier gating, and streams raw text back so the modal can show the explanation as it arrives.
- Preparse + storage APIs (app/api/preparse/route.ts, app/api/storage/get-signed-uploads/route.ts, app/api/storage/cleanup/route.ts, app/api/storage/scheduled-cleanup/route.ts) handle multipart/JSON uploads, bucketed file writes, sanitized filenames, one-off cleanup calls, and a Cron-triggerable scheduled job that purges uploads older than 24 hours.
- Credit management APIs (app/api/ensure-credits/route.ts, app/api/refill-credits/route.ts) guarantee the free plan is refilled monthly (with a Vercel cron hitting /api/refill-credits daily), skipping paid accounts, while app/api/paddle-webhook/route.ts verifies Paddle HMAC signatures, stores subscriptions, and seeds user_credits via lib/plans.ts#getCreditsByPriceId. ensure-credits now routes through lib/server-user-tier.ts so brand-new signups automatically receive the 7-day Reverse Trial (1,000 Student-plan credits with Smart Mode + Explain access) before falling back to the normal 8 free generations.
- app/api/share-link/route.ts creates signed share links, app/api/share-link/import/route.ts copies shared decks without duplication, and lib/share-links.ts signs/verifies tokens so app/share/[type]/[token]/page.tsx can safely hydrate ShareViewer.

## 7. Data, Storage, & Scheduling
- Tables include flashcards (cards JSON, optional mindmap_id), flashcards_schedule (per-deck FSRS schedules + exam_date), mindmaps, referral_codes, referral_redemptions, subscriptions, user_credits, and the increment_user_credits helper function; indexes protect user lookups and maintain ordering for dashboards.
- The uploads bucket stores user files; app/api/storage/get-signed-uploads seeds it, preparse pulls multiple files for text/image extraction, and scheduled-cleanup + storage/cleanup keep the bucket lean when Cron jobs run from vercel.json.
- Spaced repetition settings (difficulty, stability, reps, exam date) are persisted locally via lib/sr-store.ts and centrally in flashcards_schedule; ts_fsrs_docs/ documents the FSRS API for anyone tuning scheduling parameters.

## 8. Programmatic SEO & Analytics
- Programmatic flashcard taxonomy is stored in data/flashcard_taxonomy.json, data/interlinking_flashcard_pages.csv, and data/20k_run_cards_keywords.csv; scripts under scripts/ (including generate_programmatic_flashcards.py, extract_flashcard_pages.py, assign_subhubs.py, and update_related_topics.py) manipulate those assets to keep marketing narratives up to date.
- lib/programmatic/generated/* holds the canonical metadata consumed by the redirecting /programmatic/flashcards/[slug] route, ensuring each slug publishes rich JSON-LD (FAQ, breadcrumb, SoftwareApplication) via buildProgrammaticMetadata.
- PostHog instrumentation is captured in event-tracking-report.md; key events fire in app/contact/ContactForm.tsx, components/Dropzone.tsx, components/Generator.tsx, components/FlashcardsModal.tsx, components/MindMapModal.tsx, components/PricingClient.tsx, and app/dashboard/DashboardClient.tsx so analytics and dashboards can be kept in sync with UX changes.
- The paid-conversion funnel now logs `pricing_modal_opened`/`pricing_modal_closed` (with trigger + user tier/credit props) for every dashboard lock, plus a rich pricing lifecycle (`pricing_viewed`, `pricing_billing_cycle_changed`, `pricing_plan_cta_clicked`, `pricing_auth_prompt_shown`, `pricing_checkout_initiated`, `pricing_checkout_completed`, `pricing_checkout_closed`, `pricing_checkout_error`). Flashcard paywalls pass `reason` codes (e.g., `flashcard_explain_blocked`, `flashcards_to_mindmap_blocked`) back to the dashboard events so you can segment upgrade intent by capability in PostHog dashboards.
- Visual assets (logo, lockups, OG image) live under public/, public/fonts, and used by app/layout.tsx to supply favicons, manifest, and structured data that reference the siteMetadata preview image.

## 9. Deployment, Environment, & Supporting Docs
- The repo uses pnpm (packageManager pin in package.json), Next.js 15.4 with Turbopack dev, React 19, Tailwind CSS 4 + @tailwindcss/postcss, next-sitemap, PurgeCSS, ESLint 9, and TypeScript 5 (package.json, tsconfig.json, next.config.ts, tailwind.config.js, tailwind.config.ts, postcss.config.cjs, purgecss.plugin.cjs).
- Middleware (middleware.ts) proactively redirects returning authenticated users on / to /dashboard, while app/layout.tsx and app/globals.css manage metadata, fonts, theme restoration, and Tailwind entry points.
- Deployments rely on vercel.json for cron jobs (/api/refill-credits daily, /api/storage/scheduled-cleanup nightly) and for X-Robots-Tag headers on /robots.txt and /sitemap.xml.
- Required environment variables (set via .env.local or hosting secrets) are documented in README.md and include:
```
GEMINI_API_KEY=your_google_generative_ai_api_key
GEMINI_MODEL_FAST=gemini-2.5-flash-lite
GEMINI_MODEL_SMART=gemini-2.5-flash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_paddle_client_side_token
NEXT_PUBLIC_PADDLE_ENV=sandbox # or production
NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_MONTH=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_STUDENT_YEAR=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTH=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEAR=pri_xxx
PADDLE_WEBHOOK_SECRET=your_paddle_webhook_secret
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_BASE_URL=your_production_domain # Optional: defaults to deployment URL
```

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
  mindmap_id uuid null,
  explanations jsonb not null default '{}'::jsonb,
  constraint flashcards_pkey primary key (id),
  constraint flashcards_mindmap_id_fkey foreign KEY (mindmap_id) references mindmaps (id) on delete set null,
  constraint flashcards_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint flashcards_cards_is_array check ((jsonb_typeof(cards) = 'array'::text))
) TABLESPACE pg_default;

create index IF not exists flashcards_mindmap_id_idx on public.flashcards using btree (mindmap_id) TABLESPACE pg_default;

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
  trial_started_at timestamp with time zone null,
  trial_ends_at timestamp with time zone null,
  trial_plan_hint text null,
  constraint user_credits_pkey primary key (id),
  constraint user_credits_user_id_key unique (user_id),
  constraint user_credits_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_credits_nonnegative check ((credits >= (0)::numeric))
) TABLESPACE pg_default;
```
