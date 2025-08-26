# Project Context: CogniGuide

## Overview https://www.cogniguide.app
CogniGuide comprehensive AI-powered study assistant. It uses an LLM to convert text and images into interactive mind maps, generates study flashcards with spaced-repetition scheduling, supports multimodal inputs (documents and images), to help users learn, review, and retain information more effectively with research backed strategies.

## Key Features
*   **Versatile Document & Image Support:** Accepts various document formats including PDF, DOCX, PPTX, TXT, Markdown (.md), and images (PNG/JPG/WebP/GIF). Documents are parsed to text; images are passed to the multimodal model for OCR and diagram understanding.
*   **Custom Prompts:** Users can provide specific instructions or prompts to guide the AI in tailoring the mind map to their needs.
*   **Deep AI Analysis:** Utilizes advanced AI models (via OpenAI API) to go beyond simple summarization, identifying key concepts, relationships, and building logical, hierarchical mind maps.
*   **Instant Generation:** Processes content and generates mind maps rapidly, saving users hours of manual work.
*   **Interactive Mind Maps:** The generated mind maps are visual and interactive, enhancing comprehension and retention. On first load, the entire map is zoomed to fit the screen, giving a 'big picture' overview. Standard interactions like zooming, panning, and node collapsing/expanding are supported.
*   **Realtime Streaming Rendering:** The backend can stream model output token-by-token and the frontend progressively renders the Markmap markdown as tokens arrive so the mind map begins appearing immediately instead of waiting for the full generation to finish.
*   **Multiple Export Options:** Users can download the generated mind maps in various formats including HTML, SVG, PNG, and PDF.
*   **Flashcards Generation (Two ways):**
    - From Mind Map: After a mind map is generated, users can generate study flashcards from the Markmap markdown and switch between the mind map view and a flashcards study mode.
    - Direct from Files: On the generator, a selector lets users choose “Flashcards” to generate flashcards directly from uploaded documents/images (without first creating a mind map). The backend accepts `FormData` uploads and streams NDJSON lines for incremental flashcards.
*   **Auth & History:** Users must sign in (Email magic link or Google) to generate mind maps or flashcards. Signed-in users get a dashboard with a unified reverse-chronological history of both mind maps and flashcards. Items show lucide icons (map vs card). Mind maps are stored as Markmap markdown; flashcards are stored as a JSON array (and may omit markdown when generated directly from files/prompts).

## Technology Stack
*   **Framework:** Next.js (React) for building the web application.
*   **Styling:** Tailwind CSS for utility-first styling.
*   **AI Integration:** OpenAI API (configured to use Google's Gemini API) for generating mind map content from text and images. The `GEMINI_API_KEY` environment variable is used for authentication. The `gemini-2.5-flash-lite` model is specifically used for generating the Markmap Markdown and supports multimodal inputs.
    *   **Streaming Support:** When available, the API uses streaming (token-by-token) to forward model output to the client as a `text/plain` stream. The frontend consumes partial markdown and progressively updates the renderer to reduce perceived latency.
*   **Document Parsing:**
*   `pdf-parse`: Used in `lib/document-parser.ts` via `getTextFromPdf` to extract text from PDF files.
*   `mammoth`: Used in `lib/document-parser.ts` via `getTextFromDocx` to convert DOCX files to plain text.
*   `pptx-text-parser`: Used in `lib/document-parser.ts` via `getTextFromPptx` to extract text from PPTX files. This involves writing the buffer to a temporary file and then parsing it.
*   Markdown/TXT: `.md` and `.txt` files are treated as plain text and read directly.
 *   **Mind Map Rendering:** The application uses a custom Markmap-like renderer implemented in `lib/markmap-renderer.ts` (and embedded within `components/MindMapModal.tsx` for HTML export). This renderer handles parsing markdown, measuring node sizes, laying out the tree, and drawing SVG connectors and HTML nodes. It includes logic for color variations, node collapsing/expanding, and pan/zoom functionality. It now features an intelligent **auto-fit-to-view** that centers and scales the mind map to be fully visible on initial load and during streaming. This behavior stops once the user interacts with the map.
    *   **Touch Support:** The renderer now includes comprehensive touch event handling for mobile devices, enabling single-finger panning and two-finger pinch-to-zoom gestures for intuitive navigation.
    *   **Incremental Updates:** The renderer exposes an `updateMindMap(markdown: string)` function to support incremental re-rendering while the model is streaming output, enabling smooth progressive visualization.
*   **Spaced Repetition:** TS-FSRS (Free Spaced Repetition Scheduler) algorithm implementation for optimal flashcard scheduling. The `ts-fsrs` library provides FSRS-6 algorithm with configurable parameters for difficulty, stability, and optimal review timing.
*   **Analytics & Event Tracking:** PostHog integration for comprehensive user behavior analytics, feature flag management, and A/B testing capabilities.
*   **Authentication & DB:** Supabase is used for authentication (email magic link and Google OAuth) and to persist user mind map history and flashcard data (only markdown is stored for mind maps, full flashcard data with scheduling state).
*   **Image Generation:** `dom-to-image-more` is used in `components/MindMapModal.tsx` to convert the rendered mind map (a DOM element) into SVG or PNG images for export.
 *   **PDF Generation:** Users can export to PDF via the browser's print dialog directly from `components/MindMapModal.tsx`. The modal opens a print-friendly window that clones the live HTML+SVG mind map, auto-fits and centers it to the page, so the resulting PDF preserves selectable text and vector connectors (no rasterization). Default scale is 180% of best fit; you can override per mind map by adding frontmatter `print_scale: <number>` (e.g., `print_scale: 1.2` for 120%).

## PostHog Analytics Integration

CogniGuide includes comprehensive PostHog integration for user behavior analytics, feature flag management, and A/B testing. The integration provides valuable insights into user engagement and feature usage.

### Key Features
*   **Event Tracking:** Automatic tracking of user interactions across the application
*   **Feature Flags:** Dynamic feature toggling and experimentation capabilities
*   **Error Tracking:** Client-side error monitoring and reporting
*   **User Analytics:** Detailed user journey analysis and retention metrics

### Tracked Events
The application tracks numerous user interactions including:
- File uploads and removals
- Generation submissions (mind maps and flashcards)
- Authentication events (sign-ups, sign-outs)
- Modal interactions and navigation
- Export actions (SVG, PNG, PDF)
- Flashcard study sessions and grading
- Contact form submissions
- Pricing page interactions

### Configuration
PostHog is configured in `instrumentation-client.ts` with:
- API host pointing to `/ingest` for Next.js API route proxying
- UI host set to `https://us.posthog.com`
- Automatic exception capturing
- Development mode debugging

### Environment Variables
```env
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
```

## TS-FSRS Spaced Repetition Algorithm

CogniGuide implements the advanced TS-FSRS (Free Spaced Repetition Scheduler) algorithm for optimal flashcard scheduling and retention. This research-backed algorithm provides superior long-term retention compared to traditional spaced repetition methods.

### Key Features
*   **FSRS-6 Algorithm:** Latest version of the Free Spaced Repetition Scheduler
*   **Adaptive Scheduling:** Dynamically adjusts review intervals based on individual card performance
*   **Difficulty Tracking:** Maintains difficulty scores for each flashcard
*   **Stability Metrics:** Tracks memory stability over time
*   **Exam Date Constraints:** Prevents review scheduling beyond specified exam dates
*   **Cross-Device Synchronization:** Maintains scheduling state across devices via Supabase

### Implementation Details
*   **Library:** Uses the `ts-fsrs` package for FSRS-6 implementation
*   **Configuration:** Custom parameters optimized for educational content
*   **Persistence:** Stores scheduling state in Supabase `flashcards_schedule` table
*   **Caching:** In-memory and localStorage caching for instant loading
*   **Offline Support:** Continues functioning without network connectivity

### Scheduling Parameters
Each flashcard tracks:
- **Difficulty:** How hard the card is to remember (1-10 scale)
- **Stability:** How stable the memory is (in days)
- **Reps:** Number of successful reviews
- **Lapses:** Number of forgotten responses
- **Learning Steps:** Progress through initial learning phase
- **Due Date:** Next scheduled review time

### Grading System
- **Again (1):** Complete blackout, immediate review
- **Hard (2):** Significant difficulty, longer interval
- **Good (3):** Moderate effort, standard interval
- **Easy (4):** Effortless recall, extended interval

## Project Structure Highlights

### Frontend (`app/page.tsx` and `components/`)
*   `app/page.tsx`: The main client-side page (`'use client'`). It serves as the orchestrator for the application's UI and logic. It manages the core state (selected file, prompt text, loading status, errors, generated markdown) and handles the submission process to the backend API. It also includes the hero section, "Why Mind Maps" section, "Generator" section, "How It Works" section, and "Features" section, providing a comprehensive user experience. Requires user authentication before allowing any generations - when users click generate without signing in, it opens the sign-up modal. When signed in, it saves the generated markdown to Supabase.
*   `components/Dropzone.tsx`: A React component that provides a drag-and-drop area for file uploads. It supports PDF, DOCX, PPTX, TXT, and MD file types. It displays the selected file's name and size, and allows users to remove the file. It manages drag-and-drop states and visually indicates when a file is being dragged over.
*   `components/PromptForm.tsx`: A React component for users to input text prompts. It includes a `textarea` that auto-resizes and a "Generate Mind Map" button with a loading spinner. It handles form submission and passes the prompt text to the parent component.
*   `components/MindMapModal.tsx`: A modal component that displays the generated mind map and handles flashcard generation from mind map content. It integrates the custom Markmap renderer (`initializeMindMap` from `lib/markmap-renderer.ts`) to visualize the markdown. It provides functionality to download the mind map in HTML, SVG, PNG, and PDF formats. The HTML export includes the full renderer script for a standalone interactive map. It also handles the modal's open/close state and cleanup of event listeners.
    * **Flashcard Integration**: Includes a "Generate Flashcards" button that generates study flashcards from the current Markmap markdown using the `/api/generate-flashcards` endpoint. The generation logic is handled locally while the UI presentation is delegated to `FlashcardsModal` for consistency. When in flashcard mode, the mind map viewport is hidden and the renderer is cleaned up; it re-initializes when returning to the map view.
*   `components/FlashcardsModal.tsx`: **Centralized flashcard component** used by both the dashboard (for direct file generation) and `MindMapModal` (for mind map-derived flashcards). Provides a unified, consistent flashcard study experience across the application.
    * **Unified UI**: Features a sleek, colorful study interface with gradient progress bar and color-coded rating buttons (Again/Hard/Good/Easy).
    * **Streaming Support**: Supports real-time streaming display (NDJSON) for incremental flashcard generation.
    * **Spaced Repetition**: Implements FSRS-6 algorithm with Supabase-backed persistence. Includes deck-level exam date constraints, per-card scheduling (difficulty, stability, reps, lapses, last_review, due), and cross-device synchronization via Supabase (`flashcards_schedule`) table.
    * **Performance Optimizations**: Uses prefetched scheduling data cached in memory and localStorage for instant loading. Includes cache-only recompute paths for offline functionality.
    * **Clean Interface**: Hides internal FSRS metrics while maintaining powerful spaced repetition capabilities.
*   `components/AuthModal.tsx`: A modal for authentication that supports email magic-link sign-in and Google OAuth. Triggered when users attempt to generate content without signing in on the landing page or via header "Sign in". On success, redirects to the dashboard.

### Design System & UI Preferences

These preferences reflect the current, polished UI and should be used consistently across the app.

- **Background**: Pure white throughout the app (global `--color-background: #ffffff`).
- **Typography**: Poppins via Next/font, applied globally.
- **Buttons**:
  - Primary/secondary text buttons are **pill-shaped** (`rounded-full`).
  - Icon-only actions are **perfect circles** (equal `w/h`, `rounded-full`).
- **Cards/Panels**: Use **very rounded** corners (roughly `rounded-[1.25rem]` to `rounded-[2rem]`) for non-button surfaces.
- **Borders/Shadows**: Subtle borders using `--color-border` and soft shadows; keep surfaces clean on white.
- **Color tokens** (see `app/globals.css`):
  - `--color-background: #ffffff`, `--color-foreground`, `--color-primary`, `--color-border`, etc.
  - Mind map nodes continue to use the renderer’s palette and styles.
- **Components**:
  - `components/PromptForm.tsx` is already polished with adaptive shape (pill when short, rounded container when tall) and should not be changed.
  - `components/MindMapModal.tsx` uses rounded container and circular icon controls for downloads/close.
  - `components/Dropzone.tsx` uses rounded containers and circular remove-file buttons.
- **Optional library**: You may use shadcn/ui components to speed up consistent, reusable UI primitives (e.g., Dialog, Button). Match the shape rules above (pills/circles/rounded panels) and white background.
- **Accessibility/Feel**: Keep hover states subtle, focus-visible rings on interactive elements, and avoid dark backgrounds/panels.

### Logo Usage Guidelines

For consistent branding across the application, use the `CogniGuide_logo.png` file for all logo displays:

- **Location**: The logo file is located at `/CogniGuide_logo.png` in the project root
- **Import Pattern**: Use ES6 import syntax: `import CogniGuideLogo from '../CogniGuide_logo.png';`
- **Component**: Use Next.js `Image` component for optimization: `<Image src={CogniGuideLogo} alt="CogniGuide" width={24} height={24} />`
- **Consistent Usage**:
  - Dashboard mobile header (when sidebar is closed)
  - Dashboard sidebar header (both desktop and mobile)
  - Landing page hero section
- **Avoid**: Using generic icons like `BrainCircuit` from Lucide React for logo representation

### Backend API (`app/api/generate-mindmap/route.ts`)
*   This is a Next.js API route (`POST` handler) responsible for processing mind map generation requests.
*   It receives `FormData` which can contain either a `File` object (for document uploads) or a `promptText` string.
*   **Document/Image Processing:** It intelligently determines the file type and uses helper functions from `lib/document-parser.ts` (`getTextFromPdf`, `getTextFromDocx`, `getTextFromPptx`) to extract raw text content from uploaded documents. It also supports plain text and Markdown (`text/markdown`, `.md`) files directly by reading their contents as UTF-8. For images (`image/*`), it attaches them to the multimodal request so the model can perform OCR and diagram understanding; when only images are provided, the API instructs the model to build a mind map from image content alone.
*   **Prompt Engineering:** The `constructPrompt` function is crucial for guiding the AI. It builds a detailed prompt that instructs the AI to generate a structured, hierarchical mind map in Markmap Markdown format, adhering to specific rules (root node, parent/child nodes, no extra text). It also incorporates any custom user instructions.
*   **AI Interaction:** It initializes the OpenAI client (configured to use Google's Gemini API) and sends the `finalPrompt` to the `gemini-2.5-flash-lite` model.
*   **Response Handling:** It extracts the markdown content from the AI's response, logs it, and returns it as a JSON response to the client. Comprehensive error handling is implemented for unsupported file types, missing input, and AI generation failures.

### Utility Libraries (`lib/`)
*   `lib/document-parser.ts`: Contains asynchronous functions (`getTextFromDocx`, `getTextFromPdf`, `getTextFromPptx`) that abstract the process of extracting text from various document formats. It uses external libraries (`mammoth`, `pdf-parse`, `pptx-text-parser`) and handles temporary file creation/deletion for PPTX parsing.
*   `lib/markmap-renderer.ts`: This file contains the core logic for rendering the Markmap markdown into an interactive mind map. It defines functions for parsing markdown into a tree structure (`parseMarkmap`), measuring node dimensions (`measureNodeSizes`), laying out the nodes (`layoutTree`), drawing SVG connectors (`drawConnector`), and rendering the nodes and their children (`renderNodeAndChildren`). Key interaction logic has been updated: it now performs an **auto-fit** on initial render to show the full mind map. This auto-fit view is maintained during live streaming updates but is disabled as soon as the user manually pans or zooms, giving them control. The node collapsing behavior has been changed to be opt-in (using a markdown comment) rather than automatic. The `getFullMindMapBounds` function is crucial for this auto-fit capability and for export functionalities.
### Flashcards Generation (`app/api/generate-flashcards/route.ts`)
*   Two input modes:
    - JSON POST with `{ markdown: string, numCards?: number }` (existing behavior) to synthesize flashcards from Markmap markdown. Streaming supported when `?stream=1` and emits NDJSON lines.
    - `FormData` POST with one or more `files` and optional `prompt` to generate flashcards directly from uploaded content (PDF/DOCX/PPTX/TXT/MD and images). Documents are parsed with `lib/document-parser.ts`; images are attached for multimodal OCR/diagram understanding. Streaming supported via NDJSON.
*   Returns `{ title?: string, cards: { question: string, answer: string }[] }`.
*   The prompt instructs the model to emit a strict JSON object; the handler defensively extracts a JSON object from the response.
*   Saving: when a user is authenticated, the UI saves generated flashcards to Supabase with the original mind map markdown snapshot, derived title, and the JSON array of cards.
*   Retrieval: when `MindMapModal` opens for a given markdown, it first looks in an in-memory cache; if not found, it checks `localStorage` using a SHA‑256 hash of the markdown for an instant hit; if still not found and the user is signed in, it queries Supabase (`flashcards`) by `user_id` and `title` only (newest `created_at`) to avoid sending the full markdown over the network. On success, it mirrors the deck into `localStorage` and updates it with the Supabase `id` after save.

### Credit Management APIs

#### Ensure Credits API (`app/api/ensure-credits/route.ts`)
*   **Purpose:** Ensures users have the correct credit allocation based on their subscription status
*   **Method:** POST/GET
*   **Authentication:** Required (Bearer token in Authorization header)
*   **Functionality:**
    - Checks for active subscription status
    - For free users: Grants initial credits and handles monthly refills
    - For paid users: Skips credit management (handled via webhooks)
    - Prevents duplicate credit entries using upsert operations
    - Tracks last refill date to manage monthly cycles

#### Refill Credits API (`app/api/refill-credits/route.ts`)
*   **Purpose:** Cron job endpoint for monthly credit refills for paid subscribers
*   **Method:** POST
*   **Authentication:** Cron secret token required
*   **Functionality:**
    - Queries all active subscriptions
    - Checks if monthly refill is due (based on last_refilled_at)
    - Refills credits according to plan (Student: 300, Pro: 1000)
    - Updates user_credits table with new balances

#### Preparse API (`app/api/preparse/route.ts`)
*   **Purpose:** Pre-processes uploaded files to extract text and prepare content for generation
*   **Method:** POST
*   **Content-Type:** multipart/form-data
*   **Functionality:**
    - Accepts multiple file uploads (PDF, DOCX, PPTX, TXT, MD, images)
    - Extracts text content using `lib/document-parser.ts`
    - Converts images to base64 data URLs for multimodal processing
    - Returns combined text and image data for efficient processing
    - Provides character count for credit calculation

*   `lib/supabaseClient.ts`: Initializes the Supabase browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Also exports the `MindmapRecord` type used for dashboard history.

### Dashboard (`app/dashboard/page.tsx`)
*   Requires authentication. If no session is found, it redirects to `/`.
*   Displays a unified sidebar history list (mind maps + flashcards) with icons:
    - Mind maps use lucide `Map` icon; clicking loads saved `markdown` into the viewer (`MindMapModal`).
    - Flashcards use lucide `CreditCard` icon; clicking opens `FlashcardsModal` with the saved cards.
    - Data source: `combinedHistory` state built from `mindmaps` and `flashcards` tables; refreshed via `loadAllHistory(user.id)` after any save.
*   Provides the same generator UI (dropzone + prompt) as the landing page with a selector to switch between Mind Map and Flashcards generation.
    - Mind maps are saved automatically with extracted title.
    - Flashcards generated directly from files/prompts are saved with an empty `markdown` string and a derived title, then the sidebar refreshes immediately.
*   Includes a "Sign out" action that clears the session and redirects home.
*   Spaced repetition prefetch & caching:
    - On dashboard load (after history fetch), all schedules are loaded in a single bulk request from `flashcards_schedule`, normalized to deck card counts, and cached (in‑memory + `localStorage`).
    - The due‑now queue and a `window.__cogniguide_due_map` are computed up‑front so opening the modal is instant.
    - If the network is unavailable, due lists are recomputed from the cache to maintain responsiveness.
    - When new flashcards are created, history reloads and the prefetch runs again to refresh dues.

### Authentication Requirements
*   **Non-authenticated users**: Can generate mind maps and flashcards with a limited quota (configured via `NON_AUTH_FREE_LIMIT` in `lib/plans.ts`, default: 3 generations). Generations are tracked via localStorage and do not persist across devices.
*   **Authenticated users**: Can generate without generation limits (subject to credit availability) and results are persisted to their Supabase history. When they click the generate button without being authenticated, the app opens the sign-up modal.
*   Once signed in, users receive monthly credit allocations based on their plan and can access their generation history.

### Flashcards Persistence (Supabase)
*   Two save paths:
    1) From `MindMapModal` (from an existing mind map): inserts into `flashcards` with:
       - `user_id`: the authenticated user's id
       - `title`: extracted from `#` heading or `title:` in frontmatter
       - `markdown`: the source Markmap markdown snapshot at the time of generation
       - `cards`: an array of `{ question, answer }` (stored as `jsonb`)
    2) From Dashboard (files/prompts without a mind map): inserts into `flashcards` with:
       - `user_id`
       - `title`: derived or fallback "flashcards"
       - `markdown`: empty string `""` (no mind map snapshot)
       - `cards`: generated array
       - After save, the dashboard calls `loadAllHistory(user.id)` so the unified sidebar updates immediately.
*   Retrieval behavior (optimized):
    - In `MindMapModal`: in‑memory cache → `localStorage` by SHA‑256(markdown) → Supabase by `title` (newest). The full `markdown` is no longer used in DB lookups.
    - In Dashboard: the sidebar uses the saved records directly; clicking a flashcards item opens `FlashcardsModal` with the stored `cards`.
*   RLS & indexing notes:
    - RLS policies restrict SELECT/INSERT to `auth.uid() = user_id`.
    - No btree index on the large `markdown` text column (to avoid size limits). The UI avoids querying by full `markdown`. If you need server‑side de‑duplication or exact matching, consider adding a computed hash column (e.g., SHA‑256/MD5 of `markdown`) with an index and querying by that.

## Getting Started (Development)
To run the development server:
```bash
pnpm dev
```
Open `http://localhost:3000` in your browser.

## Deployment
The application is designed for deployment on the Vercel Platform.

## Static Pages & Compliance
To satisfy Stripe/Lemon Squeezy website verification, the app includes the following static pages and navigation. These pages are designed to be responsive and match the app's design system with white backgrounds, rounded panels, and consistent typography.

*   **Pricing** (`app/pricing/page.tsx`, route: `/pricing`)
    - Three tiers: Free, Student (Most Popular), Pro
    - Clear monthly/annual pricing and credit allocations
    - "How credits work" explainer with top-up mention
    - Compliance summary listing business name, service, and links to policies
    - Links to Contact and Legal pages in the compliance section
*   **Contact** (`app/contact/page.tsx`, route: `/contact`)
    - Customer support email: `cogniguide.dev@gmail.com` (replace before launch)
    - Interactive contact form with email, subject, and message fields
    - Form is implemented as a client component for interactivity
*   **Legal Policies** (routes under `/legal`)
    - Refund & Dispute Policy: `app/legal/refund-policy/page.tsx` → `/legal/refund-policy`
    - Cancellation Policy: `app/legal/cancellation-policy/page.tsx` → `/legal/cancellation-policy`
    - Terms of Service: `app/legal/terms/page.tsx` → `/legal/terms`
    - All legal pages follow a consistent design with collapsible sections
    - Include placeholders for business-specific information that should be updated before launch
*   **Navigation**
    - **Header**: Added "Pricing" link in the main navigation for easy access
    - **Footer**: Added global footer in `app/layout.tsx` with links to all key pages
      - Links: Pricing, Contact, Refunds, Cancellation, and Terms
      - Includes copyright notice with dynamic year
      - Responsive layout that stacks on mobile

### Implementation Notes
- All pages are statically generated for optimal performance
- Contact form is implemented as a client component for interactivity
- Legal pages use consistent styling with collapsible sections for better readability
- Footer is implemented in the root layout for site-wide consistency

### Before Launch
- Review and customize all legal text to ensure compliance with local regulations
- Test all form submissions and links

## SEO & Sitemap
The application includes a dynamic sitemap (`app/sitemap.ts`) that automatically generates XML sitemaps for search engine crawling. The sitemap includes:

- **Landing Page** (`/`) - High priority, weekly updates
- **Pricing Page** (`/pricing`) - High priority, weekly updates
- **Contact Page** (`/contact`) - Medium priority, monthly updates
- **Dashboard** (`/dashboard`) - High priority, daily updates
- **Legal Pages** - Terms, Privacy Policy, Refund Policy, Cancellation Policy

The sitemap automatically adapts to different deployment environments and uses appropriate URLs for production, staging, and development.

## Environment Variables
Define these in `.env.local` (and on your hosting provider):

```
GEMINI_API_KEY=your_google_generative_ai_api_key
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
CRON_SECRET=your_cron_job_secret_for_credit_refills
NEXT_PUBLIC_BASE_URL=your_production_domain # Optional: defaults to deployment URL
```

### Paddle Billing integration

- We use Paddle.js to:
  - Preview localized prices on the pricing page via `Paddle.PricePreview()`.
  - Open overlay checkout with `Paddle.Checkout.open()`.
- Integration lives in `components/PricingClient.tsx` and is mounted from `app/pricing/page.tsx`.
- Centralized plan configuration in `lib/plans.ts` for easy maintenance:
  - `PAID_PLANS` object defines all plan details (credits, price IDs)
  - `FREE_PLAN_CREDITS` constant for authenticated free tier users
  - `NON_AUTH_FREE_LIMIT` constant for non-authenticated users (generation limit)
  - Helper functions for plan lookup and credit calculation
- Webhooks are handled at `app/api/paddle-webhook/route.ts` to manage subscriptions and credit accounting.

### Webhooks and Credit System

- **Webhook Endpoint**: The application exposes a webhook endpoint at `/api/paddle-webhook` to receive notifications from Paddle.
- **Signature Verification**: All incoming webhooks are verified using HMAC-SHA256 to ensure they originate from Paddle.
  - **Credit Accounting**:
  - Monthly credits are granted based on the authenticated user's plan. Tables used: `customers`, `subscriptions`, and `user_credits` in Supabase.
  - **Non-authenticated users**: Do not use the credit system but have generation limits instead (see `NON_AUTH_FREE_LIMIT` in `lib/plans.ts`).
  - Events handled: `subscription.created`, `subscription.updated`, `subscription.canceled` to provision/update/revoke credits automatically.
  - **Free Plan**: Users receive 50 credits monthly (configured via `FREE_PLAN_CREDITS` in `lib/plans.ts`)
  - **Student Plan**: 300 credits monthly
  - **Pro Plan**: 1000 credits monthly
  - **Per‑request deduction (server‑side enforced)**:
    - 1 credit = 3,800 characters of text.
    - For document uploads, the backend extracts text (PDF/DOCX/PPTX/TXT/MD) and counts characters from the extracted text plus any prompt provided.
    - For image‑only requests, a minimum of 0.5 credits is charged.
    - For prompt‑only requests (no file uploads), a minimum of 1 credit is charged; if the pasted prompt exceeds 3,800 characters, credits are calculated proportionally to the text length.
    - Deduction happens at the start of generation. If streaming fails before any data is sent, the reserved credits are refunded automatically.
    - Applies to both endpoints: `POST /api/generate-mindmap` and `POST /api/generate-flashcards` (JSON and multipart modes).
  - **Automated Credit Management**:
    - **Ensure Credits API** (`/api/ensure-credits`): Ensures users have correct credit allocation, handles free plan monthly refills
    - **Refill Credits API** (`/api/refill-credits`): Cron job endpoint for paid subscriber monthly credit refills
    - **Preparse API** (`/api/preparse`): Pre-processes files to calculate credit costs before generation
    - Monthly refills are tracked via `last_refilled_at` timestamp to prevent duplicate credits
  - **Auth requirement for deduction**: Requests must include a valid Supabase access token in the `Authorization: Bearer <token>` header so the server can identify `user_id` and deduct from `user_credits`.
    - The app’s client code automatically attaches this header when a user is signed in.
  - **Insufficient credits UX**: When the server returns `402` with the message "Insufficient credits. Upload a smaller file or", the client shows this error inline with an adjacent "Upgrade Plan" button (same behavior as the Upgrade button on the landing page).
    - If authenticated: navigates to `/dashboard?upgrade=true` which opens the in‑app pricing modal.
    - If not authenticated: sets `localStorage.cogniguide_upgrade_flow = 'true'` and navigates to `/pricing` to prompt sign‑in then continue checkout.

#### Important Implementation Note: Credit Updates

When handling `subscription.created` and `subscription.updated` webhooks, it is crucial to use an **`upsert`** operation rather than a simple `insert` when updating the `user_credits` table.

A user might already have an entry in the `user_credits` table (e.g., from a previous subscription or a promotional offer). A simple `insert` will fail in such cases due to the unique constraint on the `user_id` column. Using `upsert` (with `onConflict: 'user_id'`) ensures that a new record is created for new users, and the existing record is updated for existing users, preventing errors and ensuring credits are always applied correctly.

Setup steps:
- Create products and prices in Paddle for Student and Pro (monthly and annual) and copy the price IDs.
- Create a Client-side Token in Paddle and set it as `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
- If testing, set `NEXT_PUBLIC_PADDLE_ENV=sandbox`.
- Add the four price IDs for Student/Pro Month/Year to `.env.local`.

Notes:
- The UI disables checkout until Paddle is initialized and env vars are present.
- Prices auto-refresh for both billing cycles and display the active cycle prominently.

### Subscription Flow

- **For New Users (Unauthenticated)**: From the `/pricing` page, when a user clicks a paid plan, an authentication modal opens. After successful authentication, the app redirects to `/dashboard?upgrade=true` and automatically opens the pricing modal so the user can complete checkout immediately.
- **For Existing Users (Authenticated)**: A logged‑in user can click the "Upgrade Plan" button in the dashboard sidebar to open the pricing modal. If they are on the main `/pricing` page while logged in, the subscribe buttons open the Paddle overlay checkout directly.

#### Upgrade Flow Mechanics (tech notes)

- The pricing page sets `localStorage.cogniguide_upgrade_flow = 'true'` when a logged‑out user initiates a plan. On auth, it sets `localStorage.cogniguide_open_upgrade = 'true'` and redirects to `/dashboard?upgrade=true`.
- The dashboard opens the pricing modal when either `?upgrade` is present or `cogniguide_open_upgrade` (or `cogniguide_upgrade_flow`) is found in `localStorage`, then clears those flags to prevent re‑opening loops.
- Email magic link and Google OAuth redirects include `?upgrade=true` when the upgrade flow is active, ensuring a consistent post‑login experience.


### Supabase tables

```sql
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

```sql
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

```sql
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

```sql
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

```sql
create table public.flashcards_schedule (
  user_id uuid not null,
  deck_id uuid not null,
  exam_date date null,
  schedules jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint flashcards_schedule_pkey primary key (user_id, deck_id),
  constraint flashcards_schedule_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

```sql
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
