# Event tracking report

This document lists all PostHog events that have been automatically added to your Next.js application.

## Events by File

### app\contact\ContactForm.tsx

- **contact_form_submitted**: Triggered when a user submits the contact form.

### app\dashboard\DashboardClient.tsx

- **history_item_opened**: Tracks when a user clicks on a mindmap or flashcard deck from their history list in the sidebar.
- **spaced_repetition_deck_studied**: Tracks when a user clicks the 'Study' button for a specific deck in the spaced repetition modal.
- **user_signed_out**: Tracks when a user clicks the 'Sign out' button.

### app\pricing\page.tsx

- **pricing_header_logo_clicked**: Tracks when a user clicks the 'CogniGuide' logo in the header on the pricing page.
- **pricing_header_open_generator_clicked**: Tracks when a user clicks the 'Open Generator' button in the header on the pricing page.

### components\Dropzone.tsx

- **files_added**: Fired when a user adds one or more files, either by drag-and-drop or using the file selector.
- **file_removed**: Fired when a user clicks the 'X' button to remove a previously added file.

### components\FlashcardsModal.tsx

- **flashcard_graded**: Fired when a user grades their recall of a flashcard ('Again', 'Hard', 'Good', or 'Easy').
- **flashcard_answer_shown**: Fired when a user clicks the 'Show Answer' button to reveal the flashcard's answer.

### components\Generator.tsx

- **generation_submitted**: Fired when the user clicks the button to generate a mind map or flashcards.
- **upgrade_clicked**: Fired when the user clicks the 'Upload your Plan' button after receiving an 'insufficient credits' error.
- **generation_mode_changed**: Fired when the user switches between 'Mind Map' and 'Flashcards' generation modes.

### components\MindMapModal.tsx

- **flashcards_generation_requested**: Triggered when a user clicks the button to generate flashcards from the mind map markdown.
- **mindmap_exported**: Triggered when a user clicks to download the mind map as an SVG, PNG, or printable PDF.

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
