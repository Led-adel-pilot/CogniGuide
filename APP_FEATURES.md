# CogniGuide Experience Overview

This document captures every user-facing capability of CogniGuide without diving into implementation details. It follows the user’s journey from arrival through creation, sharing, study, and support so nothing about the product’s behavior and flow is left out.

## 1. Purpose & Audience
- CogniGuide is positioned as an AI-powered study companion for students, educators, working professionals, and lifelong learners who need to convert dense content into memorable structures.
- The product promise is clear: “Learn Faster. Remember More. Ace Your Exams.” Everything—from the landing page messaging to the dashboard controls—reinforces that goal.
- Marketing and SEO copy focus on exam prep, professional certifications, lesson planning, research distillation, and knowledge management, making it easy for each persona to see how CogniGuide fits their workflow.

## 2. First Touch & Getting Started
- Visitors land on an interactive home page with a hero section, “Why Mind Maps” storytelling, and live generator previews that tease how documents become visuals.
- The public site includes dedicated entry points for mind map generation, flashcard generation, pricing, contact, blog posts, and legal pages—each sharing consistent branding, rounded cards, and clear calls-to-action.
- Links to pricing, contact, refund/cancellation/terms documents, and the sitemap live in the footer so every page feels compliant and trustworthy.

## 3. Document Intake & Generation Flow
- Users can drop or select files covering PDFs, DOCX/PPTX decks, plain text, Markdown, and image files (JPEG/PNG/WebP/GIF) to capture structured study material.
- As files upload, the interface shows live progress (e.g., “Uploading (57%)”), outlines file names/sizes, and signals when the system shifts from uploading to “Processing.”
- Once uploads finish, CogniGuide “prepares” the content by extracting text and processing images behind the scenes so the AI can create something meaningful without manual intervention.
- A prompt box accompanies uploads so learners can guide the AI (“focus on causes, highlight formulas, prioritize timelines,” etc.), and the UI keeps the text area adaptive to the prompt length.
- The app remembers each unique file combination so repeat generations happen instantly—no need to re-process unchanged files—and background cleanup removes intermediate files so the workspace never bloats.
- After preparation, the generation button streams AI output token-by-token, letting learners watch their mind map build in real time rather than waiting for a final result.
- A mode switch lets users toggle between mind map and flashcard generation from the same workspace, supporting both visual and textual learning from the same material.

## 4. Mind Map Experience
- The generated mind maps are interactive, centered, and zoomed to fit the screen on first view, giving learners a big-picture overview before zooming into nodes.
- Standard interactions—zoom, pan, node collapsing/expanding—feel smooth, and math notation renders clearly inside nodes so formulas and derivations stay readable.
- Visual polish includes rounded nodes, softer shadows, and clean typography that match the broader design system.
- The mind map modal provides export buttons for SVG, PNG, or printable PDF so users can save a snapshot, share it with classmates, or annotate it offline.
- After a mind map exists, a “Generate Flashcards” action extracts study cards without leaving the modal, instantly switching to the flashcard environment while hiding the map until the user returns.

## 5. Flashcard Experience & Spaced Repetition
- Flashcards can be generated two ways: directly from uploaded files or from the markdown of an existing mind map, giving users flexibility depending on whether they prefer visuals first or text-first workflows.
- The study modal presents cards with a color-coded grading row (Again, Hard, Good, Easy). Learners grade their recall, and the interface uses friendly labels/pills to show due dates (e.g., “Due Today,” “Due in 3 days”).
- Flashcards display answers on demand, and each deck maintains stats like difficulty, stability, lapses, repetitions, and next review dates without exposing raw algorithmic details.
- Every review is tracked per deck so the user can close and reopen a deck without losing their place.
- Exam dates are optional but powerful: when set, the app forces reviews to land before the exam, keeps cards due during the exam, provides an intensive 24-hour grace period afterward, and automatically lifts the exam constraint once 24 hours pass so normal scheduling resumes.
- Cross-device syncing keeps the scheduling state consistent whether the user studies on desktop or mobile, and cached scheduling data makes the modal appear instantly.
- Users can also edit the contents of individual flashcards right from the study modal; tapping “Edit Card” opens inline fields for both prompt and answer, saving changes without leaving the session so learners can tweak phrasing or clarify details as they study.
- Spaced repetition relies on selectable grading, exam-aware scheduling, and adaptive intervals so each review feels personalized without manual calculation.

## 6. Interleaved Study Mode
- When multiple decks have due flashcards, “Study All Due Cards (Interleaved)” gathers them into one session to encourage beneficial topic switching.
- Cards shuffle intelligently so no two consecutive cards come from the same deck, and the modal headline updates to show the deck name of the current card for context.
- Progress on every card updates back to its original deck so the consolidated session still respects each deck’s exam date and scheduling rules.

## 7. Dashboard, History & Onboarding
- **New User Onboarding:** Upon entering the dashboard, eligible users are first presented with the **Reverse Trial** unlock (if on a trial plan). Once cleared, a **3-step Onboarding Wizard** activates, employing a **Zeigarnik-style progress tracker** (starting at "Step 1 of 3") to drive completion:
    - **Step 1:** Users choose their primary goal: "Create a Mind Map" or "Create Flashcards."
    - **Step 2:** Users select an input method via a **Dropzone-styled upload card** or by clicking a **pill-shaped sample topic** (e.g., "Neural networks") which autofills the prompt.
    - **Step 3 (The Goal):** The wizard closes and pre-configures the main generator, leaving the user at the final conceptual step: clicking "Generate" to create their first study asset.
- The dashboard unifies mind map and flashcard history in a sidebar with a “Share” option per item, a button to toggle between generation modes, and a live credit display (kept accurate even when opening dashboard pages quickly thanks to smart caching).
- History entries drilling down open either the mind map viewer or the flashcard study modal; analytics track which items are opened so user behavior can be understood later.
- The share workflow begins with a “Share” option from a history entry, pops open a modal, and provides a copy button plus instant feedback. Sharing generates a secure link that any viewer can open immediately.
- Shared links don’t require sign-in—anyone opens them to view the mind map or flashcards in the same rich viewer experience as owners.
- Authenticated viewers get a one-click “Import” action to copy shared content into their own dashboard; the system warns if they already own identical content so duplicates are avoided.
- The dashboard also includes referral and upgrade controls, giving users immediate routes to grow their credits or invite friends.

## 8. Referrals, Credits & Pricing
- Credit usage is metered: 1 credit covers roughly 3,800 characters of processed content via the Fast Model. Image-only requests start at half a credit, and even prompt-only generations charge a minimum of 1 credit.
- **Anonymous vs. Authenticated Experience:**
    - **Anonymous Visitors:** Get 3 free generations to try the tool immediately without signing up.
    - **New Accounts (Reverse Trial):** Authenticated users enter a special trial lifecycle designed to maximize conversion (detailed in **Section 13. Paid Conversion & Trial Lifecycle**).
- Plans include a Free tier (5 monthly credits), Student tier (5,000 monthly credits), and Pro tier (7,500 monthly credits). Every plan unlocks the same core features; the paid plans simply lift content limits and refresh credits more generously.
- Payments and upgrades surface through an in-app pricing modal that lets authenticated users toggle billing cycles, open Paddle’s checkout, and see their real-time balance before purchasing.
- When a generation hits an insufficient-credit limit, the UI shows an inline upgrade prompt and opens the pricing modal so learners can stay focused on studying.
- Credits refresh automatically each month as long as a subscription stays active, and the system never lets balances dip below zero.
- The referral program grants 30 bonus credits to both the referrer and the new user when the invite link is redeemed. Referral activity is limited to three successful redemptions per month for each referrer, and the dashboard surfaces how many rewards remain.
- Landing page referral links carry a `ref` parameter until the visitor signs up, so the credit bonus applies immediately after sign-in and the new user sees a confirmation message on their first dashboard visit.
- Pricing copy highlights three options:
   1. **Free** – Designed for newcomers (after their 7-day trial ends), it awards 5 credits per month so users can continue light usage via the fast model and spaced repetition; AI flashcard explanations remain reserved for paid plans.
   2. **Student** – The most popular plan at **$9.99 per month** or **$99.90 per year** (10× monthly) delivers 5,000 credits every month, exam-aware scheduling, AI flashcard explanations, and access to Smart Model generations (at 5.2x credit cost) for richer output while keeping the interface focused on study prep.
   3. **Pro** – At **$14.99 per month** or **$149.90 per year** (10× monthly) it provides 7,500 credits per month for power users who process large book chapters, certifications, or professional content; it unlocks the same AI flashcard explanations and Smart Model support as Student but with maximum throughput, plus the dashboard shows a “current plan” state for easier upgrades.
- Each plan description includes highlight boxes for monthly vs annual savings, explains how credits accumulate, and points users to the “How credits work” section so they understand how long their balance will last.

## 9. Large File Handling & Reliability
- CogniGuide accepts large uploads (up to 50MB per file) without degrading the generator experience by uploading files directly through a secure channel and clearly showing each file’s progress.
- Users can add multiple files, see their cumulative status, remove files mid-flight, and get immediate feedback if a file is too large.
- The system preprocesses documents immediately upon upload so the “Generate” button never sits idle—instead, it flips to “Processing” while the AI reads the text and images, and cached results let repeated generations reuse previous work so waiting is minimal.
- Every upload is eventually cleaned up (immediately after successful generation and via a safety sweep later) to keep storage tidy without needing manual intervention.
- When large uploads fail or exceed service limits, the UI surfaces human-friendly error messages and prevents 413-type issues by stopping the attempt early.

## 10. Sharing, Import & Deduplication
- Sharing flows respect ownership: only the creator of a mind map or flashcard deck can generate a public link.
- Once a link is created, it can be copied, pasted, and opened instantly; the viewer looks identical to the regular dashboards, including the ability to play with mind maps or study flashcards.
- Authenticated visitors can import shared content with one click; the system automatically checks for identical content so the same deck isn’t imported twice and the user always receives clear messaging about whether the import succeeded or was skipped.
- Shared flashcards bring their spaced-repetition state with them, so recipients don’t start from scratch—they continue from due dates that match the owner’s progress.

## 11. Analytics, Tracking & Feedback
- PostHog tracks key interactions without being visible in the UI: contact form submissions, generation launches, share link creation, flashcard grading, history item opens, upgrades, and more.
- These events help the team understand how students behave (which share links are popular, whether flashcard grading sticks, if the upgrade flow is effective) so they can keep improving the study experience.

## 12. Support & Static Touchpoints
- The Contact page offers a responsive form where users can send their email, subject, and message directly from the site and receive replies at `cogniguide.dev@gmail.com` (to be updated before launch).
- Legal trust is reinforced via dedicated pages for refund policy, cancellation policy, and terms of service; every one follows the same polished layout with collapsible sections for readability.
- The sitemap and favicon are explicitly maintained so search engines and browsers understand CogniGuide’s structure.

## 13. Paid Conversion & Trial Lifecycle
- **Reverse Trial Concept:** Unlike traditional "freemium" models that start restricted, CogniGuide immediately unlocks the full Student tier (1,000 credits, Smart Model, AI Explanations) for 7 days upon sign-up. This "Reverse Trial" lets users experience maximum value before hitting limits.
- **Stage 1: The Welcome Modal:**
    - Trigger: Displayed once immediately after a new user signs in and their trial begins.
    - Purpose: Welcomes the user, explicitly lists the unlocked premium features, and states the trial end date.
    - Action: A simple "Continue" button dismisses the modal—no upsell is attempted here, focusing purely on activation.
- **Stage 2: The Conversion Modal (End of Trial):**
    - Trigger: Activates when the trial has **1 day or less remaining**.
    - **Personalized Stats:** The modal dynamically calculates and displays the user's actual usage during the trial (e.g., "In 7 days you've created 5 mind maps, 120 flashcards, and used 15 AI explanations").
    - **Value Comparison:** A side-by-side view contrasts the "Free" plan (downgrade) vs. the "Student" plan (keep everything), highlighting the loss of Smart Mode and credit limits.
    - **Conversion Path:** The primary "Upgrade & Keep everything" button launches the Pricing Modal directly, while a subtle secondary link allows users to accept the downgrade to the Free tier.
- **Lifecycle Management:** Both modals use `localStorage` flags to ensure they are shown exactly once per user, preventing annoyance while guaranteeing that every user sees the value proposition at the critical moment.

## 14. Pricing Interface & Purchase Flow
- **Visual Layout:** The pricing page uses a clean, responsive 3-column grid:
    - **Pro (Left):** Positioned for high-end users, listing maximum credit limits.
    - **Student (Center):** Visually emphasized with a "Most popular" badge, a distinct border/background style, and a calculated "Daily Cost" estimate (e.g., "≈ $0.33 per day - Less than one coffee per week!") to frame the value.
    - **Free (Right):** A baseline comparison showing the limitations (no AI explanations, no Smart Mode).
- **Interactive Controls:**
    - **Billing Toggle:** A central toggle lets users switch between "Monthly" and "Yearly" pricing, with the yearly option highlighting "Save 2 months."
    - **Dynamic Buttons:** Button states update in real-time based on the user's status:
        - *Unauthenticated:* "Sign up" (triggers the `AuthModal`).
        - *Free User:* "Upgrade to Student/Pro."
        - *Current Subscriber:* "Current plan" (disabled) or "Switch to Yearly" / "Upgrade to Pro."
- **Purchase Flow:**
    - Clicking a plan triggers a **PostHog event** (`pricing_plan_cta_clicked`).
    - If unauthenticated, the **AuthModal** opens; upon successful sign-in, the user is redirected back to complete the purchase.
    - If authenticated, the **Paddle Checkout Overlay** opens directly on top of the page, pre-filled with the user's ID to ensure immediate provisioning via webhook.
- **Transparency:** A "How credits work" section below the plans demystifies usage:
    - Explains the "1 credit ≈ 10 slides or 2 pages" rule.
    - Explicitly notes the higher cost multiplier (**5.2x**) for the Smart AI model.
    - Provides a concrete estimate of total output (e.g., "enough for ~1,600 monthly generations").

## 15. Future Readiness
- Plans exist for future enhancements like credit gifting, team credit pools, dynamic pricing, marketplaces for unused credits, usage analytics, budget controls, and integrations with analytics or CRM tools.
- Monitoring and logging currently cover webhook events, credit deductions, refunds, authentication flows, and purchases to keep the monetization plumbing reliable.
