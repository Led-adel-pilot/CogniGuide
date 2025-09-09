# Large File Upload Details

This document provides a comprehensive overview of the large file upload system in CogniGuide, detailing its architecture, the role of each component, how progress is calculated, and a history of encountered errors and their resolutions.

## System Architecture & Workflow

CogniGuide supports uploading large files (up to 50MB per file) by leveraging Supabase Storage, thereby circumventing Vercel's ~4.5MB request body limit. This enables users to process extensive documents and images for mind map and flashcard generation. The end-to-end workflow is as follows:

1.  **File Selection & Client-Side Validation (`components/Dropzone.tsx`):** Users select files via drag-and-drop or file dialog. Basic client-side validation (e.g., file size limits) is performed immediately.
2.  **Signed URL Request (`components/Generator.tsx` -> `/api/storage/get-signed-uploads`):** For valid files, the client sends a request to the `/api/storage/get-signed-uploads` endpoint to obtain secure, temporary upload URLs for each file. This request includes file metadata (name, size, type) and, if authenticated, the user's access token.
3.  **Direct Upload to Supabase Storage (`components/Generator.tsx` via XHR):** Using the received `signedUrl` from the server, the client directly uploads each file to a private Supabase Storage bucket (`uploads`). This process utilizes `XMLHttpRequest` to track and display real-time upload progress.
4.  **Server-Side Pre-processing Request (`components/Generator.tsx` -> `/api/preparse`):** Once all files are successfully uploaded to Supabase Storage, the client sends a JSON payload to the `/api/preparse` endpoint. This payload contains the Supabase Storage paths of the uploaded files (and any user-provided prompt).
5.  **Server-Side File Retrieval & Parsing (`/api/preparse` -> `lib/document-parser.ts`):** The `/api/preparse` endpoint, operating with the Supabase Service Role Key for elevated permissions, downloads the files from Supabase Storage. It then uses `lib/document-parser.ts` to extract text from documents (PDF, DOCX, PPTX, TXT, MD) and converts images to base64 data URLs for multimodal AI processing. Content is truncated based on the user's subscription tier.
6.  **Content Preparation & Response (`/api/preparse`):** The extracted text and image data are combined and returned to the client as a JSON response. This response includes the total character count, maximum allowed characters, and flags indicating if content was truncated.
7.  **AI Content Generation (`components/Generator.tsx` -> `/api/generate-mindmap` or `/api/generate-flashcards`):** With the pre-parsed content (text and images), the client then makes a final request to either the `/api/generate-mindmap` or `/api/generate-flashcards` endpoint. This initiates the AI model to generate the desired output.
8.  **Real-time Feedback & Generation (`components/Dropzone.tsx`, `components/Generator.tsx`):** The UI provides continuous feedback throughout this process. The progress bar indicates upload completion, and the status text switches to "Processing..." during server-side operations, ensuring users are informed at each stage.

## Role of Each Script

### `components/Dropzone.tsx`

*   **User Interface:** Provides the drag-and-drop area and file selection input.
*   **File Management:** Manages the list of selected files, handles adding and removing files.
*   **Visual Feedback:** Displays file names, sizes, and visually indicates drag-over states.
*   **Progress Visualization:** Integrates `RadialProgressBar` to show upload progress and switches text to "Processing..." during server-side pre-parsing.

### `components/Generator.tsx`

*   **Orchestration:** Acts as the central orchestrator for the entire generation workflow, from file selection to AI output.
*   **State Management:** Manages core application states such as selected files, prompt text, loading status, errors, and the generated markdown/flashcards.
*   **Authentication & Authorization:** Checks user authentication status, handles free generation limits for unauthenticated users, and triggers the `AuthModal` if sign-in is required.
*   **File Pre-processing Logic:** Coordinates the `uploadAndPreparse` function, which handles requesting signed URLs, uploading files to Supabase, and calling the `/api/preparse` endpoint.
*   **Progress Calculation:** Tracks and updates the `uploadProgress` state, which is then passed to the `Dropzone` for display.
*   **Error Handling:** Catches and displays errors from various stages (file validation, upload, pre-parse, generation).
*   **Caching:** Implements an in-memory cache (`processedFileSetsCache`) for file set processing results to prevent redundant API calls for identical file combinations.

### `app/api/storage/get-signed-uploads/route.ts`

*   **API Endpoint:** A Next.js API route responsible for generating signed URLs for direct file uploads to Supabase Storage.
*   **Authentication:** Verifies the user's identity (authenticated or anonymous) based on the `Authorization` header or a provided `anonId`.
*   **Path Generation:** Constructs unique and sanitized paths for files within the Supabase `uploads` bucket, including user/anonymous IDs and date directories.
*   **Signed URL Creation:** Calls `supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path)` to obtain a time-limited `signedUrl` that allows the client to upload a file directly.
*   **Error Handling:** Manages potential conflicts (e.g., file already exists) and provides descriptive error messages for various failure scenarios.

### `app/api/preparse/route.ts`

*   **API Endpoint:** A Next.js API route for server-side pre-processing of uploaded files.
*   **Authentication & Tier Check:** Determines the user's tier (`non-auth`, `free`, `paid`) to apply appropriate content length limits. Uses an in-memory cache for user tiers to optimize performance.
*   **File Retrieval:** For files uploaded to Supabase Storage (JSON mode), it downloads them using `supabaseAdmin.storage.from(bucket).download(path)`.
*   **Image Handling:** For image files, it generates a short-lived signed URL from Supabase Storage and passes it to the AI for multimodal processing, avoiding direct download and re-upload.
*   **Content Extraction:** Delegates the actual text extraction from various document types (PDF, DOCX, PPTX, TXT, MD) to `lib/document-parser.ts`.
*   **Content Aggregation:** Combines extracted text and image data URLs.
*   **Credit Calculation:** Provides `totalRawChars` for credit deduction calculations on the client.

### `lib/document-parser.ts`

*   **Document Parsing Utility:** Contains asynchronous functions (`getTextFromDocxRaw`, `getTextFromPdfRaw`, `getTextFromPptxRaw`, `getTextFromPlainTextRaw`) for extracting raw text content from various document formats without applying tier-based truncation.
*   **Cumulative Processing Logic (`processMultipleFiles`):** Manages the processing of multiple files, applying cumulative character limits based on the user's tier. It intelligently truncates content at word boundaries if the limit is exceeded and tracks included/excluded/partial files.
*   **Image Conversion:** Converts image file buffers to base64 data URLs.
*   **Tier-based Truncation (legacy/single-file):** The `truncateByUserTier` function (used in older/single-file flows) truncates text based on user tier limits and appends an appropriate upgrade message.

## Progress Bar Calculation Logic

The progress bar in `components/Dropzone.tsx` and its orchestration in `components/Generator.tsx` provide a two-stage visual feedback mechanism for large file uploads:

1.  **Upload Progress (0-100%):**
    *   **Trigger:** When a file upload to Supabase Storage begins, the `uploadOneWithRetry` function (in `components/Generator.tsx`) uses `XMLHttpRequest` to monitor the `progress` event.
    *   **Calculation:** The `onProgress` callback is invoked with `Math.round((event.loaded / event.total) * 100)` for each file. For multiple files, an overall progress is calculated as `(baseProgress + currentFileProgress)`.
    *   **Display:** `components/Dropzone.tsx` renders the `RadialProgressBar` with this `progress` value and displays the text "Uploading..." along with the percentage.

2.  **Processing State (100% Uploaded, awaiting server):**
    *   **Trigger:** Once all files have reached 100% upload to Supabase Storage, the `uploadAndPreparse` function (in `components/Generator.tsx`) explicitly calls `onProgress(100)`.
    *   **Display:** `components/Dropzone.tsx` detects `uploadProgress === 100` (or `undefined` just before server processing starts if no explicit 100% was set by previous step) and updates the status text to "Processing...", while the `RadialProgressBar` remains at 100%. This distinct state clearly indicates that the file transfer is complete, and the server is now actively working on the content.

## Encountered Errors and Fixes

### 1. Error: "Storage pre-parse failed: headers must have required property 'authorization'. Large files cannot be sent directly; please retry later or check storage configuration."

**Description:** This error occurred during initial attempts to pre-parse files, indicating that the server-side `/api/preparse` endpoint was not correctly receiving or validating authentication headers, particularly for anonymous users.

**Root Cause:** The `Authorization` header was not consistently being sent or correctly handled for all requests, especially in scenarios involving unauthenticated users or token refreshes. Specifically, `fetch` requests were not always including the `Authorization` header when an `accessToken` was available, and `getUserIdFromAuthHeader` in the API routes needed more robust error handling.

**Fixes Implemented:**

*   **`app/api/storage/get-signed-uploads/route.ts`:**
    *   Improved `getUserIdFromAuthHeader` to be more robust, with better error logging for issues retrieving user data from the token. This helps diagnose cases where a token might be present but invalid.
    *   Enhanced error messages to specifically mention "Upload permission denied. Please check your authentication." if authorization issues occur, providing clearer guidance.

*   **`components/Generator.tsx`:**
    *   Refactored all relevant fetch requests (`/api/storage/get-signed-uploads`, `/api/preparse`, `/api/generate-flashcards`, `/api/generate-mindmap`) to explicitly construct a `headers` object and conditionally include the `Authorization: Bearer ${accessToken}` header only when `accessToken` is present. This prevents sending an empty or `undefined` header, which some backend services (like Supabase) might interpret as a missing required property.
    *   Added more comprehensive error handling during the `uploadAndPreparse` and `handleSubmit` functions to catch and display specific error messages, preventing the UI from getting stuck and providing actionable feedback.

*   **`app/api/preparse/route.ts`:**
    *   Updated `getUserIdFromAuthHeader` for consistency and improved error logging, mirroring the changes in `get-signed-uploads`.
    *   Added a more descriptive error message when `supabaseAdmin` is not initialized (e.g., if `SUPABASE_SERVICE_ROLE_KEY` is missing), stating: "Storage not configured. The SUPABASE_SERVICE_ROLE_KEY is likely missing."

### 2. Error: "XHR Upload Error: 404 {}"

**Description:** After resolving the initial authorization issues, large file uploads would fail with a `404 (Not Found)` error during the direct upload to Supabase Storage, even after successfully receiving a signed URL from the server.

**Root Cause:** A subtle but critical typo in `app/api/storage/get-signed-uploads/route.ts` caused the server to return an invalid `signedUrl` from Supabase. The property was incorrectly accessed as `data.signedURL` (uppercase 'URL') instead of the correct `data.signedUrl` (lowercase 'url'), leading to a malformed URL being sent back to the client. The client-side then attempted to use this incomplete URL for the XHR PUT request, resulting in a 404.

**Fixes Implemented:**

*   **`app/api/storage/get-signed-uploads/route.ts`:**
    *   Corrected the property name from `data.signedURL` to `data.signedUrl` when extracting the signed URL from the Supabase API response and constructing the JSON response for the client.

*   **`components/Generator.tsx`:**
    *   Enhanced `uploadOneWithRetry` and `uploadAndPreparse` functions with more detailed console logging for XHR requests. This logging now includes the full upload URL, file metadata (name, size, type), and any error responses, which was crucial in diagnosing the malformed URL issue.

### 3. Issue: Progress bar gets to 100% and then gets stuck; generate button is not enabled until after a delay.

**Description:** For large files, the UI's upload progress bar would reach 100% and remain there, with the "Generate" button disabled, for a noticeable period. The user was left unclear about the ongoing process before the server-side processing was complete and the button became active.

**Root Cause:** The UI was accurately reflecting the *upload completion* (the file being successfully transferred to Supabase Storage), but it lacked a distinct visual cue for the subsequent *server-side processing* phase (where the server downloads, extracts, and prepares the content). This created a confusing "stuck" feeling for the user.

**Fixes Implemented:**

*   **`components/Generator.tsx`:**
    *   Modified the `uploadAndPreparse` function to explicitly call the `onProgress` callback with a value of `100` immediately after the direct file upload to Supabase Storage is confirmed as complete. This ensures the progress bar visually fills up to 100% at the end of the upload stage.

*   **`components/Dropzone.tsx`:**
    *   Updated the conditional logic for displaying the progress status text. Now, the text dynamically changes based on the `uploadProgress` state: it shows "Uploading..." along with the percentage when `uploadProgress < 100`, and switches to "Processing..." when `uploadProgress === 100` (or `undefined` after the initial upload stage and before final processing completion). This clear distinction informs the user that while the upload is done, the server is still working.

These collective changes have significantly improved the robustness, error handling, and user experience for large file uploads in CogniGuide, ensuring clear communication and reliable operation throughout the entire workflow.
