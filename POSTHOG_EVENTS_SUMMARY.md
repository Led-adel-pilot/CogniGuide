# PostHog Event Definitions

This document summarizes the event tracking instrumentation currently implemented in the CogniGuide application.

## Core Workflows & Generation

### Generator (`components/Generator.tsx`)
- **`generation_submitted`**: Fired when the user clicks the button to generate a mind map or flashcards.
- **`generation_mode_changed`**: Fired when switching between 'Mind Map' and 'Flashcards' modes.
- **`upgrade_clicked`**: Fired when the user clicks 'Upload your Plan' after hitting a credit limit.
- **`non_auth_generation_blocked`**: Fired when an unauthenticated user attempts an action requiring login (e.g., specific generation limits).

### File Management (`components/Dropzone.tsx`)
- **`files_added`**: Fired when files are added via drag-and-drop or selection.
- **`file_removed`**: Fired when a user removes a file from the upload list.

### Inputs (`components/PromptForm.tsx`)
- **`prompt-submitted`**: Tracks prompt submission, including prompt length and method (click vs. enter key).

## Learning & Study Experience

### Dashboard (`app/dashboard/DashboardClient.tsx`)
- **`history_item_opened`**: User opens a previously generated item from the sidebar history.
- **`history_item_deleted`**: User deletes an item from history.
- **`history_item_renamed`**: User renames an item in history.
- **`spaced_repetition_deck_studied`**: User starts a study session for a deck.
- **`spaced_repetition_interleaved_started`**: User starts an interleaved study session (multiple decks).
- **`spaced_repetition_deck_cancelled`**: User cancels a study session or schedule.
- **`generation_model_option_clicked`**: User attempts to change the AI model (tracks Free vs Pro intent).
- **`user_signed_out`**: User clicks the sign-out button.

### Flashcards (`components/FlashcardsModal.tsx`)
- **`flashcard_graded`**: User grades their recall (Again, Hard, Good, Easy).
- **`flashcard_answer_shown`**: User reveals the answer side of a card.
- **`exam_date_set`**: User configures an exam date for spaced repetition.
- **`exam_date_skipped`**: User declines to set an exam date.
- **`mindmap_generation_from_flashcards_started`**: User starts generating a mind map from an existing flashcard deck.
- **`mindmap_generation_from_flashcards_completed`**: Completion of the mind map generation from flashcards.

### Mind Maps (`components/MindMapModal.tsx`)
- **`mindmap_exported`**: User downloads the mind map (tracks format: `png` or `pdf`).

## Commercial & Growth

### Pricing & Checkout (`components/PricingClient.tsx` & `app/pricing`)
- **`pricing_viewed`**: Pricing grid is rendered (public page or modal).
- **`pricing_billing_cycle_changed`**: User toggles between Monthly and Yearly billing.
- **`pricing_plan_cta_clicked`**: User clicks a specific plan's selection button.
- **`pricing_auth_prompt_shown`**: Unauthenticated user prompted to sign in during upgrade flow.
- **`pricing_checkout_initiated`**: Paddle checkout overlay opened.
- **`pricing_checkout_completed`**: Successful payment confirmed by Paddle.
- **`pricing_checkout_closed`**: Checkout overlay closed without purchase.
- **`pricing_checkout_error`**: Error occurred initializing checkout.
- **`pricing_cancel_link_clicked`**: User clicked the link to the billing portal to cancel/manage subscription.
- **`pricing_modal_opened`**: Dashboard upgrade modal opened (tracks trigger source).
- **`pricing_modal_closed`**: Upgrade modal dismissed.
- **`pricing_header_logo_clicked`**: Click on the logo in the pricing page header.

### Referrals (`app/dashboard/DashboardClient.tsx`)
- **`referral_link_loaded`**: Referral link successfully fetched for the user.
- **`referral_modal_opened`**: User opened the referral UI.
- **`referral_link_copied`**: User copied their unique referral link.
- **`referral_code_redeemed`**: A referral code was successfully applied/redeemed.

### Authentication (`components/AuthModal.tsx`)
- **`user_signed_up`**: User successfully created an account (tracks method: email/google).

## Contact
- **`contact_form_submitted`**: Contact form successfully sent (`app/contact/ContactForm.tsx`).
