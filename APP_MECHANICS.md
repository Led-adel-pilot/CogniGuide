# Application Mechanics & User Flow

This document details the specific behavior, inputs, and state transitions of the CogniGuide web application components.

## 1. Onboarding (`components/OnboardingWizardModal.tsx`)

*   **Trigger:** Controlled by `DashboardClient.tsx`. Appears on the first visit if `combinedHistory` is empty and `localStorage` key `cogniguide_onboarding_seen_[uid]` is not set.
*   **Stage 1 (Mode Selection):**
    *   **UI:** Two large cards: "Create a Mind Map" vs "Create Flashcards".
    *   **Action:** Clicking a card sets the local `selectedMode` and advances to Stage 2.
*   **Stage 2 (Input):**
    *   **Dropzone:** A compact version of the file uploader.
        *   *Behavior:* Uploading a file immediately dispatches `cogniguide:onboarding-files` event to the main `DashboardClient` and closes the modal.
    *   **Text Input:** "Don't have a file? Just type what you want".
        *   *Behavior:* Typing and hitting Enter prefills the main `PromptForm`.
    *   **Suggested Topics:** Horizontal scrollable list of pills (e.g., "Neural Networks", "Photosynthesis").
        *   *Action:* Clicking a pill auto-populates the prompt and simulates a submission.

## 2. Generator Interface (`components/Generator.tsx`)

*   **Mode Toggle:** A pill-shaped switch toggles `mode` state between `'mindmap'` and `'flashcards'`.
*   **File Upload (`Dropzone`):**
    *   **Constraint:** Client-side limit of ~50MB per file.
    *   **Pre-parsing:** Files are uploaded to Supabase Storage. A background process (`/api/preparse`) extracts text.
    *   **OCR Warning:** If extracted text length is `< 40` characters for a PDF, a warning appears: *"We couldn't detect much selectable text..."*
*   **Text Input (`components/PromptForm.tsx`):**
    *   **UI:** Textarea that auto-expands up to 200px height.
    *   **Placeholder:** Dynamic based on mode (e.g., "Generate flashcards on The Cold War").
    *   **Submission:** Enter key (without Shift) or clicking the "Send" (Paper Plane) icon triggers generation.
*   **Model Selection:**
    *   **Options:** "Fast" (default) vs "Smart" (GPT-4 class).
    *   **Gating:** "Smart" mode is locked for Free users (unless in Reverse Trial). Clicking it triggers `PricingModal`.

## 3. Generation & Study Flow

### Mind Maps (`components/MindMapModal.tsx`)
*   **Trigger:** Opens automatically upon successful stream start from `/api/generate-mindmap`.
*   **Rendering:** Uses `markmap` library to render Markdown as an interactive tree.
*   **Toolbar (Top-Right):**
    *   **Download Button:** A dropdown button allowing export as **PNG**, **PDF**, or **SVG**.
    *   **Share Button:** Opens `ShareLinkDialog` for generating a public URL.
    *   **Close Button:** An 'X' icon that closes the modal. If the user is unauthenticated, this triggers the **Loss Aversion Popup**.
    *   **Sign Up Button:** (Unauthenticated only) A direct "Sign up" CTA button.
*   **Loss Aversion Popup:**
    *   **Trigger:** Unauthenticated user attempts to close the modal after generation.
    *   **Content:** "Don't Lose Your Mind Map! Sign up to save..."
    *   **Actions:** "Save & Continue" (opens Auth) or "Continue without saving" (closes modal).

### Flashcards (`components/FlashcardsModal.tsx`)
*   **Trigger:** Opens automatically upon successful stream start from `/api/generate-flashcards`.
*   **Navigation:**
    *   **Keyboard:** `ArrowRight` (Next), `ArrowLeft` (Previous), `Enter` (Show Answer).
    *   **UI:** Chevron buttons for previous/next navigation.
*   **Review Interaction:**
    *   **State 1 (Question):** Shows question text.
    *   **Action:** User clicks "Show Answer" (or presses Enter).
    *   **State 2 (Answer):** Reveals answer text.
    *   **Grading Buttons:** Four buttons appear representing FSRS grades:
        *   **Again:** Immediate review.
        *   **Hard:** Short interval.
        *   **Good:** Standard interval.
        *   **Easy:** Long interval.
        *   *Visuals:* Each button displays the estimated time until the next review (e.g., "10m", "4d").
*   **Tools:**
    *   **Explain Button:** Calls `/api/explain-flashcard`. Streams a detailed explanation below the answer. Locked for Free users.
    *   **Edit Button (Pencil):** Turns the question/answer cards into textareas for inline editing.
    *   **Mind Map Link:** If the deck was generated from a Mind Map, a button links back to that specific map.

## 4. Dashboard Mechanics (`app/dashboard/DashboardClient.tsx`)

### Sidebar & History
*   **Structure:** Fixed left sidebar (collapsible on mobile via hamburger menu).
*   **History List:**
    *   Displays a combined list of `mindmaps` and `flashcards` fetched from Supabase.
    *   **Infinite Scroll:** Loads items in chunks of 10 as the user scrolls down.
    *   **Sorting:** Strictly chronological (newest first).
    *   **Context Menu:** A "More" (...) button on each item reveals a dropdown:
        *   *Share:* Opens `ShareLinkDialog`.
        *   *Rename:* Triggers inline text input editing.
        *   *Delete:* Prompts for confirmation before removing from DB.
*   **Spaced Repetition Trigger:**
    *   A dedicated button at the top of the sidebar list.
    *   **Badge:** Shows the total count of cards currently "Due" across all decks.
    *   **Action:** Clicking it opens the **Spaced Repetition Panel**.

### Spaced Repetition Panel (`spacedOpen`)
*   **Overlay:** A modal-like overlay displaying a list of all decks with due cards.
*   **Interleaved Mode:**
    *   **Condition:** Appears if `dueQueue.length > 0`.
    *   **"Study All" Button:** Aggregates *all* due cards from *all* decks into a single session.
    *   **Logic:** Randomly shuffles cards to prevent consecutive cards from the same deck (Interleaving).
*   **Deck List:**
    *   Lists individual decks with their specific "Due Now" count.
    *   **Actions:**
        *   *Study:* Launches `FlashcardsModal` for that specific deck.
        *   *Skip:* Removes the deck from the current due queue (locally) without grading.

### Settings Panel (`isSettingsOpen`)
*   **Trigger:** Clicking the user profile area at the bottom of the sidebar.
*   **Content:**
    *   **Credits Card:** Shows exact credit balance with a visual progress indicator.
    *   **Theme Toggle:** Switches between Light/Dark mode.
    *   **Referral:** "Refer friends" button opens the `ReferralModal`.
    *   **Upgrade:** "Upgrade Plan" button triggers `PricingModal`.
    *   **Support:** "Contact Support" mailto link.
    *   **Legal:** Collapsible accordion containing links to Refund Policy, Terms, etc.
    *   **Sign Out:** Clears Supabase session and auth cookies.

## 5. Trial Mechanics

*   **Reverse Trial Activation (`components/ReverseTrialModal.tsx`):**
    *   **Trigger:** ~30 seconds after the *first* study modal (Mind Map or Flashcard) is opened in a session.
    *   **Condition:** User is new/eligible and has not seen it.
    *   **UI:** Modal announcing "You've unlocked 7 days of full access".
*   **Trial Status Indicator:**
    *   If `userTier === 'trial'`, a pill button in the main dashboard area displays "Trial ends in [X] days".
    *   Clicking it opens `PricingModal`.
*   **Expiration (`components/ReverseTrialEndModal.tsx`):**
    *   **Trigger:** On dashboard load if `trialEndsAt` is <= 1 day from now.
    *   **Content:** Displays usage stats (Mind maps created, Cards studied).
    *   **Actions:** "Switch to limited free plan" (downgrade) or "Upgrade & Keep everything" (opens Pricing).

## 6. Pricing (`components/PricingClient.tsx`)

*   **Toggle:** Switches prices between "Monthly" and "Yearly".
*   **Plans:**
    *   **Student:** Primary CTA.
    *   **Pro:** Higher credit limit.
*   **Buttons:**
    *   **Unauthenticated:** "Sign up" (triggers `AuthModal`).
    *   **Authenticated:** "Choose [Plan]" or "Upgrade to [Plan]".
    *   **Paddle:** Clicking a paid plan button initializes Paddle Checkout overlay.

## 7. Dashboard Layout & UI Structure

### Root Container
*   **Properties:** Full viewport height (`h-screen`), hidden overflow (`overflow-hidden`), flex container (`flex`).
*   **Purpose:** Ensures independent scrolling for the sidebar and main content area without scrolling the entire page body.

### Left Sidebar (`<aside>`)
*   **Dimensions:** Fixed width of `w-72` (approx 288px) on desktop.
*   **Mobile Behavior:** Off-canvas by default (`-translate-x-full`), slides in (`translate-x-0`) when toggled via the hamburger menu.
*   **Top Section:**
    *   Contains the Logo/Refresh button.
    *   Contains the "Spaced Repetition" queue button with the dynamic "Due" count badge.
    *   Header "Your History" label.
*   **Middle Section (Scrollable):**
    *   Contains the list of history items (`mindmaps` & `flashcards`).
    *   Has its own scrollbar (`overflow-y-auto`) so it scrolls independently of the user profile.
*   **Bottom Section (Fixed):**
    *   Anchored to the bottom via flex layout (`flex-col`).
    *   Contains the **User Profile Button** (Avatar + Name + Credits) which acts as the trigger for the Settings Panel.

### Main Content Area (`<main>`)
*   **Dimensions:** Flex-grow (`flex-1`) to fill the remaining width.
*   **Scrolling:** Independent vertical scroll (`overflow-y-auto`).
*   **Top Left Corner:**
    *   **Model Selector:** A floating pill button to toggle "Fast" vs. "Smart" models. Positioned absolutely (`absolute top-20 left-2` or `md:left-4 md:top-4`) to stay accessible.
*   **Header (Mobile Only):**
    *   Sticky top bar (`sticky top-0`) containing the Hamburger Menu trigger and Logo.
*   **Central Stage (`#generator-panel`):**
    *   **Positioning:** Centered horizontally (`mx-auto`) with a max-width (`max-w-3xl`).
    *   **Components:**
        1.  **Trial/Upgrade Pill:** A centered status button appearing above the generator (e.g., "Trial ends in 5 days").
        2.  **Generator Card:** The main interaction area containing the Mode Toggle, Dropzone, and Prompt Form.

## 8. Tooltip System (`components/TooltipLayer.tsx`)

*   **Architecture:**
    *   A global React portal (`createPortal`) renders tooltips directly into `document.body` to avoid z-index or overflow issues.
    *   It acts as a singleton listener attached to the `document`.
*   **Activation Triggers:**
    *   **Mouse:** `pointerenter` (hover) shows the tooltip after a delay (`DEFAULT_SHOW_DELAY = 300ms`). `pointerleave` hides it.
    *   **Keyboard:** `focusin` (tab navigation) shows the tooltip immediately if the focus is keyboard-initiated (`:focus-visible`). `focusout` hides it.
*   **Attributes:**
    *   `data-tooltip`: The primary attribute used to define the tooltip text.
    *   `data-tooltip-delay`: Optional attribute to override the default delay.
    *   `title`: If an element has a native `title` attribute, the system automatically converts it to a `data-tooltip` to prevent double tooltips.
*   **Positioning Logic:**
    *   Calculates position dynamically based on `getBoundingClientRect()`.
    *   **Priority:** Centers horizontally over the anchor.
    *   **Vertical:** Prefers placing the tooltip **below** the element (`bottom + GAP`). If space is insufficient, it flips to **above** (`top - height - GAP`).
    *   **Clamping:** Ensures the tooltip never overflows the viewport edges (`EDGE_MARGIN`).
*   **Global Controls:**
    *   **Esc Key:** Closes any active tooltip.
    *   **Interaction:** Any `click` or `pointerdown` event instantly hides the active tooltip to prevent obstruction.
    *   **Event:** Listens for `cogniguide:hide-tooltips` to allow other components (like menus) to forcibly clear tooltips.

## 9. End-to-End Generation Flow

### Step 1: Onboarding to Generator
1.  User selects a goal in `OnboardingWizardModal` (e.g., "Create Flashcards").
2.  User inputs a file or topic (e.g., "Biology 101").
3.  The wizard dispatches a `cogniguide:onboarding-auto-submit` event.
4.  `Generator.tsx` detects this event, populates the `PromptForm` or file input, and immediately triggers the `handleSubmit` function.

### Step 2: API Streaming & Immediate Modal Activation
*   **Mind Maps:**
    *   `Generator.tsx` calls `fetch('/api/generate-mindmap')`.
    *   **Immediate Trigger:** As soon as the first text chunk (token) is received from the stream, `setMarkdown(accumulated)` is called with partial data.
    *   **Modal Open:** The `MindMapModal` opens instantly because its `markdown` prop is no longer null. The user sees the mind map growing in real-time.
*   **Flashcards:**
    *   `Generator.tsx` calls `fetch('/api/generate-flashcards?stream=1')`.
    *   **Immediate Trigger:** Once the connection is established and headers are OK (`res.ok`), `setFlashcardsOpen(true)` is called *before* reading the stream body.
    *   **Modal Open:** `FlashcardsModal` opens instantly.
    *   **Population:** As the stream yields line-delimited JSON objects, cards are appended to the modal's state one by one.

### Step 3: The Study Modal Experience
*   **FlashcardsModal:**
    *   **Default View:** The user sees the "Question" face of the card.
    *   **Review:** The user can navigate through *all* generated cards using `Next`/`Prev` buttons or arrow keys.
    *   **Interaction:** Clicking "Show Answer" (or pressing Enter) flips the card to reveal the answer and the FSRS grading buttons.
    *   **Close:** A "Close" button (X) is located at the top right.
*   **MindMapModal:**
    *   **View:** Renders the SVG tree structure.
    *   **Interaction:** Nodes are clickable.
    *   **Close:** A "Close" button (X) is located at the top right.

### Step 4: Return to Dashboard
1.  User clicks the "Close" button in the modal.
2.  The modal component calls its `onClose` prop (managed by `Generator.tsx` or `DashboardClient.tsx`).
3.  **State Reset:** `markdown` is set to `null` or `flashcardsOpen` is set to `false`.
4.  **History Update:** `Generator.tsx` dispatches a `cogniguide:generation-complete` event.
5.  **Sidebar Sync:** `DashboardClient.tsx` listens for this event and calls `initPaginatedHistory` to fetch the newly created item from Supabase and insert it at the top of the sidebar list.