# Event tracking report

This document lists all PostHog events that have been automatically added to your Next.js application.

## Events by File

### app\contact\ContactForm.tsx

- **contact_form_submitted**: Triggered when a user submits the contact form.

### app\dashboard\DashboardClient.tsx

- **history_item_opened**: Tracks when a user clicks on a mindmap or flashcard deck from their history list in the sidebar.
- **spaced_repetition_deck_studied**: Tracks when a user clicks the 'Study' button for a specific deck in the spaced repetition modal.
- **user_signed_out**: Tracks when a user clicks the 'Sign out' button.
- **pricing_modal_opened**: Fires whenever any dashboard surface opens the upgrade modal. Properties include the `trigger` (e.g., `dashboard_upgrade_cta`, `model_selector_locked`, `generator_require_upgrade`) plus the user's current tier and credit balance.
- **pricing_modal_closed**: Logged when the upgrade modal is dismissed. Includes the previously recorded trigger and the close `reason` (`close_button`, `overlay`, or `complete`) so you can measure completion vs. drop-off.
- **generation_model_option_clicked**: Captures attempts to switch models along with whether the option was allowed (`allowed: false` indicates a Smart-mode paywall impression).
- **referral_link_loaded**, **referral_modal_opened**, **referral_link_copied**, **referral_code_redeemed**: Power referral-funnel dashboards by telling you who viewed, copied, and successfully redeemed referral codes, including success/error states.

### app\pricing\page.tsx

- **pricing_header_logo_clicked**: Tracks when a user clicks the 'CogniGuide' logo in the header on the pricing page.
- **pricing_header_open_generator_clicked**: Tracks when a user clicks the 'Open Generator' button in the header on the pricing page.

### components\Dropzone.tsx

- **files_added**: Fired when a user adds one or more files, either by drag-and-drop or using the file selector.
- **file_removed**: Fired when a user clicks the 'X' button to remove a previously added file.

### components\FlashcardsModal.tsx

- **flashcard_graded**: Fired when a user grades their recall of a flashcard ('Again', 'Hard', 'Good', or 'Easy').
- **flashcard_answer_shown**: Fired when a user clicks the 'Show Answer' button to reveal the flashcard's answer.
- **mindmap_generation_from_flashcards_started / completed**: Wrap the “flashcards → mind map” flow with metadata such as deck size and AI model so you can monitor conversion from flashcard study back into mind maps.
- **exam_date_set / exam_date_skipped**: Capture how many decks set exam reminders vs. skipping the prompt, useful for understanding retention levers tied to calendared studying.

### components\Generator.tsx

- **generation_submitted**: Fired when the user clicks the button to generate a mind map or flashcards.
- **upgrade_clicked**: Fired when the user clicks the 'Upload your Plan' button after receiving an 'insufficient credits' error.
- **generation_mode_changed**: Fired when the user switches between 'Mind Map' and 'Flashcards' generation modes.

### components\MindMapModal.tsx

- **flashcards_generation_requested**: Triggered when a user clicks the button to generate flashcards from the mind map markdown.
- **mindmap_exported**: Triggered when a user clicks to download the mind map as an SVG, PNG, or printable PDF.

### components\PricingClient.tsx

- **pricing_viewed**: Logs whenever the pricing grid renders (on both the public page and the in-app modal via the `context` property) so you can measure funnel entries.
- **pricing_billing_cycle_changed**: Tracks toggles between monthly and yearly billing, including the destination cycle.
- **pricing_plan_cta_clicked**: Fired when a user taps any “Choose Student/Pro” button; includes the target plan and current subscription info.
- **pricing_auth_prompt_shown**: Indicates that an unauthenticated user attempted to upgrade and was shown the sign-in modal, helping you quantify anonymous upgrade intent.
- **pricing_checkout_initiated**: Emitted right before Paddle checkout opens (with plan + billing cycle) to align checkout starts with Paddle revenue data.
- **pricing_checkout_completed**: Fired when Paddle reports a successful checkout, including the Paddle checkout ID.
- **pricing_checkout_closed**: Captures checkout closes (with Paddle’s `closeType`) so you can monitor abandonment reasons.
- **pricing_checkout_error**: Logged if Paddle throws during checkout initialization; includes the error message.

### components\PromptForm.tsx

- **prompt-submitted**: Tracks when a user submits a prompt, either by clicking the send button or pressing the Enter key. Properties include the prompt length, number of files, and submission method ('click' or 'enter_key').

### components\AuthModal.tsx

- **user_signed_up**: Tracks when a user successfully signs up through email magic link or Google OAuth. Properties include the signup method ('email' or 'google').


## Events still awaiting implementation
- (human: you can fill these in)
---

## Next Steps

1. Review the changes made to your files
2. Test that events are being captured correctly
3. Create insights and dashboards in PostHog
4. Make a list of events we missed above. Knock them out yourself, or give this file to an agent.

Learn more about what to measure with PostHog and why: https://posthog.com/docs/new-to-posthog/getting-hogpilled
