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
*   **Smart File Caching & Pre-processing:** Advanced caching system prevents redundant file processing when users add/remove files. Files are automatically pre-processed immediately upon upload to extract text and images, eliminating the wait time when clicking Generate. Uses content-based hashing to ensure consistent caching across different environments (localhost/production) and browsers. Only changed file combinations trigger re-processing, significantly improving performance for multi-file uploads. Uploads are offloaded to Supabase Storage to bypass Vercel's ~4.5 MB body limit; client-side validation now allows up to 50 MB per file. **Real-time Upload Progress:** Users see live progress percentages (e.g., "Uploading (57%)") during file uploads, providing clear feedback on upload status and improving user experience.
*   **Credit Loading Optimization:** Instant credit balance display with intelligent caching system. Credits load immediately on dashboard refresh using localStorage cache (5-minute expiration) with background refresh for accuracy. Eliminates the brief "0.0" flash that occurred during sequential API calls.
*   **Referral Program:** Invite friends directly from the dashboard settings panel so you and every successful referral both receive 30 bonus credits (limited to three rewards per calendar month for the inviter).
*   **Multiple Export Options:** Users can download the generated mind maps in various formats including SVG, PNG, and PDF.
*   **Flashcards Generation (Two ways):**
    - From Mind Map: After a mind map is generated, users can generate study flashcards from the Markmap markdown and switch between the mind map view and a flashcards study mode.
    - Direct from Files: On the generator, a selector lets users choose "Flashcards" to generate flashcards directly from uploaded documents/images (without first creating a mind map). The backend accepts `FormData` uploads and streams NDJSON lines for incremental flashcards.
*   **Persistent Study Progress:** The flashcard study interface automatically remembers the user's last viewed card position, even after closing the modal, refreshing the page, or reopening the browser. This works for both saved decks (using deck ID) and unsaved decks (using a unique identifier based on deck content). Progress is stored locally and persists across sessions.
*   **Interleaved Study Mode:** Advanced spaced repetition feature that interleaves cards from multiple decks to maximize learning effectiveness. When you have due cards from different subjects, this mode presents them in a randomized order while ensuring no two consecutive cards are from the same deck, forcing beneficial context switching that improves long-term retention. Each card maintains its individual deck's exam date and scheduling preferences.
*   **Auth & History:** Users must sign in (Email magic link or Google) to generate mind maps or flashcards. Signed-in users get a dashboard with a unified reverse-chronological history of both mind maps and flashcards. Items show lucide icons (map vs card). Mind maps are stored as Markmap markdown; flashcards are stored as a JSON array (and may omit markdown when generated directly from files/prompts).
*   **Public Link Sharing:** Users can create shareable public links for their mind maps and flashcard decks from the dashboard history. These links allow anyone with the URL to view the content without signing in. The sharing system includes intelligent content deduplication, automatic import for signed-in users, and secure token-based access control.
*   **Seamless Save on Sign-Up:** When a non-authenticated user generates a mind map and then signs up to save it, the mind map is automatically saved to their new account and appears in their history, ensuring no work is lost.
*   **Localized Date Formatting:** All dates and times are automatically displayed in the user's preferred locale format (dd/mm/yy, mm/dd/yy, etc.) based on their browser's language settings. This ensures users see dates in their familiar format whether they prefer European (dd/mm), American (mm/dd), or other regional date conventions.

## Public Link Sharing System

CogniGuide includes a comprehensive public link sharing system that allows users to share their mind maps and flashcard decks with anyone via secure, token-based URLs. This feature enhances collaboration and content sharing while maintaining security and user control.

### Key Features

*   **Secure Token-Based Access:** Uses cryptographically signed tokens to control access to shared content
*   **Content Deduplication:** Automatically detects and prevents duplicate imports when users access shared content they already own
*   **Automatic Import:** Signed-in users can seamlessly import shared content with a single click
*   **No Authentication Required:** Anyone with a share link can view the content without signing in
*   **Owner Verification:** Only content owners can create share links for their items
*   **Share Link Caching:** Frontend caches generated share links to improve performance

### How It Works

#### 1. Creating Share Links
- Users access the sharing feature through the "Share" option in the history item dropdown menu on the dashboard
- The system verifies the user owns the item before allowing share link creation
- A secure token is generated using HMAC-SHA256 signature with the user's content ID and type
- The token is embedded in a public URL: `/share/{type}/{token}` (e.g., `/share/mindmap/abc123.def456`)

#### 2. Token Generation & Security
- **Token Format:** `{payload}.{signature}` where payload contains the content type and ID
- **Signing Algorithm:** HMAC-SHA256 using a secret key (SHARE_LINK_SECRET or SUPABASE_SERVICE_ROLE_KEY)
- **Base64 URL Encoding:** Tokens use URL-safe base64 encoding for compatibility
- **Timing-Safe Verification:** Server-side verification prevents timing attacks
- **Token Validation:** Tokens include type checking and ownership verification

#### 3. Accessing Shared Content
- When someone visits a share link, the system validates the token and retrieves the original content
- Content is displayed using the same viewer components (MindMapModal/FlashcardsModal) as the original
- For authenticated users, an "Import" button allows them to save the shared content to their own account

#### 4. Smart Import Logic
- **Deduplication Check:** Before importing, the system checks if the user already has identical content
- **Content Matching:** Compares content by markdown (for mind maps) or cards array (for flashcards)
- **Automatic Import:** If content doesn't exist, it's automatically imported to the user's account
- **User Feedback:** Clear messaging indicates whether content was imported or already owned

### Technical Implementation

#### API Endpoints

**Share Link Creation** (`POST /api/share-link`)
- Accepts: `{ itemId: string, itemType: 'mindmap' | 'flashcards' }`
- Authentication: Required (Bearer token)
- Process: Verifies ownership → generates token → returns share URL
- Response: `{ ok: true, token: string, url: string }`

**Share Link Import** (`POST /api/share-link/import`)
- Accepts: `{ token: string }`
- Authentication: Required (Bearer token)
- Process: Validates token → checks for existing content → imports if needed
- Response: `{ ok: true, recordId: string, alreadyOwned: boolean }`

#### Token Management (`lib/share-links.ts`)
- `createShareToken(type, id)`: Generates signed tokens for sharing
- `verifyShareToken(token)`: Validates and decodes share tokens
- Security: Uses timing-safe comparison for signature verification
- Error Handling: Comprehensive validation with detailed error messages

#### Frontend Integration (`components/ShareViewer.tsx`)
- Handles display of shared content for both mind maps and flashcards
- Automatically attempts to import content when user is authenticated
- Manages authentication state changes during the import process
- Provides seamless viewing experience identical to owned content

#### Dashboard Integration (`app/dashboard/DashboardClient.tsx`)
- Share buttons in history item dropdown menus
- Modal for displaying and copying share links
- Link caching to avoid redundant API calls
- Copy-to-clipboard functionality with user feedback
- Error handling for failed share operations

### Security Features

*   **Ownership Verification:** Only content owners can create share links
*   **Token Expiration:** Tokens are cryptographically signed but don't include explicit expiration (relying on content ownership for revocation)
*   **Content Isolation:** Shared content is served without exposing the original owner's account information
*   **Secure Defaults:** All sharing operations require explicit user action
*   **Audit Trail:** Share operations are tracked via PostHog analytics

### User Experience

#### For Content Creators:
1. Click the "⋮" menu on any history item
2. Select "Share" to open the share modal
3. Click "Create Link" to generate a shareable URL
4. Copy the link and share it with others
5. The link can be used immediately and remains functional until the content is deleted

#### For Content Consumers:
1. Click a shared link to view the content
2. If signed in, click "Import" to save to your account
3. If not signed in, view the content directly
4. Imported content appears in your dashboard history

### Integration with Existing Features

- **Spaced Repetition:** Imported flashcards maintain their scheduling state and can be studied immediately
- **History Management:** Imported items appear in the unified history with proper timestamps
- **Export Functions:** All export options (SVG, PNG, PDF) work with shared content
- **Search & Organization:** Shared content can be renamed and managed like owned content

### Analytics & Monitoring

The sharing system includes comprehensive analytics tracking:
- Share link creation events
- Successful imports
- Failed sharing attempts
- Content view counts (via share page visits)

This data helps improve the sharing experience and understand content usage patterns.

## Referral Program

CogniGuide includes a built-in referral system that rewards existing users with bonus credits whenever a friend signs up using their unique invite link.

### How It Works

1. Each authenticated user receives a persistent referral code (and link) that can be copied from the dashboard settings panel.
2. When the invite link is shared, the landing page captures the `?ref=` query parameter and stores it locally until the visitor signs up.
3. After the new user completes sign-in, the dashboard automatically redeems the stored referral code.
4. Both the referrer and the new user instantly receive **30 bonus credits** for the successful signup. Rewards are limited to **three redemptions per calendar month** for the referrer to prevent abuse.
5. The redeemer sees a confirmation popup on their first dashboard visit so they immediately know the bonus credits were applied.

### Backend Schema

- `referral_codes (user_id, code, created_at)`: Stores the unique invite code for each user.
- `referral_redemptions (referrer_id, referral_code, referred_user_id, reward_credits, created_at)`: Records every successful referral and enforces one redemption per referred account.
- `increment_user_credits(p_user_id uuid, p_amount numeric)`: Security-definer function that atomically increments `user_credits` without disturbing the monthly refill timestamp. The referral API uses this RPC to grant rewards.

Run Supabase migrations after pulling these changes so the new tables and function are created: `supabase db push` or `supabase migration up` (depending on your workflow).

### API Endpoints

- **GET /api/referrals/link**: Authenticated endpoint that ensures a user has a referral code, returns the invite URL, and reports current-month redemption totals.
- **POST /api/referrals/link**: Alias of the GET endpoint for clients that prefer POST.
- **POST /api/referrals/redeem**: Accepts `{ code: string }` and rewards both the referrer and the redeemer with 30 bonus credits when the code is valid, not self-redeemed, and under the monthly cap. Returns updated monthly statistics and the referrer’s latest credit balance, along with the redeemer’s new credit total.

All referral endpoints authenticate via the Supabase service role key and return structured JSON with helpful error messages for UI handling.

### Frontend Integration

- **Landing Page (`components/HomeLanding.tsx`)**: Detects `?ref=...` in the URL and stores the value in `localStorage` so the referral survives the sign-up flow.
- **Dashboard (`app/dashboard/DashboardClient.tsx`)**:
  - Automatically redeems any stored referral code immediately after authentication.
  - Adds a “Refer friends (earn credits)” button in the settings/profile modal. Opening the panel fetches the invite link, shows monthly progress, and provides copy-to-clipboard helpers.
  - Displays real-time monthly usage so users know how many rewards remain before hitting the cap.

Analytics events (`posthog.capture`) track when referral links are opened, loaded, copied, and redeemed to inform future optimizations.

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
*   **Content Limits by User Tier**: All document parsing functions (`getTextFromPdf`, `getTextFromDocx`, `getTextFromPptx`) automatically limit extracted content based on user tier:
    *   **Non-authenticated users**: 1 credit worth (3,800 characters)
    *   **Free plan users**: 5 credits worth (19,000 characters)
    *   **Paid plan users**: 30 credits worth (114,000 characters)
    Content exceeding tier limits is truncated at word boundaries with a message indicating the user should sign up or upgrade for more access.
    *   **Performance Optimization**: User tier information is cached in memory for 5 minutes to avoid repeated database queries, ensuring fast response times for logged-in users.
*   **Credit Loading Optimization**: Instant credit balance display with localStorage caching (5-minute expiration) and parallel loading eliminates sequential API calls and the brief "0.0" flash during dashboard refresh.
    *   **Smart File Processing Cache**: The frontend implements intelligent file set caching and immediate pre-processing to prevent redundant document processing and eliminate generation wait times. When users upload multiple files, the system:
        - Generates a unique key using content-based hashing (first 512 bytes of each file) combined with file metadata (name, size, type)
        - Ensures consistent caching across different environments (localhost/production) and browsers
        - Automatically pre-processes files immediately upon upload, extracting text and images in the background
        - Caches complete processing results for each unique file combination (5-minute validity)
        - Only re-processes when the file set actually changes (files added/removed/modified)
        - Automatically cleans up old cache entries (keeps last 10) to prevent memory issues
        - Includes development-mode debug logging for production troubleshooting
        - Includes client-side file size validation (25 MB per file limit when using Supabase Storage)
        - **Automatic Storage Cleanup:** Files uploaded to Supabase Storage are automatically deleted immediately after successful processing to prevent hitting the 500MB free tier limit. Includes both immediate cleanup after generation and scheduled cleanup (24-hour safety net) via Vercel Cron Jobs.
    - **Critical Fix**: File keys are sanitized to `[A-Za-z0-9._-]` to prevent pipe characters ("|") from breaking Supabase signed uploads. Raw keys like `name|size|type|hash` were causing `createSignedUploadUrl`/`uploadToSignedUrl` failures, forcing fallback to legacy multipart uploads which hit Vercel's 4.5MB limit → 413 errors.
    - **Fallback Guards**: Legacy multipart uploads (>4MB total) are blocked with clear error messages to prevent 413 responses. When storage pre-parse fails, users see actionable errors instead of cryptic server errors.
        - Instantly serves cached results for identical file combinations, enabling immediate generation after clicking Generate
     *   **Mind Map Rendering:** The application uses a custom Markmap-like renderer implemented in `lib/markmap-renderer.ts` (and embedded within `components/MindMapModal.tsx` for HTML export). This renderer handles parsing markdown, measuring node sizes, laying out the tree, and drawing SVG connectors and HTML nodes. It includes logic for color variations, node collapsing/expanding, and pan/zoom functionality. It now features an intelligent **auto-fit-to-view** that centers and scales the mind map to be fully visible on initial load and during streaming. This behavior stops once the user interacts with the map. Additionally, automatic collapse to main branches after generation is gated: it applies to non-authenticated users and to authenticated users who have never generated a mind map before; returning authenticated users keep the full expansion by default.
        *   **Performance Optimizations:** Implemented requestAnimationFrame-based transform scheduling, cached viewport rect to prevent layout thrash, transient `will-change: transform` on container during interactions only, and removed node box-shadows globally for smoother panning/zooming without blurriness.
    *   **Advanced Caching System:** Single measurement host with KaTeX-aware caching prevents redundant DOM measurements and math rendering during node sizing calculations.
    *   **Optimized Collapse Animations:** Transform-based animation engine eliminates per-frame left/top updates, using CSS transforms for smoother node collapsing/expanding with reduced layout thrash.
    *   **Smart Cache Invalidation:** Automatic cache clearing on theme changes and cleanup prevents memory leaks while maintaining accuracy across light/dark modes.
    *   **Touch Support:** The renderer now includes comprehensive touch event handling for mobile devices, enabling single-finger panning and two-finger pinch-to-zoom gestures for intuitive navigation.
    *   **Incremental Updates:** The renderer exposes an `updateMindMap(markdown: string)` function to support incremental re-rendering while the model is streaming output, enabling smooth progressive visualization.
*   **Spaced Repetition:** TS-FSRS (Free Spaced Repetition Scheduler) algorithm implementation for optimal flashcard scheduling. The `ts-fsrs` library provides FSRS-6 algorithm with configurable parameters for difficulty, stability, and optimal review timing.
*   **Analytics & Event Tracking:** PostHog integration for comprehensive user behavior analytics, feature flag management, and A/B testing capabilities.
*   **Authentication & DB:** Supabase is used for authentication (email magic link and Google OAuth) and to persist user mind map history and flashcard data (only markdown is stored for mind maps, full flashcard data with scheduling state).
*   **Image Generation:** `html-to-image` is used in `components/MindMapModal.tsx` to convert the rendered mind map (a DOM element) into SVG or PNG images for export.
 *   **PDF Generation:** Users can export to PDF from `components/MindMapModal.tsx`. The export functionality generates a PNG image of the mind map, cropped to its contents, and embeds it into a PDF document using `jsPDF`. This creates a rasterized, non-interactive PDF of the mind map.
*   **Localized Date Formatting:** The application automatically detects and uses the user's browser locale for all date and time displays throughout the interface. This ensures users see dates in their preferred format (dd/mm/yy, mm/dd/yy, etc.) rather than being forced into a single regional format. The implementation uses `navigator.language` to detect the user's locale and applies it consistently across date pickers, flashcard due dates, history timestamps, and calendar components.

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
*   **Exam Date Constraints:** Prevents review scheduling beyond specified exam dates, with a 24-hour grace period after exam completion during which due cards continue to appear in spaced repetition. After the 24-hour grace period, the exam date is automatically cleared and the deck reverts to standard FSRS scheduling without exam constraints
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

### Exam Date User Flow
The exam date feature provides intelligent scheduling that adapts to your study needs:

1. **Before Exam:** When you set an exam date, the FSRS algorithm ensures all reviews are scheduled before your exam date. Cards that would normally be scheduled after your exam are automatically clamped to your exam date.

2. **During Exam Day:** On your exam date, due cards continue to appear normally in your spaced repetition queue.

3. **Post-Exam Grace Period (0-24 hours after exam):**
   - Cards that become due during this period are scheduled for immediate review (due now)
   - This creates intensive cramming sessions to reinforce material immediately after the exam
   - All cards appear as "due now" regardless of their normal FSRS schedule

4. **After 24-Hour Grace Period:**
   - When you next open the deck after 24 hours have passed since your exam
   - The exam date is automatically cleared from all cards
   - Future scheduling reverts to standard FSRS algorithm without exam constraints
   - Cards resume their normal spaced repetition intervals based on difficulty and stability

5. **Automatic Cleanup:** If you haven't opened a deck for more than 24 hours after its exam date, the next time you open it, the system automatically removes the exam constraint and lets FSRS work normally.

This behavior ensures you get the benefits of exam-focused scheduling during preparation, intensive review immediately after the exam, and seamless transition back to optimal long-term retention scheduling afterward.

### Interleaved Study Mode
CogniGuide implements an advanced interleaved study feature that maximizes learning effectiveness by forcing beneficial context switching:

#### How It Works
1. **Multi-Deck Collection:** When you have due cards from multiple flashcard decks, the "Study All Due Cards (Interleaved)" option collects all due cards across all your decks.

2. **Intelligent Shuffling:** Cards are randomized while ensuring no two consecutive cards belong to the same deck, creating optimal context switching.

3. **Preserved Individuality:** Each card maintains its parent deck's properties:
   - **Exam Date:** Individual deck exam dates are respected and applied during grading
   - **Scheduling State:** Progress updates are saved back to the original deck's schedule
   - **Deck Identity:** The modal title shows the current card's parent deck name

4. **Research-Backed Benefits:** This interleaving approach leverages "discriminative contrast" - the cognitive benefit of switching between different topics, which strengthens memory and improves the ability to apply knowledge in new situations.

#### Usage
- Access interleaved study from the Spaced Repetition modal on the dashboard
- Click "Study All Due Cards (Interleaved)" to begin
- Cards will be presented in an optimal mixed order
- Progress on each card updates its original deck's spaced repetition schedule
- The modal title dynamically shows which deck each card belongs to

#### Technical Implementation
- Uses lodash.shuffle for randomization
- Maintains due card queue integrity across decks
- Preserves individual deck exam date constraints
- Syncs grading results back to parent deck schedules
- Tracks interleaved sessions in analytics for optimization

## Project Structure Highlights

### Frontend (`app/page.tsx` and `components/`)
*   `app/page.tsx`: The main client-side page (`'use client'`). It serves as the orchestrator for the application's UI and logic. It manages the core state (selected file, prompt text, loading status, errors, generated markdown) and handles the submission process to the backend API. It also includes the hero section, "Why Mind Maps" section, "Generator" section, "How It Works" section, and "Features" section, providing a comprehensive user experience. Requires user authentication before allowing any generations - when users click generate without signing in, it opens the sign-up modal. When signed in, it saves the generated markdown to Supabase.
*   `components/Dropzone.tsx`: A React component that provides a drag-and-drop area for file uploads. It supports PDF, DOCX, PPTX, TXT, and MD file types. It displays the selected file's name and size, and allows users to remove the file. It manages drag-and-drop states and visually indicates when a file is being dragged over. **Upload Progress:** Shows real-time progress percentages (e.g., "Uploading (57%)") during file uploads for better user feedback.
*   `components/PromptForm.tsx`: A React component for users to input text prompts. It includes a `textarea` that auto-resizes and a "Generate Mind Map" button with a loading spinner. It handles form submission and passes the prompt text to the parent component.
*   `components/MindMapModal.tsx`: A modal component that displays the generated mind map and handles flashcard generation from mind map content. It integrates the custom Markmap renderer (`initializeMindMap` from `lib/markmap-renderer.ts`) to visualize the markdown. It provides functionality to download the mind map in SVG, PNG, and PDF formats. For PNG and PDF exports, the mind map is automatically cropped to its content to avoid empty margins. The PDF export embeds a rasterized PNG image of the mind map. It also handles the modal's open/close state and cleanup of event listeners.
    * **Flashcard Integration**: Includes a "Generate Flashcards" button that generates study flashcards from the current Markmap markdown using the `/api/generate-flashcards` endpoint. The generation logic is handled locally while the UI presentation is delegated to `FlashcardsModal` for consistency. When in flashcard mode, the mind map viewport is hidden and the renderer is cleaned up; it re-initializes when returning to the map view.
*   `components/FlashcardsModal.tsx`: **Centralized flashcard component** used by both the dashboard (for direct file generation) and `MindMapModal` (for mind map-derived flashcards). Provides a unified, consistent flashcard study experience across the application.
    * **Unified UI**: Features a sleek, colorful study interface with gradient progress bar and color-coded rating buttons (Again/Hard/Good/Easy).
    * **Date Picker Integration**: Uses a custom DatePicker component (`components/DatePicker.tsx`) that wraps React Day Picker with theme-aware styling to match the app's color scheme for both light and dark modes. Enables setting exam dates that influence FSRS scheduling algorithms.
    * **Streaming Support**: Supports real-time streaming display (NDJSON) for incremental flashcard generation.
    * **Spaced Repetition**: Implements FSRS-6 algorithm with Supabase-backed persistence. Includes deck-level exam date constraints that are ignored after the exam date has passed (allowing normal FSRS scheduling), with a 24-hour grace period during which due cards continue to appear in spaced repetition. Per-card scheduling includes difficulty, stability, reps, lapses, last_review, due dates, and cross-device synchronization via Supabase (`flashcards_schedule`) table.
    * **Performance Optimizations**: Uses prefetched scheduling data cached in memory and localStorage for instant loading. Includes cache-only recompute paths for offline functionality.
    * **Clean Interface**: Hides internal FSRS metrics while maintaining powerful spaced repetition capabilities.
*   `components/Generator.tsx`: The core file upload and generation component that powers both mind map and flashcard creation. Features intelligent file processing with smart caching to prevent redundant re-processing when users add/remove files. Handles file validation, pre-processing via the `/api/preparse` endpoint, credit checking, and orchestrates the generation workflow for both mind maps and flashcards.
    * **Smart File Caching**: Implements robust file set caching with content-based hashing to ensure consistent caching across different environments (localhost/production) and browsers. Caches complete processing results for each unique combination of files, dramatically improving performance for iterative multi-file workflows. Includes development-mode debug logging for production troubleshooting.
    * **Layout Constraints & Width Adjustments**: The Generator component's width is constrained by both internal `max-w-*` classes and external wrapper constraints. When adjusting the width:
        - **Internal Constraints**: The component itself has `max-w-*` classes (currently `max-w-none` for full expansion) that control the maximum width within its container
        - **External Constraints**: In `app/page.tsx`, the Generator is wrapped with width classes (currently `flex-1 w-full`) that determine how much space it occupies in the flex layout
        - **Layout Structure**: The component uses a flex layout where the left side (headline) has fixed width (`lg:w-[28rem] xl:w-[32rem]`) and the right side (Generator) takes remaining space (`flex-1`)
        - **Width Adjustment Process**: To increase width, adjust both the Generator's internal `max-w-*` constraint AND the wrapper's width allocation. Simply changing one without the other won't produce visible results due to the flex layout structure
        - **Compact Mode**: The `compact` prop affects styling but doesn't change width constraints - those must be adjusted separately
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

## shadcn/ui Integration

CogniGuide now includes comprehensive shadcn/ui integration while preserving the exact existing color scheme and design system. This ensures seamless component usage without breaking the established visual identity.

### Key Features

*   **Seamless Color Preservation**: shadcn/ui components automatically use the existing custom color variables (`--color-primary`, `--color-background`, etc.) defined in `app/globals.css`
*   **CSS Variables Integration**: Components use semantic color classes that map to your existing theme, ensuring perfect visual consistency
*   **Zero Breaking Changes**: All existing components and styling remain unchanged
*   **Component Library**: Access to the full shadcn/ui ecosystem for rapid UI development

### Configuration

The integration is configured in `components.json`:
- `cssVariables: false` - Prevents shadcn from generating conflicting CSS variables
- `baseColor: "slate"` - Uses slate as base but components inherit your custom colors
- Standard shadcn setup with Poppins font and Lucide icons

### Available Components

Currently installed shadcn/ui components:
*   **Button** - Multiple variants (default, outline, secondary, ghost, link) with semantic color classes
*   **Card** - Card container with Header, Title, Description, Content, Footer
*   **Input** - Form input field with focus states and validation styles
*   **Label** - Form label component

The component will automatically:
- Use your existing color scheme via semantic classes (`bg-primary`, `text-primary-foreground`, etc.)
- Inherit your design system (rounded corners, shadows, typography)
- Work seamlessly with light/dark mode
- Maintain accessibility standards

### Component Customization

When customizing shadcn components, use the semantic color classes defined in `app/globals.css`:
- `bg-primary` / `text-primary-foreground` - Primary actions and branding
- `bg-secondary` / `text-secondary-foreground` - Secondary elements
- `bg-accent` / `text-accent-foreground` - Hover states and highlights
- `bg-muted` / `text-muted-foreground` - Subtle text and backgrounds
- `border-border` - Consistent border colors
- `ring-ring` - Focus ring colors

- **Accessibility/Feel**: Keep hover states subtle, focus-visible rings on interactive elements, and avoid dark backgrounds/panels.

### FlashcardsModal Styling Guidelines
To ensure consistent light and dark mode appearance in `components/FlashcardsModal.tsx`, follow these conventions:
1. Use the `flashcard-due-pill` class for the due date pill:
   - Light mode: `bg-sky-50 text-sky-700`
   - Dark mode: `dark:bg-sky-900/30 dark:text-sky-300`
2. Use the `flashcard-grade-{again,hard,good,easy}` utility classes for the grading buttons:
   - Light mode definitions (in `app/globals.css`):
     ```css
     .flashcard-grade-again { @apply border-red-200 bg-red-50 text-red-700 hover:bg-red-100; }
     .flashcard-grade-hard  { @apply border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100; }
     .flashcard-grade-good  { @apply border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100; }
     .flashcard-grade-easy  { @apply border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100; }
     ```
   - Dark mode overrides:
     ```css
     .flashcard-grade-again { @apply dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50; }
     .flashcard-grade-hard  { @apply dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50; }
     .flashcard-grade-good  { @apply dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50; }
     .flashcard-grade-easy  { @apply dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50; }
     ```
3. Apply these classes directly in the JSX of `FlashcardsModal.tsx` instead of inline color utilities.
4. Verify definitions in `app/globals.css` to avoid mismatches.

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

### Authentication & Redirect Optimization
*   **Fast Auth Detection:** To eliminate 2-3 second delays when authenticated users visit the landing page, the app uses a lightweight first-party cookie (`cg_authed`) that syncs with Supabase authentication state.
*   **Cookie Synchronization:** The `cg_authed` cookie is set/updated in `components/HomeLanding.tsx` whenever auth state changes (sign-in/sign-out). This provides instant server-side detection without waiting for Supabase session verification.
*   **Server-Side Redirect Logic:**
    - **Middleware** (`middleware.ts`): Checks `cg_authed=1` first, then falls back to Supabase cookie pattern (`sb-*-auth-token`) for immediate redirects
    - **Page Component** (`app/page.tsx`): Server-side check prioritizes `cg_authed` cookie before Supabase verification
*   **Maintenance Notes:**
    - Keep cookie sync logic in `HomeLanding.tsx` consistent with auth state changes
    - Cookie expires after 30 days and uses secure, same-site settings
    - Always check lightweight cookie first before expensive Supabase operations
    - If modifying auth flow, ensure cookie updates happen immediately after session changes
*   **Performance Impact:** Eliminates perceived latency for returning users by avoiding client-side auth roundtrips

#### ⚠️ Critical Sign Out Bug Fix
*   **Issue**: After implementing middleware auto-redirect, users could get stuck in dashboard after signing out
*   **Root Cause**: The `cg_authed` cookie wasn't being cleared during sign out, causing middleware to redirect back to dashboard
*   **Symptom**: Users click "Sign out" → page appears stuck → history doesn't load → can't access landing page → must manually delete cookies
*   **Solution**: Always clear `cg_authed` cookie in `handleSignOut` before redirecting:
    ```typescript
    const handleSignOut = async () => {
      posthog.capture('user_signed_out');
      await supabase.auth.signOut();

      // CRITICAL: Clear auth cookie to prevent middleware redirect loop
      try {
        if (typeof document !== 'undefined') {
          document.cookie = 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
        }
      } catch {}

      router.replace('/');
    };
    ```
*   **Prevention**: When modifying auth flows, always ensure cookies are properly cleared on sign out to prevent redirect loops
*   **Testing**: Verify sign out works by checking cookie is cleared and user can access landing page without redirects

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
*   **Purpose:** Ensures users have the correct credit allocation based on their subscription status and returns current credit balance
*   **Method:** POST/GET
*   **Authentication:** Required (Bearer token in Authorization header)
*   **Functionality:**
    - Checks for active subscription status
    - For free users: Grants initial credits and handles monthly refills
    - For paid users: Returns current credits without modification (handled via webhooks)
    - Prevents duplicate credit entries using upsert operations
    - Tracks last refill date to manage monthly cycles
    - **Optimized Performance:** Returns current credit balance in single API call, eliminating need for separate database queries
    - **Smart Caching:** Frontend uses localStorage cache (5-minute expiration) with background refresh for instant loading

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
*   **Purpose:** Pre-processes uploaded files immediately upon selection to extract text and prepare content for generation, eliminating wait times when clicking Generate
*   **Method:** POST
*   **Content-Type:** multipart/form-data
*   **Functionality:**
    - Accepts multiple file uploads (PDF, DOCX, PPTX, TXT, MD, images)
    - Extracts text content using `lib/document-parser.ts`
    - Converts images to base64 data URLs for multimodal processing
    - Returns combined text and image data for efficient processing
    - Provides character count for credit calculation
    - **Smart Caching Integration:** Frontend implements robust file set caching with content-based hashing to avoid redundant API calls. Files are pre-processed immediately upon upload and cached for 5 minutes. Ensures consistent caching across different environments (localhost/production) and browsers. Only processes when file combinations actually change, significantly improving performance for iterative workflows. Includes development-mode debug logging for production troubleshooting.
    - **Large File Support:** JSON mode also accepts Supabase Storage object paths (see below) to handle large uploads beyond Vercel limits
    - **File Size Validation:** Client-side validation allows up to 25 MB per file when using Supabase Storage

#### Storage Upload API (`app/api/storage/get-signed-uploads/route.ts`)
*   Purpose: Generate signed upload URLs for each file so the browser uploads directly to Supabase Storage (private `uploads` bucket), avoiding Vercel's ~4.5 MB request limit
*   Method: POST
*   Content-Type: `application/json`
*   Input: `{ files: [{ name, size, type }], anonId?: string }`
*   Output: `{ bucket: 'uploads', items: [{ path, token }] }`
*   Flow: The client receives `{path, token}` per file and uses `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)` to upload
*   **Critical Implementation Details**:
    - **File Key Sanitization**: Keys are strictly sanitized to `[A-Za-z0-9._-]` to prevent pipe characters ("|") from breaking signed uploads
    - **File Set Key Separator**: Uses double underscore (`__`) instead of double pipe (`||`) to avoid conflicts with backend validation regex
    - **Path Format**: `users/{userId}/YYYY-MM-DD/{sanitizedKey}/{filename}` or `anon/{anonId}/YYYY-MM-DD/{sanitizedKey}/{filename}`
    - **Fallback Prevention**: Guards in client code prevent legacy multipart fallbacks when storage fails, avoiding 413 errors
*   Notes:
    - Bucket: Create a private bucket named `uploads` in Supabase Storage
    - Security: Files remain private; the server (with Service Role) downloads them for preprocessing; the client never gets permanent public URLs
    - **Image Processing**: Images are downloaded from Storage and converted to base64 data URLs for AI processing (Gemini API cannot access signed URLs)
    - **Troubleshooting**: If uploads fail, check that keys don't contain special characters that break URL generation

#### Preparse JSON (Storage) Mode
*   The preparse API now accepts a JSON payload: `{ bucket: 'uploads', objects: [{ path, name?, type?, size? }] }`
*   For non-image files, the server downloads from Storage and extracts text; for images, it downloads from Storage, converts to base64 data URLs, and includes them in `images`
*   Response shape is identical to multipart mode: `{ text, images, totalRawChars, maxChars, limitExceeded, includedFiles, excludedFiles, partialFile }`

#### Storage Cleanup API (`app/api/storage/cleanup/route.ts`)
*   **Purpose:** Immediately deletes uploaded files from Supabase Storage after successful processing to prevent hitting the 500MB free tier limit
*   **Method:** POST
*   **Content-Type:** `application/json`
*   **Input:** `{ paths: string[] }` - Array of file paths to delete
*   **Output:** `{ deleted: number }` - Number of files successfully deleted
*   **Integration:** Automatically called after successful mind map or flashcard generation
*   **Error Handling:** Failures are logged but don't break the generation process

#### Scheduled Storage Cleanup API (`app/api/storage/scheduled-cleanup/route.ts`)
*   **Purpose:** Scheduled cleanup job that deletes files older than 24 hours as a safety net
*   **Method:** GET (triggered by Vercel Cron)
*   **Schedule:** Daily at 2 AM (`"0 2 * * *"` in `vercel.json`)
*   **Functionality:** Lists all files in the `uploads` bucket and deletes those older than 24 hours
*   **Output:** `{ deleted: number, attempted: number }` - Cleanup statistics
*   **Configuration:** Add to `vercel.json` crons array for automated execution

*   `lib/supabaseClient.ts`: Initializes the Supabase browser client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Also exports the `MindmapRecord` type used for dashboard history.

### Dashboard (`app/dashboard/page.tsx`)
*   Requires authentication. If no session is found, it redirects to `/`.
*   Displays a unified sidebar history list (mind maps + flashcards) with icons:
    - Mind maps use lucide `Map` icon; clicking loads saved `markdown` into the viewer (`MindMapModal`).
    - Flashcards use lucide `CreditCard` icon; clicking opens `FlashcardsModal` with the saved cards.
    - Sidebar history is now paginated for performance: it initially loads 10 items and then fetches 10 more as you scroll (infinite scroll). A skeleton loader shows during the initial load and a spinner appears while loading more.
    - Data source: a paginated `combinedHistory` built by interleaving `mindmaps` and `flashcards` ordered by `created_at` descending. Fetching uses per‑table pagination and merges the results client‑side.
*   **Real-time Credit Updates:** Credit balance updates instantly after generation without requiring page refresh. Uses custom events (`cogniguide:credits-updated`) to synchronize credit display across components.
*   Provides the same generator UI (dropzone + prompt) as the landing page with a selector to switch between Mind Map and Flashcards generation.
    - Mind maps are saved automatically with extracted title.
    - Flashcards generated directly from files/prompts are saved with an empty `markdown` string and a derived title, then the sidebar refreshes immediately.
*   Includes a "Sign out" action that clears the session and redirects home.
*   **Performance Optimizations:**
    - **Instant Credit Loading:** Credits load immediately using localStorage cache with background refresh, eliminating the brief "0.0" flash
    - **Real-time Updates:** Credit balance updates instantly after generation via custom events, no page refresh needed
    - **Fast Auth Redirects:** Lightweight first-party cookies (`cg_authed`) eliminate 2-3 second delays for authenticated users visiting the landing page
*   Spaced repetition prefetch & caching:
    - On dashboard load (after history fetch), all schedules are loaded in a single bulk request from `flashcards_schedule`, normalized to deck card counts, and cached (in‑memory + `localStorage`).
    - The due‑now queue and a `window.__cogniguide_due_map` are computed up‑front so opening the modal is instant, including cards due within 24 hours after exam completion.
    - If the network is unavailable, due lists are recomputed from the cache to maintain responsiveness.
    - When new flashcards are created, history reloads and the prefetch runs again to refresh dues.

#### Performance Best Practices (Critical for Future Development)
*   **Avoid Auth Delays:** Always implement server-side cookie checks before expensive auth operations. Use lightweight first-party cookies synced with auth providers to enable instant redirects.
*   **Cookie Strategy:** Store auth indicators locally (cookies/localStorage) to avoid network roundtrips. Sync cookies immediately when auth state changes.
*   **Progressive Enhancement:** Server-side auth checks should work independently of client-side JavaScript. Always check lightweight indicators first.
*   **Cache Auth State:** For frequently accessed auth state, use simple, secure cookies with appropriate expiry (30 days max for auth indicators).
*   **Security First:** Use secure, same-site, short-expiry cookies. Never store sensitive data in client-side cookies.
*   **Maintenance:** Keep cookie sync logic consistent across all auth state change handlers. Update cookies immediately after session changes, not just on page load.

#### Pagination Implementation Notes (Critical for Future Development)
The sidebar history uses a sophisticated pagination system with infinite scroll. Key technical details and pitfalls to avoid:

*   **Architecture Overview:**
    - Fetches 10 items per page from both `mindmaps` and `flashcards` tables simultaneously
    - Merges results client-side by `created_at` descending order
    - Uses a buffer system: pre-fetches chunks into a buffer, then moves items to display list
    - Infinite scroll triggered via `IntersectionObserver` on a sentinel element
    - Loading states: skeleton cards for initial load, spinner for incremental loads

*   **Critical Race Condition Fixes (Essential):**
    - **Concurrency Guard:** `isFetchingRef` prevents overlapping fetches that could reuse stale offsets
    - **Stable Offset Refs:** `mmOffsetRef`/`fcOffsetRef` ensure each fetch uses correct range even as state updates
    - **Global Deduplication:** `seenKeysRef` tracks all rendered/buffered items to prevent duplicates across loads
    - **Key Generation:** Uses `${type}:${id}` format for React keys to ensure uniqueness across item types

*   **Common Pitfalls to Avoid:**
    - ❌ **Don't rely on state variables directly in async fetches** - they can become stale during rapid scrolling
    - ❌ **Don't assume React keys will be unique by default** - explicitly track and filter duplicates
    - ❌ **Don't trigger fetches without proper loading guards** - can cause overlapping requests and inconsistent state
    - ❌ **Don't mix rendered items with buffer items for deduplication** - maintain separate tracking
    - ❌ **Don't forget to reset pagination state on history refresh** - clears refs and seen-keys set

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

## Troubleshooting Guide

### Common Issues & Solutions

#### Authentication Redirect Delays
**Symptoms**: Signed-in users experience 2-3 second delays when visiting the landing page before being redirected to dashboard. Additionally, users may get stuck in the dashboard after signing out, with the credit balance showing 0.00, history not loading, and inability to sign out, requiring manual deletion of site data.

**Root Cause**: Relying solely on client-side Supabase auth verification without server-side cookie checks, and the `cg_authed` cookie not being cleared during sign out.

**Solution**: Use lightweight first-party cookies (`cg_authed`) synced with auth state for instant server-side detection. The `cg_authed` cookie is now also explicitly cleared in `handleSignOut` and `supabase.auth.onAuthStateChange` to prevent redirect loops and ensure proper sign-out behavior.

**Prevention**:
- Always check `cg_authed` cookie first in middleware and server components
- Sync cookie immediately when auth state changes in `HomeLanding.tsx`
- Keep cookie logic consistent across all auth handlers
- Use secure, same-site cookies with 30-day expiry

#### 413 "Request Entity Too Large" Errors
**Symptoms**: Users see "Failed to generate flashcards. Server returned 413" or "Upload failed and storage pre-parse is not available right now."

**Root Causes & Fixes**:
1. **Pipe Characters in File Keys**: File keys containing "|" (pipe) characters break Supabase signed uploads
   - **Fix**: Keys are sanitized to `[A-Za-z0-9._-]` in `app/api/storage/get-signed-uploads/route.ts`
2. **File Set Key Separator**: Using "||" (double pipe) as separator caused conflicts with backend validation regex
   - **Fix**: Changed to "__" (double underscore) in `components/Generator.tsx` to avoid regex conflicts
   - **Before**: `file1||file2||file3` → **After**: `file1__file2__file3`

2. **Missing/Invalid Supabase Environment Variables**:
   - **Required**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - **Test**: Check browser Network tab for failed `/api/storage/get-signed-uploads` or `/api/preparse` requests
   - **Fix**: Ensure all three variables are set correctly in Vercel environment

3. **Large Files Falling Back to Legacy Multipart**:
   - **Issue**: When storage pre-parse fails, client attempts direct file upload to serverless function
   - **Vercel Limit**: 4.5MB per request → 413 error
   - **Fix**: Guards prevent fallback for files >4MB, showing clear error messages instead

**Debug Steps**:
1. Open browser DevTools → Network tab
2. Select a large file and watch these requests:
   - `POST /api/storage/get-signed-uploads` (should return 200)
   - `POST /api/preparse` (should return 200)
3. If either fails, check server logs and environment variables
4. Test with smaller files first to isolate storage vs size issues

#### Storage Cleanup Failures
**Symptoms**: Files remain in Supabase Storage after successful generation, potentially hitting the 500MB limit.

**Root Causes & Fixes**:
1. **Cleanup API Errors**: The `/api/storage/cleanup` endpoint fails silently
   - **Check**: Vercel function logs for "Cleanup failed" messages
   - **Fix**: Verify `SUPABASE_SERVICE_ROLE_KEY` has storage permissions
   - **Test**: Call cleanup endpoint directly with file paths

2. **Scheduled Cleanup Not Running**: Daily cleanup job doesn't execute
   - **Check**: Vercel dashboard for cron job execution logs
   - **Fix**: Ensure `vercel.json` has correct cron configuration
   - **Manual Trigger**: Call `/api/storage/scheduled-cleanup` directly

3. **File Path Extraction Issues**: URLs not properly parsed for cleanup
   - **Check**: Server logs for "Cleanup failed" with URL parsing errors
   - **Fix**: Verify Supabase URLs contain `/storage/v1/object/public/uploads/` pattern
    - **Debug**: Check that image processing is working and base64 data URLs are being generated correctly

**Prevention**:
- Monitor Supabase Storage usage in dashboard
- Set up alerts for storage usage > 400MB
- Keep cleanup logic in sync with upload path generation

#### Storage Pre-parse Failures
**Symptoms**: "Storage pre-parse failed: [error]. Large files cannot be sent directly"

**Common Causes**:
- Invalid Supabase configuration
- Missing `uploads` bucket in Supabase Storage
- Bucket permissions not allowing service role access
- Network connectivity issues

**Verification**:
- Ensure private `uploads` bucket exists in Supabase Storage
- Verify service role has read/write access to the bucket
- Check that image processing is working and base64 data URLs are being generated correctly

#### Image Processing Issues (Base64 Data URLs)
**Symptoms**: Users see 400 Bad Request errors when trying to generate mind maps or flashcards from images.

**Root Cause**: The Gemini AI API (via OpenAI interface) cannot access signed URLs from Supabase Storage, causing 400 Bad Request errors when trying to process images.

**Solution Applied**:
1. **Changed Image Processing Approach**: Modified `app/api/preparse/route.ts` to download images from Supabase Storage and convert them to base64 data URLs instead of using signed URLs
2. **Updated Validation Logic**: Added URL validation in generation APIs to handle both signed URLs and base64 data URLs
3. **Updated Cleanup Logic**: Modified cleanup to only process signed URLs (base64 data URLs don't need cleanup as they're embedded in requests)
4. **Enhanced Error Handling**: Added better error messages for image processing failures

**Files Modified**:
- `app/api/preparse/route.ts` - Changed to base64 data URLs for images
- `app/api/generate-mindmap/route.ts` - Updated validation and cleanup
- `app/api/generate-flashcards/route.ts` - Updated validation and cleanup
- `components/Generator.tsx` - Updated debug logging

**Result**: Images are now downloaded and converted to base64 data URLs during preprocessing, which the Gemini API can directly access without needing external URL permissions.

#### Mind Map Node Blurriness Issue
**Symptoms**: Mind map nodes appear blurry until hovered over or parent collapsed/expanded.

**Root Cause**: Over-aggressive CSS `will-change` property forced long-lived raster layers, preventing crisp initial rendering.

**Solution**: Limited `will-change` to `opacity, top, left` and added font-smoothing properties in `app/globals.css`.

**Prevention**: Use minimal `will-change` properties and avoid forcing transform compositing on text elements.

#### PNG Export Frame Issue
**Symptoms**: Downloaded PNG images of mind maps have an unwanted colored frame (light blue or dark blue) that varies with the theme.

**Root Cause**: The frame was caused by:
1. A margin (`12px`) applied during the export process, which captured the theme's background color.
2. The cloned container not enforcing a transparent background during rendering.

**Solution**:
1. The export logic now measures the bounds of the mind map content and crops the PNG to these bounds, with a small margin to avoid cutting off nodes.
2. It explicitly clears any background on the mind map container during rendering to ensure a transparent background.
3. It removes any residual borders, shadows, or outlines that could be captured in the export.

**Files Affected**:
- `components/MindMapModal.tsx`
- `lib/markmap-renderer.ts`

**Prevention**:
- Always ensure the export container has a transparent background (`background: 'transparent'`).
- Avoid applying margins or padding during export unless absolutely necessary.
- Test exports in both light and dark themes to catch any visual artifacts.

**Verification**:
- After changes, verify that exported PNGs have no visible frame and match the mind map's content exactly.

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

### Favicon
To ensure Google reliably picks up your favicon, include explicit links in the document head and store the assets in `public/`:

```html
<link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon" />
<link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
```

These are already added in `app/layout.tsx`. You can optionally add platform-specific icons as needed (e.g., `apple-touch-icon`, `favicon.svg`).

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

#### Real-time Credit Updates

The application implements real-time credit balance synchronization across components using custom DOM events:

*   **Event System:** Uses `cogniguide:credits-updated` custom event to notify components of credit changes
*   **Automatic Synchronization:** Credit balance updates instantly after generation without page refresh
*   **Cache Management:** Updates localStorage cache when credits change to maintain consistency
*   **Memory Management:** Proper event listener cleanup prevents memory leaks

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
  schedules jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  exam_date timestamp with time zone null,
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
