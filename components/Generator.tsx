'use client';

import { useState, useEffect, useCallback, useRef, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import { supabase } from '@/lib/supabaseClient';
import { type ModelChoice } from '@/lib/plans';
import { Sparkles } from 'lucide-react';
import type AuthModalComponent from '@/components/AuthModal';
import type MindMapModalComponent from '@/components/MindMapModal';
import type FlashcardsModalComponent from '@/components/FlashcardsModal';
import type { Flashcard as FlashcardType } from '@/components/FlashcardsModal';

type AuthModalProps = ComponentProps<typeof AuthModalComponent>;
type MindMapModalProps = ComponentProps<typeof MindMapModalComponent>;
type FlashcardsModalProps = ComponentProps<typeof FlashcardsModalComponent>;

const AuthModal = dynamic<AuthModalProps>(() => import('@/components/AuthModal'), { ssr: false });
const MindMapModal = dynamic<MindMapModalProps>(() => import('@/components/MindMapModal'), { ssr: false });
const FlashcardsModal = dynamic<FlashcardsModalProps>(() => import('@/components/FlashcardsModal'), { ssr: false });

interface GeneratorProps {
  redirectOnAuth?: boolean;
  showTitle?: boolean;
  compact?: boolean;
  modelChoice?: ModelChoice;
}

export default function Generator({ redirectOnAuth = false, showTitle = true, compact = false, modelChoice = 'fast' }: GeneratorProps) {
  // Enforce a client-side per-file size cap to avoid server 413s (Vercel ~4.5MB)
  const MAX_FILE_BYTES = Math.floor(50 * 1024 * 1024); // 50MB per file when using Supabase Storage
  const [files, setFiles] = useState<File[]>([]);
  const [preParsed, setPreParsed] = useState<{ text: string; images: string[]; rawCharCount?: number } | null>(null);
  const [isPreParsing, setIsPreParsing] = useState(false);
  const lastPreparseKeyRef = useRef<string | null>(null);
  // Cache for file set processing results (keyed by file set combination)
  const processedFileSetsCache = useRef<Map<string, { result: any; processedAt: number }>>(new Map());

  // Debug logging in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[FileCache] ${message}`, ...args);
    }
  }, [isDevelopment]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'mindmap' | 'flashcards'>('mindmap');
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [flashcardsDeckId, setFlashcardsDeckId] = useState<string | undefined>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
  const [allowedNameSizes, setAllowedNameSizes] = useState<{ name: string; size: number }[] | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const router = useRouter();
  const limitExceededCacheRef = useRef<{
    signature: string;
    preParsed: { text: string; images: string[]; rawCharCount?: number } | null;
    allowedNameSizes: { name: string; size: number }[] | undefined;
    error: string | null;
  } | null>(null);

  const getNameSizeSignature = useCallback(
    (items: { name: string; size: number }[]) =>
      items
        .map((item) => `${item.name}::${item.size}`)
        .sort()
        .join('|'),
    []
  );

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
      setUserId(data.user ? data.user.id : null);
      setAuthChecked(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
      if (signedIn) {
        setShowAuth(false);
        if (redirectOnAuth) {
            router.push('/dashboard');
        }
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router, redirectOnAuth]);

  // Effect to handle preview animation for non-auth users
  useEffect(() => {
    if (!isAuthed && authChecked) {
      const hasInput = files.length > 0 || prompt.trim().length > 0;
      setPreviewLoading(hasInput && !isLoading && !isPreParsing);
    } else {
      setPreviewLoading(false);
    }
  }, [isAuthed, authChecked, files.length, prompt, isLoading, isPreParsing]);

  // Helper function to generate a unique key for a file
  const getFileKey = useCallback(async (file: File): Promise<string> => {
    // Create a truly unique key that avoids special characters and conflicts
    // Include timestamp for uniqueness and content hash for deduplication
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);

    try {
      // Create content hash from first 512 bytes for deduplication
      const slice = file.slice(0, 512);
      const arrayBuffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let hash = 0;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash) + bytes[i];
        hash = hash & hash; // Convert to 32-bit integer
      }
      const contentHash = Math.abs(hash).toString(36).slice(0, 8);

      // Safe filename: sanitize name and limit length
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 50);

      // Final key: timestamp_random_contentHash_safeName
      const finalKey = `${timestamp}_${random}_${contentHash}_${safeName}`;
      debugLog(`Generated file key: ${finalKey}`);
      return finalKey;
    } catch (error) {
      // Fallback: use timestamp + random + size + safe name
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 50);
      const fallbackKey = `${timestamp}_${random}_${file.size}_${safeName}`;
      debugLog(`Hashing failed, using fallback key: ${fallbackKey}`);
      return fallbackKey;
    }
  }, [debugLog]);

  // Helper function to generate a file set key from multiple files
  const getFileSetKey = useCallback(async (files: File[]): Promise<string> => {
    const fileKeys = await Promise.all(files.map(f => getFileKey(f)));
    return fileKeys.sort().join('__'); // Use double underscore instead of pipes
  }, [getFileKey]);

  async function uploadOneWithRetry(file: File, initialSignedUrl: string, getFreshSigned: () => Promise<string>, onProgress?: (progress: number) => void) {
    const tryUpload = async (signedUrl: string) => {
      return new Promise<Error | null>((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(null);
          } else {
            let message = `Upload failed with status ${xhr.status}`;
            try {
              const res = JSON.parse(xhr.responseText);
              message = res.message || message;
            } catch {}
            console.error(`XHR Upload Error: ${xhr.status}`, { response: xhr.responseText, url: signedUrl, file: { name: file.name, size: file.size, type: file.type } });
            resolve(new Error(message));
          }
        });

        xhr.addEventListener('error', (e) => {
          console.error('XHR Upload Network Error:', { error: e, url: signedUrl, file: { name: file.name, size: file.size, type: file.type } });
          resolve(new Error('Upload failed due to a network error.'));
        });

        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.send(file);
      });
    };

    let err = await tryUpload(initialSignedUrl);
    if (!err) return;

    const msg = String(err?.message || '');
    const transient = /load failed|network|timeout|expired|token/i.test(msg);
    if (!transient) throw err;

    // Fresh token then retry once
    const freshUrl = await getFreshSigned();
    err = await tryUpload(freshUrl);
    if (err) throw err;
  }

  // Upload files to Supabase Storage using signed URLs, then call JSON preparse
  const uploadAndPreparse = useCallback(async (selectedFiles: File[], onProgress?: (progress?: number) => void) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    // Generate stable keys per file for deterministic storage paths
    const keys = await Promise.all(selectedFiles.map(f => getFileKey(f)));
    const filesMeta = selectedFiles.map((f, i) => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', key: keys[i] }));
    const anonId = (typeof window !== 'undefined') ? (localStorage.getItem('cogniguide_anon_id') || (() => { const v = crypto.randomUUID(); localStorage.setItem('cogniguide_anon_id', v); return v; })()) : undefined;
    // Request signed upload URLs
    const signedRes = await fetch('/api/storage/get-signed-uploads', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ files: filesMeta, anonId }),
    });
    if (!signedRes.ok) {
      const j = await signedRes.json().catch(() => null);
      throw new Error(j?.error || 'Failed to prepare uploads');
    }
    const { bucket, items } = await signedRes.json();
    // Upload each file via signed URL with progress tracking
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const first = items[i];

      await uploadOneWithRetry(
        file,
        first.signedUrl,
        async () => {
          // re-fetch a fresh signed URL for this single file
          const meta = { name: file.name, size: file.size, type: file.type || 'application/octet-stream', key: keys[i] };
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
          }
          const signedRes2 = await fetch('/api/storage/get-signed-uploads', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ files: [meta], anonId }),
          });
          if (!signedRes2.ok) throw new Error('Failed to refresh upload URL');
          const fresh = await signedRes2.json();
          return fresh.items[0].signedUrl;
        },
        onProgress ? (fileProgress) => {
          // Calculate overall progress across all files
          const baseProgress = (i / selectedFiles.length) * 100;
          const currentFileProgress = fileProgress / selectedFiles.length;
          const overallProgress = Math.round(baseProgress + currentFileProgress);
          onProgress(overallProgress);
        } : undefined
      );
    }

    // Signal that upload is complete and server processing is starting
    if (onProgress) {
      onProgress(100); // Set progress to 100% to indicate upload complete, processing started
    }
    
    // Build objects descriptor and call JSON preparse
    const objects = items.map((it: any, i: number) => ({ path: it.path, name: selectedFiles[i].name, type: selectedFiles[i].type || 'application/octet-stream', size: selectedFiles[i].size }));
    const preRes = await fetch('/api/preparse', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ bucket, objects }),
    });
    if (!preRes.ok) {
      const j = await preRes.json().catch(() => null);
      throw new Error(j?.error || 'Failed to prepare files.');
    }
    return await preRes.json();
  }, [getFileKey]);

  const handleFileChange = useCallback(async (selectedFiles: File[]) => {
    // Clear any previous errors when files change
    setError(null);
    
    if (!selectedFiles || selectedFiles.length === 0) {
      setFiles([]);
      processedFileSetsCache.current.clear();
      setPreParsed(null);
      lastPreparseKeyRef.current = null;
      limitExceededCacheRef.current = null;
      setAllowedNameSizes(undefined);
      return;
    }

    const incomingSignature = getNameSizeSignature(selectedFiles.map((file) => ({ name: file.name, size: file.size })));
    const cachedLimitExceeded = limitExceededCacheRef.current;
    if (cachedLimitExceeded) {
      if (cachedLimitExceeded.signature === incomingSignature) {
        setFiles(selectedFiles);
        setPreParsed(cachedLimitExceeded.preParsed);
        setAllowedNameSizes(cachedLimitExceeded.allowedNameSizes);
        setError(cachedLimitExceeded.error);
        return;
      }
      limitExceededCacheRef.current = null;
    }

    // Validate file sizes before accepting them (50MB when using Supabase Storage)
    const tooLargeFile = selectedFiles.find(f => f.size > MAX_FILE_BYTES);
    if (tooLargeFile) {
      setError(`"${tooLargeFile.name}" is too large. Max file size is ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB.`);
      return; // Don't update files state
    }

    // Log image files for debugging
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      debugLog(`Processing ${imageFiles.length} image files:`, imageFiles.map(f => `${f.name} (${f.type})`));
    }

    setFiles(selectedFiles);
    // Generate a key for the current file set
    const fileSetKey = await getFileSetKey(selectedFiles);
    debugLog(`File set key: ${fileSetKey}`);
    lastPreparseKeyRef.current = fileSetKey;

    // Check if we have a cached result for this exact file set (valid for 5 minutes)
    const cachedResult = processedFileSetsCache.current.get(fileSetKey);
    const cacheAge = cachedResult ? Date.now() - cachedResult.processedAt : 0;
    const isCacheValid = cachedResult && cacheAge < 5 * 60 * 1000;
    debugLog(`Cache hit: ${!!cachedResult}, Cache age: ${Math.round(cacheAge / 1000)}s, Valid: ${!!isCacheValid}`);

    if (isCacheValid) {
      // Use cached result
      const j = cachedResult.result;
      const isAuthedFromApi = Boolean(j?.isAuthed);
      const text = typeof j?.text === 'string' ? j.text : '';
      const images = Array.isArray(j?.images) ? j.images as string[] : [];
      const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
      setPreParsed({ text, images, rawCharCount });

      // Handle cumulative pruning feedback from cached result
      const limitExceeded = Boolean(j?.limitExceeded);
      const includedFiles = Array.isArray(j?.includedFiles) ? j.includedFiles as { name: string; size: number }[] : [];
      const excludedFiles = Array.isArray(j?.excludedFiles) ? j.excludedFiles as { name: string; size: number }[] : [];
      const partialFile = j?.partialFile as { name: string; size: number; includedChars: number } | null;
      const includedSignature = getNameSizeSignature(includedFiles);
      if (limitExceeded) {
        const truncationError = (isAuthedFromApi || isAuthed)
          ? 'Content exceeds the length limit for your current plan. the content has been truncated.'
          : null;
        setAllowedNameSizes(includedFiles);
        setError(truncationError);
        limitExceededCacheRef.current = {
          signature: includedSignature,
          preParsed: { text, images, rawCharCount },
          allowedNameSizes: includedFiles,
          error: truncationError,
        };
      } else {
        setAllowedNameSizes(undefined);
        limitExceededCacheRef.current = null;
      }
      return;
    }

    // No valid cache, pre-parse now using Supabase Storage JSON flow (fallback to legacy on failure)
    try {
      setIsPreParsing(true);
      setUploadProgress(0);
      let j: any;
      try {
        j = await uploadAndPreparse(selectedFiles, (progress) => {
          setUploadProgress(progress);
        });
      } catch (e) {
        // Fallback: legacy small-upload path if JSON/storage fails
        const totalBytes = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
        const reason = (e && (e as any).message) || (e && (e as any).error) || (typeof e === 'string' ? e : '') || 'Unknown error';

        // Check if it's an image-related error and provide more specific guidance
        const hasImages = selectedFiles.some(f => f.type.startsWith('image/'));
        if (hasImages && (reason.toLowerCase().includes('image') || reason.toLowerCase().includes('upload') || reason.toLowerCase().includes('storage'))) {
          setError(`Image upload failed: ${reason}. Please try uploading your images again or use a different image format.`);
          setPreParsed(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }

        if (totalBytes > 4 * 1024 * 1024) {
          setError(`Storage pre-parse failed: ${reason}. Large files cannot be sent directly; please retry later or check storage configuration.`);
          setPreParsed(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }
        const formData = new FormData();
        selectedFiles.forEach((f) => formData.append('files', f));
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch('/api/preparse', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (!res.ok) {
          try {
            const jj = await res.json();
            const errorMsg = jj?.error || 'Failed to prepare files.';
            // Provide more specific error message for image-related failures
            if (hasImages && (errorMsg.toLowerCase().includes('image') || errorMsg.toLowerCase().includes('format'))) {
              setError(`Image processing failed: ${errorMsg} Please ensure your images are in supported formats (PNG, JPG, JPEG, GIF, WEBP).`);
            } else {
              setError(errorMsg);
            }
          } catch {
            setError('Failed to prepare files.');
          }
          setPreParsed(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }
        j = await res.json();
      }

      // Cache the complete result for this file set
      processedFileSetsCache.current.set(fileSetKey, {
        result: j,
        processedAt: Date.now()
      });

      debugLog(`Cached result for key: ${fileSetKey}, Cache size: ${processedFileSetsCache.current.size}`);

      // Clean up old cache entries (keep only last 10 to prevent memory issues)
      if (processedFileSetsCache.current.size > 10) {
        const entries = Array.from(processedFileSetsCache.current.entries());
        entries.sort((a, b) => b[1].processedAt - a[1].processedAt);
        processedFileSetsCache.current.clear();
        entries.slice(0, 10).forEach(([key, value]) => {
          processedFileSetsCache.current.set(key, value);
        });
        debugLog(`Cleaned up cache, new size: ${processedFileSetsCache.current.size}`);
      }

      const isAuthedFromApi = Boolean(j?.isAuthed);
      const text = typeof j?.text === 'string' ? j.text : '';
      const images = Array.isArray(j?.images) ? j.images as string[] : [];
      const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
      setPreParsed({ text, images, rawCharCount });

      // Handle cumulative pruning feedback
      const limitExceeded = Boolean(j?.limitExceeded);
      const includedFiles = Array.isArray(j?.includedFiles) ? j.includedFiles as { name: string; size: number }[] : [];
      const excludedFiles = Array.isArray(j?.excludedFiles) ? j.excludedFiles as { name: string; size: number }[] : [];
      const partialFile = j?.partialFile as { name: string; size: number; includedChars: number } | null;
      const includedSignature = getNameSizeSignature(includedFiles);
      if (limitExceeded) {
        const truncationError = (isAuthedFromApi || isAuthed)
          ? 'Content exceeds the length limit for your current plan. the content has been truncated.'
          : null;
        setAllowedNameSizes(includedFiles);
        setError(truncationError);
        limitExceededCacheRef.current = {
          signature: includedSignature,
          preParsed: { text, images, rawCharCount },
          allowedNameSizes: includedFiles,
          error: truncationError,
        };
      } else {
        setAllowedNameSizes(undefined);
        limitExceededCacheRef.current = null;
      }
    } catch(e) {
      if (e instanceof Error) setError(`Pre-parse failed: ${e.message}`);
      // Non-fatal
    } finally {
      setIsPreParsing(false);
      setUploadProgress(undefined);
    }
  }, [getFileSetKey, debugLog, MAX_FILE_BYTES, isAuthed, uploadAndPreparse, getNameSizeSignature]);

  const requireAuthErrorMessage = 'Please sign up to generate with CogniGuide.';

  const handleSubmit = async () => {
    if (authChecked && !isAuthed) {
      setError(requireAuthErrorMessage);
      setShowAuth(true);
      posthog.capture('non_auth_generation_blocked', {
        mode,
      });
      return;
    }

    const trimmedPrompt = prompt.trim();

    posthog.capture('generation_submitted', {
      mode: mode,
      file_count: files.length,
      has_prompt: !!trimmedPrompt,
      non_auth_generations_allowed: false,
      model_choice: modelChoice,
    });
    if (mode === 'flashcards') {
      const hasFiles = files.length > 0;
      // Require either files or a prompt topic for flashcards generation
      if (!hasFiles && !trimmedPrompt) {
        setError('Please upload at least one file or enter a topic to generate flashcards.');
        return;
      }

      // Only clear error and start loading if we pass the validation checks
      setIsLoading(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        let res: Response;
        if (!hasFiles) {
          const payload = {
            text: trimmedPrompt,
            images: [],
            prompt: '',
            rawCharCount: trimmedPrompt.length,
            model: modelChoice,
          };
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
          }
          res = await fetch('/api/generate-flashcards?stream=1', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers,
          });
        } else {
          // If we haven't pre-parsed yet, do it now (single upload)
          let effectivePreParsed: { text: string; images: string[]; rawCharCount?: number } | null = preParsed;
          if (!effectivePreParsed) {
            try {
              setIsPreParsing(true);
              setUploadProgress(0);
              const j = await uploadAndPreparse(files, (progress) => {
                setUploadProgress(progress);
              });
              const text = typeof j?.text === 'string' ? j.text : '';
              const images = Array.isArray(j?.images) ? j.images as string[] : [];
              const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
              effectivePreParsed = { text, images, rawCharCount };
              setPreParsed(effectivePreParsed);
            } catch(e) {
              const msg = (e instanceof Error) ? e.message : 'An unknown error occurred during pre-parse.';
              setError(msg);
            }
            finally {
              setIsPreParsing(false);
              setUploadProgress(undefined);
            }
          }
          if (effectivePreParsed) {
            const payload = {
              text: effectivePreParsed.text || '',
              images: effectivePreParsed.images || [],
              prompt: trimmedPrompt || '',
              rawCharCount: effectivePreParsed.rawCharCount,
              model: modelChoice,
            };

            // Debug logging for image processing
            debugLog('Flashcard payload:', {
              hasText: !!effectivePreParsed.text,
              imageCount: effectivePreParsed.images?.length || 0,
              hasImages: (effectivePreParsed.images?.length || 0) > 0,
              firstImagePreview: effectivePreParsed.images?.[0]?.startsWith('data:') ? effectivePreParsed.images[0].substring(0, 100) + '...' : (effectivePreParsed.images?.[0] || '')
            });

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }
            res = await fetch('/api/generate-flashcards?stream=1', {
              method: 'POST',
              body: JSON.stringify(payload),
              headers: headers,
            });
          } else {
            // As a last resort, fall back to legacy multipart for very small sets
            const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
            if (totalBytes > 4 * 1024 * 1024) {
              throw new Error('Upload is too large for direct submit and storage pre-parse failed. Please retry or check storage configuration.');
            }
            const formData = new FormData();
            files.forEach((file) => formData.append('files', file));
            if (trimmedPrompt) formData.append('prompt', trimmedPrompt);
            formData.append('model', modelChoice);
            const headers: Record<string, string> = {};
            if (accessToken) {
              headers['Authorization'] = `Bearer ${accessToken}`;
            }
            res = await fetch('/api/generate-flashcards?stream=1', {
              method: 'POST',
              body: formData,
              headers: headers,
            });
          }
        }
        // Handle insufficient credits the same way as mind maps: show inline error and do not open modal
        if (res.status === 402) {
          let msg = 'Insufficient credits. Upload a smaller file or';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            let errorMsg = 'Failed to generate flashcards.';
            try { const j = await res.json(); errorMsg = j.error || errorMsg; } catch {}
            throw new Error(errorMsg);
          } else {
            let errorMsg = `Failed to generate flashcards. Server returned ${res.status} ${res.statusText}.`;
            try { const text = await res.text(); errorMsg = `${errorMsg} ${text}`; } catch {}
            throw new Error(errorMsg);
          }
        }
        // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
        if (isAuthed) {
          try {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            if (uid) {
              const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
              const creditsVal = Number(creditsData?.credits ?? 0);
              const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
            }
          } catch {}
        }
        // Open modal only after successful response
        setFlashcardsOpen(true);

        if (!res.body) {
          const data = await res.json().catch(() => null);
          const cards = Array.isArray(data?.cards) ? data.cards as FlashcardType[] : [];
          if (cards.length === 0) throw new Error('No cards generated');
          setFlashcardsCards(cards);
          setFlashcardsTitle(typeof data?.title === 'string' ? data.title : null);
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
              }
            } catch {}
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let streamedTitle: string | null = null;
          const accumulated: FlashcardType[] = [];
          // eslint-disable-next-line no-constant-condition
          while (true) {
            // eslint-disable-next-line no-await-in-loop
            const { value, done } = await reader.read();
            if (done) break;
            if (value) buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
              const rawLine = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!rawLine) continue;
              try {
                const obj = JSON.parse(rawLine);
                if (obj?.type === 'meta') {
                  if (typeof obj.title === 'string' && obj.title.trim()) streamedTitle = obj.title.trim();
                } else if (obj?.type === 'card') {
                  const card: FlashcardType = {
                    question: String(obj.question || ''),
                    answer: String(obj.answer || ''),
                  };
                  accumulated.push(card);
                  setFlashcardsCards((prev) => prev ? [...prev, card] : [card]);
                }
              } catch {
                // ignore malformed lines
              }
            }
          }
          setFlashcardsTitle(streamedTitle);
          if (accumulated.length === 0) throw new Error('No cards generated');
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (streamedTitle && streamedTitle.trim()) ? streamedTitle.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards: accumulated })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
              }
            } catch {}
          }
        }

        // No longer require sign-in after successful generation
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate flashcards.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (files.length === 0 && !trimmedPrompt) {
      setError('Please upload at least one file or enter a text prompt to generate a mind map.');
      return;
    }

    // Only clear error and start loading if we pass the validation checks
    setIsLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      let response: Response;
      // If we haven't pre-parsed yet, do it now (single upload)
      let effectivePreParsed: { text: string; images: string[]; rawCharCount?: number } | null = preParsed;
      if (!effectivePreParsed && files.length > 0) {
        try {
          setIsPreParsing(true);
          setUploadProgress(0);
          const j = await uploadAndPreparse(files, (progress) => {
            setUploadProgress(progress);
          });
          const text = typeof j?.text === 'string' ? j.text : '';
          const images = Array.isArray(j?.images) ? j.images as string[] : [];
          const rawCharCount = typeof j?.totalRawChars === 'number' ? j.totalRawChars as number : undefined;
          effectivePreParsed = { text, images, rawCharCount };
          setPreParsed(effectivePreParsed);
        } catch(e) {
            const msg = (e instanceof Error) ? e.message : 'An unknown error occurred during pre-parse.';
            setError(msg);
        }
        finally {
          setIsPreParsing(false);
          setUploadProgress(undefined);
        }
      }
      if (effectivePreParsed) {
        const payload = { text: effectivePreParsed.text || '', images: effectivePreParsed.images || [], prompt: trimmedPrompt || '', rawCharCount: effectivePreParsed.rawCharCount, model: modelChoice };

        // Debug logging for image processing
        debugLog('Mindmap payload:', {
          hasText: !!effectivePreParsed.text,
          imageCount: effectivePreParsed.images?.length || 0,
          hasImages: (effectivePreParsed.images?.length || 0) > 0,
          firstImagePreview: effectivePreParsed.images?.[0]?.startsWith('data:') ? effectivePreParsed.images[0].substring(0, 100) + '...' : (effectivePreParsed.images?.[0] || '')
        });

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        response = await fetch('/api/generate-mindmap', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: headers,
        });
      } else {
        // As a last resort, fallback to legacy multipart
        const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
        if (totalBytes > 4 * 1024 * 1024) {
          throw new Error('Upload is too large for direct submit and storage pre-parse failed. Please retry or check storage configuration.');
        }
        const formData = new FormData();
        if (files.length > 0) { files.forEach(file => { formData.append('files', file); }); }
        if (trimmedPrompt) formData.append('prompt', trimmedPrompt);
        formData.append('model', modelChoice);
        const headers: Record<string, string> = {};
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        response = await fetch('/api/generate-mindmap', {
          method: 'POST',
          body: formData,
          headers: headers,
        });
      }
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        if (contentType.includes('application/json')) {
          let errorMsg = 'Failed to generate mind map.';
          try { const j = await response.json(); errorMsg = j.error || errorMsg; } catch {}
          throw new Error(errorMsg);
        } else {
          let errorMsg = `Failed to generate mind map. Server returned ${response.status} ${response.statusText}.`;
          try { const text = await response.text(); errorMsg = `${errorMsg} ${text}`; } catch {}
          throw new Error(errorMsg);
        }
      }
      // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
      if (isAuthed) {
        try {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id;
          if (uid) {
            const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
            const creditsVal = Number(creditsData?.credits ?? 0);
            const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
          }
        } catch {}
      }
      if (!contentType.includes('text/plain')) {
        // Non-stream fallback
        const result = await response.json();
        const md = (result?.markdown as string | undefined)?.trim();
        if (!md) throw new Error('Empty result from AI.');
        setMarkdown(md);
        if (isAuthed && userId) {
          const title = (() => {
            const h1 = md.match(/^#\s(.*)/m)?.[1];
            if (h1) return h1;
            const fm = md.match(/title:\s*(.*)/)?.[1];
            if (fm) return fm;
            return 'mindmap';
          })();
          try {
            await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md });
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
          } catch {}
        }
        // Mindmap stream completion event (non-stream path mimics completion)
        try { if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('cogniguide:mindmap-stream-complete')), 0); } catch {}
        // No longer require sign-in after successful generation
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let receivedAny = false;
      if (!reader) throw new Error('No response stream.');
      // Open modal immediately on first token
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          if (!receivedAny && accumulated.trim().length > 0) {
            receivedAny = true;
          }
          setMarkdown(accumulated);
        }
      };
      await pump();

      const md = accumulated.trim();
      if (!md) throw new Error('Empty result from AI.');

      // Save for authed users after stream completes
      if (isAuthed && userId) {
        const title = (() => {
          const h1 = md.match(/^#\s(.*)/m)?.[1];
          if (h1) return h1;
          const fm = md.match(/title:\s*(.*)/)?.[1];
          if (fm) return fm;
          return 'mindmap';
        })();
        try {
          await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md });
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
        } catch {}
      }
      // Mindmap stream completion event (stream path)
      try { if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('cogniguide:mindmap-stream-complete')), 0); } catch {}
      // No longer require sign-in after successful generation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => setMarkdown(null);
  const handleCloseFlashcards = () => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setFlashcardsDeckId(undefined); };
  
  const handleUpgradeClick = () => {
    posthog.capture('upgrade_clicked', {
      source: 'generator_insufficient_credits',
      is_authed: isAuthed,
    });
    try {
      if (isAuthed) {
        router.push('/dashboard?upgrade=true');
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cogniguide_upgrade_flow', 'true');
        }
        router.push('/pricing');
      }
    } catch {}
  };

  const canSubmit = (!isLoading && !isPreParsing && markdown === null && !flashcardsOpen);

  return (
    <>
      <MindMapModal markdown={markdown} onClose={handleCloseModal} />
      <FlashcardsModal open={flashcardsOpen} title={flashcardsTitle} cards={flashcardsCards} isGenerating={isLoading && mode==='flashcards'} error={flashcardsError} onClose={handleCloseFlashcards} deckId={flashcardsDeckId} />
      <AuthModal open={showAuth} />
      <section id="generator" className={showTitle ? (compact ? 'pt-3 pb-5' : 'pt-4 pb-8') : (compact ? 'pb-12' : 'pb-20')}>
        <div className="container">
          {showTitle && (
            <div className={compact ? 'text-center mb-4' : 'text-center mb-6'}>
              <h2 className={compact ? 'text-2xl md:text-3xl font-bold font-heading tracking-tight' : 'text-3xl md:text-4xl font-bold font-heading tracking-tight'}>Turn Your Notes into Mind Maps &amp; Flashcards with AI.</h2>
              <p className="text-muted-foreground mt-2">Upload your PDFs, slides, or documents—or simply describe a topic. Our AI creates clear mind maps and smart, spaced-repetition flashcards to help you learn faster.</p>
            </div>
          )}
            <div className={compact ? 'relative w-full max-w-none mx-auto bg-background rounded-[2rem] generator-card generator-card--compact' : 'relative w-full max-w-none mx-auto bg-background rounded-[2rem] generator-card'}>
            <div className={compact ? 'absolute -top-3 -left-3 w-20 h-20 bg-primary/10 rounded-full blur-2xl -z-10' : 'absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10'}></div>
            <div className={compact ? 'absolute -bottom-3 -right-3 w-28 h-28 bg-accent/10 rounded-full blur-3xl -z-10' : 'absolute -bottom-4 -right-4 w-32 h-32 bg-accent/10 rounded-full blur-3xl -z-10'}></div>
            <div className={compact ? 'p-4 sm:p-6 space-y-4' : 'p-4 sm:p-6 space-y-4'}>
              <div className="flex items-center justify-center">
                <div className="inline-flex p-1 rounded-full border bg-muted/50">
                  <button
                    onClick={() => {
                      posthog.capture('generation_mode_changed', { new_mode: 'mindmap' });
                      setMode('mindmap');
                    }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode==='mindmap' ? 'bg-background text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                  >Mind Map</button>
                  <button
                    onClick={() => {
                      posthog.capture('generation_mode_changed', { new_mode: 'flashcards' });
                      setMode('flashcards');
                    }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode==='flashcards' ? 'bg-background text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                  >Flashcards</button>
                </div>
              </div>
              <Dropzone
                onFileChange={handleFileChange}
                disabled={isLoading || markdown !== null || flashcardsOpen}
                isPreParsing={isPreParsing}
                uploadProgress={uploadProgress}
                allowedNameSizes={allowedNameSizes}
                size={compact ? 'compact' : 'default'}
                onOpen={() => {
                  if (!authChecked) return false;
                  if (!isAuthed) {
                    setShowAuth(true);
                    return false; // require auth before allowing uploads
                  }
                  return true;
                }}
                onFileRemove={() => {
                  // Reset upload states when a file is removed during upload
                  setIsPreParsing(false);
                  setUploadProgress(undefined);
                  // Clear any cached pre-parsed results since file set changed
                  setPreParsed(null);
                  setAllowedNameSizes(undefined);
                  // Clear last preparse key to force re-processing
                  lastPreparseKeyRef.current = null;
                  debugLog('Upload states reset due to file removal');
                }}
              />
              <PromptForm
                onSubmit={handleSubmit}
                isLoading={isLoading}
                prompt={prompt}
                setPrompt={setPrompt}
                disabled={!canSubmit}
                filesLength={files.length}
                ctaLabel={mode==='flashcards' ? 'Generate Flashcards' : 'Generate Mind Map'}
                mode={mode}
                previewLoading={previewLoading}
                onInteract={() => {
                  if (!authChecked) return;
                  if (!isAuthed) setShowAuth(true);
                }}
              />
              {error && (
                <div className="mt-4 text-center p-4 bg-muted border border-border text-foreground rounded-[1.25rem]">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    {typeof error === 'string' && error.toLowerCase().includes('insufficient credits') && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <p className="font-medium">{error}</p>
                        <button
                          type="button"
                          onClick={handleUpgradeClick}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Upload your Plan</span>
                        </button>
                      </div>
                    )}
                    {typeof error === 'string' && error === requireAuthErrorMessage && (
                      <p className="font-medium text-center">
                        Please{' '}
                        <button
                          type="button"
                          onClick={() => setShowAuth(true)}
                          className="underline hover:no-underline font-semibold text-primary"
                        >
                          sign up
                        </button>{' '}
                        to generate with CogniGuide.
                      </p>
                    )}
                    {typeof error === 'string' &&
                     !error.toLowerCase().includes('insufficient credits') &&
                     error !== requireAuthErrorMessage &&
                     !error.toLowerCase().includes('exceed') && (
                      <p className="font-medium">{error}</p>
                    )}
                    {typeof error === 'string' && error.toLowerCase().includes('exceed') && (
                      <p className="font-medium">{error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
