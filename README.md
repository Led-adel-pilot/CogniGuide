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
*   **Auth & History:** One free generation without sign-in; afterwards, users are prompted to sign up (Email magic link or Google). Signed-in users get a dashboard with a unified reverse-chronological history of both mind maps and flashcards. Items show lucide icons (map vs card). Mind maps are stored as Markmap markdown; flashcards are stored as a JSON array (and may omit markdown when generated directly from files/prompts).

## Technology Stack
*   **Framework:** Next.js (React) for building the web application.
*   **Styling:** Tailwind CSS for utility-first styling.
*   **AI Integration:** OpenAI API (configured to use Google's Gemini API) for generating mind map content from text and images. The `GEMINI_API_KEY` environment variable is used for authentication. The `gemini-2.5-flash` model is specifically used for generating the Markmap Markdown and supports multimodal inputs.
    *   **Streaming Support:** When available, the API uses streaming (token-by-token) to forward model output to the client as a `text/plain` stream. The frontend consumes partial markdown and progressively updates the renderer to reduce perceived latency.
*   **Document Parsing:**
*   `pdf-parse`: Used in `lib/document-parser.ts` via `getTextFromPdf` to extract text from PDF files.
*   `mammoth`: Used in `lib/document-parser.ts` via `getTextFromDocx` to convert DOCX files to plain text.
*   `pptx-text-parser`: Used in `lib/document-parser.ts` via `getTextFromPptx` to extract text from PPTX files. This involves writing the buffer to a temporary file and then parsing it.
*   Markdown/TXT: `.md` and `.txt` files are treated as plain text and read directly.
 *   **Mind Map Rendering:** The application uses a custom Markmap-like renderer implemented in `lib/markmap-renderer.ts` (and embedded within `components/MindMapModal.tsx` for HTML export). This renderer handles parsing markdown, measuring node sizes, laying out the tree, and drawing SVG connectors and HTML nodes. It includes logic for color variations, node collapsing/expanding, and pan/zoom functionality. It now features an intelligent **auto-fit-to-view** that centers and scales the mind map to be fully visible on initial load and during streaming. This behavior stops once the user interacts with the map.
    *   **Incremental Updates:** The renderer exposes an `updateMindMap(markdown: string)` function to support incremental re-rendering while the model is streaming output, enabling smooth progressive visualization.
 *   **Authentication & DB:** Supabase is used for authentication (email magic link and Google OAuth) and to persist user mind map history (only markdown is stored).
*   **Image Generation:** `dom-to-image-more` is used in `components/MindMapModal.tsx` to convert the rendered mind map (a DOM element) into SVG or PNG images for export.
 *   **PDF Generation:** Users can export to PDF via the browser's print dialog directly from `components/MindMapModal.tsx`. The modal opens a print-friendly window that clones the live HTML+SVG mind map, auto-fits and centers it to the page, so the resulting PDF preserves selectable text and vector connectors (no rasterization). Default scale is 180% of best fit; you can override per mind map by adding frontmatter `print_scale: <number>` (e.g., `print_scale: 1.2` for 120%).

## Project Structure Highlights

### Frontend (`app/page.tsx` and `components/`)
*   `app/page.tsx`: The main client-side page (`'use client'`). It serves as the orchestrator for the application's UI and logic. It manages the core state (selected file, prompt text, loading status, errors, generated markdown) and handles the submission process to the backend API. It also includes the hero section, "Why Mind Maps" section, "Generator" section, "How It Works" section, and "Features" section, providing a comprehensive user experience. Implements one-free-generation gating using `localStorage.freeGenerationUsed`; after the first successful generation without auth, it opens the sign-up modal and blocks further generations until sign-in. When signed in, it saves the generated markdown to Supabase.
*   `components/Dropzone.tsx`: A React component that provides a drag-and-drop area for file uploads. It supports PDF, DOCX, PPTX, TXT, and MD file types. It displays the selected file's name and size, and allows users to remove the file. It manages drag-and-drop states and visually indicates when a file is being dragged over.
*   `components/PromptForm.tsx`: A React component for users to input text prompts. It includes a `textarea` that auto-resizes and a "Generate Mind Map" button with a loading spinner. It handles form submission and passes the prompt text to the parent component.
*   `components/MindMapModal.tsx`: A modal component that displays the generated mind map. It integrates the custom Markmap renderer (`initializeMindMap` from `lib/markmap-renderer.ts`) to visualize the markdown. It provides functionality to download the mind map in HTML, SVG, PNG, and PDF formats. The HTML export includes the full renderer script for a standalone interactive map. It also handles the modal's open/close state and cleanup of event listeners.
*   `components/FlashcardsModal.tsx`: A standalone modal for viewing flashcards generated directly from uploaded files on the generator screens. Supports streaming display (NDJSON) and a sleek, colorful study UI (gradient progress bar and color‑coded rating buttons).
    * Includes a Flashcards mode: a "Generate Flashcards" button calls the `/api/generate-flashcards` endpoint with the current Markmap markdown and switches to a flashcards UI (prev/next, show/hide answer, restart, regenerate). When flashcards are displayed, the mind map viewport is hidden and a full white background covers the area; the renderer is also cleaned up while in flashcards mode and re-initialized when returning to the map.
    * Spaced repetition with FSRS‑6 (Supabase‑backed): The dashboard has a "Spaced repetition" button that shows only decks with cards due now. Clicking a deck opens a due‑only session in the flashcards modal with grading buttons (Again/Hard/Good/Easy). A deck‑level Exam date in the modal header constrains future dues to not overshoot that day. Scheduling uses TS‑FSRS (FSRS‑6) with recency‑weighted adaptation. Per‑card schedule state (difficulty, stability, reps, lapses, last_review, due, etc.) and the deck Exam date are persisted in Supabase (`flashcards_schedule`) keyed by `(user_id, deck_id)` so due status syncs across devices; localStorage is used as a fallback when not authenticated.
    * Performance: Spaced repetition data is now prefetched on dashboard load via a single bulk query to `flashcards_schedule`, normalized to the current deck size, and stored in an in‑memory cache mirrored to `localStorage`. The "Spaced repetition" button uses this prefetched data so the due list appears instantly; a cache‑only recompute path ensures it’s snappy even when offline. After generating new flashcards or when history refreshes, the prefetch runs again to keep dues up‑to‑date.
    * UI polish: Gradient progress bar indicates session position, the Show/Hide Answer control is a vibrant gradient pill, and rating buttons are color‑coded (red/amber/sky/emerald). Internal FSRS metrics like stability are hidden for a cleaner interface.
*   `components/AuthModal.tsx`: A modal for authentication that supports email magic-link sign-in and Google OAuth. Triggered after the first free generation on the landing page or via header "Sign in". On success, redirects to the dashboard.

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
*   **AI Interaction:** It initializes the OpenAI client (configured to use Google's Gemini API) and sends the `finalPrompt` to the `gemini-2.5-flash` model.
*   **Response Handling:** It extracts the markdown content from the AI's response, logs it, and returns it as a JSON response to the client. Comprehensive error handling is implemented for unsupported file types, missing input, and AI generation failures.

### Utility Libraries (`lib/`)
*   `lib/document-parser.ts`: Contains asynchronous functions (`getTextFromDocx`, `getTextFromPdf`, `getTextFromPptx`) that abstract the process of extracting text from various document formats. It uses external libraries (`mammoth`, `pdf-parse`, `pptx-text-parser`) and handles temporary file creation/deletion for PPTX parsing.
*   `lib/markmap-renderer.ts`: This file contains the core logic for rendering the Markmap markdown into an interactive mind map. It defines functions for parsing markdown into a tree structure (`parseMarkmap`), measuring node dimensions (`measureNodeSizes`), laying out the nodes (`layoutTree`), drawing SVG connectors (`drawConnector`), and rendering the nodes and their children (`renderNodeAndChildren`). Key interaction logic has been updated: it now performs an **auto-fit** on initial render to show the full mind map. This auto-fit view is maintained during live streaming updates but is disabled as soon as the user manually pans or zooms, giving them control. The node collapsing behavior has been changed to be opt-in (using a markdown comment) rather than automatic. The `getFullMindMapBounds` function is crucial for this auto-fit capability and for export functionalities.
### Flashcards Generation (`app/api/generate-flashcards/route.ts`)
*   Two input modes:
    - JSON POST with `{ markdown: string, numCards?: number }` (existing behavior) to synthesize flashcards from Markmap markdown. Streaming supported when `?stream=1` and emits NDJSON lines.
    - `FormData` POST with one or more `files` and optional `prompt` to generate flashcards directly from uploaded content (PDF/DOCX/PPTX/TXT/MD and images). Documents are parsed with `lib/document-parser.ts`; images are attached for multimodal OCR/diagram understanding. Streaming supported via NDJSON.
*   Returns `{ title?: string, cards: { question: string, answer: string, tags?: string[] }[] }`.
*   The prompt instructs the model to emit a strict JSON object; the handler defensively extracts a JSON object from the response.
*   Saving: when a user is authenticated, the UI saves generated flashcards to Supabase with the original mind map markdown snapshot, derived title, and the JSON array of cards.
*   Retrieval: when `MindMapModal` opens for a given markdown, it first looks in an in-memory cache; if not found, it checks `localStorage` using a SHA‑256 hash of the markdown for an instant hit; if still not found and the user is signed in, it queries Supabase (`flashcards`) by `user_id` and `title` only (newest `created_at`) to avoid sending the full markdown over the network. On success, it mirrors the deck into `localStorage` and updates it with the Supabase `id` after save.

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

### Gating Logic (One Free Generation)
*   On the landing page, if a generation succeeds while the user is not signed in, the app sets `localStorage.freeGenerationUsed = 'true'` and automatically opens the sign-up modal. Subsequent attempts without signing in will prompt sign-up instead of calling the API.
*   Once signed in, users can generate without limits (subject to any backend quotas you impose) and results are persisted to their Supabase history.

### Flashcards Persistence (Supabase)
*   Two save paths:
    1) From `MindMapModal` (from an existing mind map): inserts into `flashcards` with:
       - `user_id`: the authenticated user's id
       - `title`: extracted from `#` heading or `title:` in frontmatter
       - `markdown`: the source Markmap markdown snapshot at the time of generation
       - `cards`: an array of `{ question, answer, tags? }` (stored as `jsonb`)
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
NEXT_PUBLIC_BASE_URL=your_production_domain # Optional: defaults to deployment URL
```

### Paddle Billing integration

- We use Paddle.js to:
  - Preview localized prices on the pricing page via `Paddle.PricePreview()`.
  - Open overlay checkout with `Paddle.Checkout.open()`.
- Integration lives in `components/PricingClient.tsx` and is mounted from `app/pricing/page.tsx`.
- Webhooks are handled at `app/api/paddle-webhook/route.ts` to manage subscriptions and credit accounting.

### Webhooks and Credit System

- **Webhook Endpoint**: The application exposes a webhook endpoint at `/api/paddle-webhook` to receive notifications from Paddle.
- **Signature Verification**: All incoming webhooks are verified using HMAC-SHA256 to ensure they originate from Paddle.
- **Credit Accounting**:
  - Monthly credits are granted based on the user’s plan. Tables used: `customers`, `subscriptions`, and `user_credits` in Supabase.
  - Events handled: `subscription.created`, `subscription.updated`, `subscription.canceled` to provision/update/revoke credits automatically.
  - **Per‑request deduction (server‑side enforced)**:
    - 1 credit = 3,800 characters of text.
    - For document uploads, the backend extracts text (PDF/DOCX/PPTX/TXT/MD) and counts characters from the extracted text plus any prompt provided.
    - For image‑only requests, a minimum of 0.5 credits is charged.
    - For prompt‑only requests (no file uploads), a minimum of 1 credit is charged; if the pasted prompt exceeds 3,800 characters, credits are calculated proportionally to the text length.
    - Deduction happens at the start of generation. If streaming fails before any data is sent, the reserved credits are refunded automatically.
    - Applies to both endpoints: `POST /api/generate-mindmap` and `POST /api/generate-flashcards` (JSON and multipart modes).
  - **Auth requirement for deduction**: Requests must include a valid Supabase access token in the `Authorization: Bearer <token>` header so the server can identify `user_id` and deduct from `user_credits`.
    - The app’s client code automatically attaches this header when a user is signed in.
  - **Insufficient credits UX**: When the server returns `402` with the message "Insufficient credits. Please upgrade your plan or top up.", the client shows this error inline with an adjacent "Upgrade Plan" button (same behavior as the Upgrade button on the landing page).
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
