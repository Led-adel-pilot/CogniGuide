'use client';

import { useState, useEffect, useCallback, useRef, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import { supabase } from '@/lib/supabaseClient';
import { FREE_PLAN_GENERATIONS, type ModelChoice } from '@/lib/plans';
import { getStoredGenerationIntent } from '@/lib/generationIntent';
import { AlertTriangle, Sparkles } from 'lucide-react';
import type AuthModalComponent from '@/components/AuthModal';
import type MindMapModalComponent from '@/components/MindMapModal';
import type FlashcardsModalComponent from '@/components/FlashcardsModal';
import type { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import ShareLinkDialog from '@/components/ShareLinkDialog';

type AuthModalProps = ComponentProps<typeof AuthModalComponent>;
type MindMapModalProps = ComponentProps<typeof MindMapModalComponent>;
type FlashcardsModalProps = ComponentProps<typeof FlashcardsModalComponent>;

const AuthModal = dynamic<AuthModalProps>(() => import('@/components/AuthModal'), { ssr: false });
const MindMapModal = dynamic<MindMapModalProps>(() => import('@/components/MindMapModal'), { ssr: false });
const FlashcardsModal = dynamic<FlashcardsModalProps>(() => import('@/components/FlashcardsModal'), { ssr: false });

const LOW_TEXT_CHAR_THRESHOLD = 40;
const SCANNED_PDF_WARNING = 'We couldn\'t detect much selectable text in your PDF. If it\'s a scanned image, run OCR or upload a text-based copy so the AI can read it.';
const HIGH_DEMAND_WARNING_MESSAGE = 'We are experiencing high demand right now. Please try again in a few minutes.';
const OUT_OF_GENERATIONS_MESSAGE = 'You\'re out of generations for this month. Upgrade your plan so you don\'t lose study momentum before your exam.';

interface GeneratorProps {
  redirectOnAuth?: boolean;
  showTitle?: boolean;
  compact?: boolean;
  modelChoice?: ModelChoice;
  isPaidSubscriber?: boolean;
  onRequireUpgrade?: (reason?: string) => void;
  freeGenerationsRemaining?: number;
}

export default function Generator({
  redirectOnAuth = false,
  showTitle = true,
  compact = false,
  modelChoice = 'fast',
  isPaidSubscriber,
  onRequireUpgrade,
  freeGenerationsRemaining,
}: GeneratorProps) {
  // Enforce a client-side per-file size cap to avoid server 413s (Vercel ~4.5MB)
  const MAX_FILE_BYTES = Math.floor(50 * 1024 * 1024); // 50MB per file when using Supabase Storage
  const [files, setFiles] = useState<File[]>([]);
  const [preParsed, setPreParsed] = useState<{ text: string; images: string[]; rawCharCount?: number } | null>(null);
  const [isPreParsing, setIsPreParsing] = useState(false);
  const lastPreparseKeyRef = useRef<string | null>(null);
  // Cache for file set processing results (keyed by file set combination)
  const processedFileSetsCache = useRef<Map<string, { result: Record<string, unknown>; processedAt: number }>>(new Map());

  // Debug logging in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  const debugLog = useCallback((message: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[FileCache] ${message}`, ...args);
    }
  }, [isDevelopment]);
  const extractErrorMessage = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (typeof record.error === 'string') return record.error;
    }
    return undefined;
  };
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isPaidSubscriberState, setIsPaidSubscriberState] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'mindmap' | 'flashcards'>(() => {
    const intent = getStoredGenerationIntent();
    return intent === 'flashcards' ? 'flashcards' : 'mindmap';
  });
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [flashcardsDeckId, setFlashcardsDeckId] = useState<string | undefined>(undefined);
  const [mindMapId, setMindMapId] = useState<string | null>(null);
  const [mindMapTitle, setMindMapTitle] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<{ id: string; type: 'mindmap' | 'flashcards'; title: string | null } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [allowedNameSizes, setAllowedNameSizes] = useState<{ name: string; size: number }[] | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const router = useRouter();
  const resolvedIsPaidSubscriber = typeof isPaidSubscriber === 'boolean' ? isPaidSubscriber : isPaidSubscriberState;
  const normalizedFreeGenerations =
    !resolvedIsPaidSubscriber && typeof freeGenerationsRemaining === 'number' && Number.isFinite(freeGenerationsRemaining)
      ? Math.max(0, Math.min(FREE_PLAN_GENERATIONS, Math.floor(freeGenerationsRemaining)))
      : null;
  const limitExceededCacheRef = useRef<{
    signature: string;
    preParsed: { text: string; images: string[]; rawCharCount?: number } | null;
    allowedNameSizes: { name: string; size: number }[] | undefined;
    error: string | null;
  } | null>(null);
  const ctaLabel = mode === 'flashcards' ? 'Generate Flashcards' : 'Generate Mind Map';
  const baseCtaTooltip = mode === 'flashcards' ? 'Generate flashcards' : 'Generate mind map';
  const ctaTooltip =
    normalizedFreeGenerations !== null
      ? `${baseCtaTooltip}\n${normalizedFreeGenerations} of ${FREE_PLAN_GENERATIONS} free uses remaining`
      : baseCtaTooltip;
  const isOutOfFreeGenerations = normalizedFreeGenerations === 0 && !resolvedIsPaidSubscriber;

  useEffect(() => {
    const intent = getStoredGenerationIntent();
    if (intent === 'flashcards') {
      setMode('flashcards');
    }
  }, []);

  const evaluateLowTextWarning = useCallback((text: string, rawCharCount: number | undefined, fileList?: File[] | null) => {
    if (!fileList || fileList.length === 0) {
      setUploadWarning(null);
      return;
    }
    const hasPdfUpload = fileList.some((file) => {
      const name = (file.name || '').toLowerCase();
      const type = (file.type || '').toLowerCase();
      return type === 'application/pdf' || name.endsWith('.pdf');
    });
    if (!hasPdfUpload) {
      setUploadWarning(null);
      return;
    }
    const sanitizedText = typeof text === 'string' ? text : '';
    const effectiveCharCount = typeof rawCharCount === 'number' && Number.isFinite(rawCharCount)
      ? rawCharCount
      : sanitizedText.replace(/\s+/g, '').length;
    if (effectiveCharCount < LOW_TEXT_CHAR_THRESHOLD) {
      setUploadWarning(SCANNED_PDF_WARNING);
    } else {
      setUploadWarning(null);
    }
  }, []);

  const showHighDemandWarning = useCallback((rawMessage?: string | null) => {
    const normalized = typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage.trim()
      : HIGH_DEMAND_WARNING_MESSAGE;
    setRateLimitWarning(normalized);
  }, [setRateLimitWarning]);

  type UploadedFileMetadata = {
    bucket: string;
    path: string;
    storageKey: string;
    name: string;
    size: number;
    lastModified: number;
    uploadedAt: number;
  };

  type FileIdentity = {
    signature: string;
    storageKey: string;
    safeName: string;
    lastModified: number;
    contentHash: string;
  };

  const uploadedFilesRef = useRef<Map<string, UploadedFileMetadata>>(new Map());
  const fileIdentityCacheRef = useRef<WeakMap<File, FileIdentity>>(new WeakMap());

  const sanitizeForKey = useCallback((value: string) => value.replace(/[^A-Za-z0-9._-]/g, '_'), []);

  const getFileIdentity = useCallback(async (file: File): Promise<FileIdentity> => {
    const cached = fileIdentityCacheRef.current.get(file);
    if (cached) {
      return cached;
    }

    const safeName = sanitizeForKey(file.name || 'file').slice(0, 50) || 'file';
    const lastModified = typeof file.lastModified === 'number' ? file.lastModified : 0;

    let contentHash = '0';
    let hashInt = 0;
    try {
      const slice = file.slice(0, 512);
      const arrayBuffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let hash = 0;
      for (let i = 0; i < bytes.length; i++) {
        hash = (hash << 5) - hash + bytes[i];
        hash |= 0; // Force 32-bit
      }
      hashInt = hash;
      contentHash = Math.abs(hash).toString(36).slice(0, 8);
    } catch (error) {
      debugLog('Failed to compute file hash, falling back to size-based key', error);
    }

    const signature = `${file.name}::${file.size}::${lastModified}::${contentHash}`;
    let storageKey = `${safeName}_${file.size}_${lastModified}_${contentHash}`;
    storageKey = sanitizeForKey(storageKey);
    if (!storageKey) {
      const fallbackHash = Math.abs(hashInt || 0).toString(36);
      storageKey = `${fallbackHash || 'file'}_${file.size}_${lastModified}`;
    }
    if (storageKey.length > 120) {
      storageKey = storageKey.slice(storageKey.length - 120);
    }

    const identity: FileIdentity = { signature, storageKey, safeName, lastModified, contentHash };
    fileIdentityCacheRef.current.set(file, identity);
    return identity;
  }, [debugLog, sanitizeForKey]);

  const getFileSignature = useCallback(async (file: File) => {
    const identity = await getFileIdentity(file);
    return identity.signature;
  }, [getFileIdentity]);

  const getNameSizeSignature = useCallback(
    (items: { name: string; size: number }[]) =>
      items
        .map((item) => `${item.name}::${item.size}`)
        .sort()
        .join('|'),
    []
  );

  const mergeNameSizeLists = useCallback(
    (
      primary: { name: string; size: number }[] = [],
      secondary: { name: string; size: number }[] = []
    ) => {
      const map = new Map<string, { name: string; size: number }>();
      primary.forEach((item) => {
        map.set(`${item.name}::${item.size}`, item);
      });
      secondary.forEach((item) => {
        const key = `${item.name}::${item.size}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      });
      return Array.from(map.values());
    },
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

  useEffect(() => {
    if (typeof isPaidSubscriber === 'boolean') {
      return;
    }
    if (!userId) {
      setIsPaidSubscriberState(false);
      return;
    }

    let cancelled = false;

    const loadSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setIsPaidSubscriberState(false);
          return;
        }

        const status = data?.status ?? null;
        setIsPaidSubscriberState(status === 'active' || status === 'trialing' || status === 'past_due');
      } catch {
        if (!cancelled) {
          setIsPaidSubscriberState(false);
        }
      }
    };

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [userId, isPaidSubscriber]);

  // Effect to handle preview animation for non-auth users
  useEffect(() => {
    if (!isAuthed && authChecked) {
      const hasInput = files.length > 0 || prompt.trim().length > 0;
      setPreviewLoading(hasInput && !isLoading && !isPreParsing);
    } else {
      setPreviewLoading(false);
    }
  }, [isAuthed, authChecked, files.length, prompt, isLoading, isPreParsing]);


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
  const uploadAndPreparse = useCallback(async (
    selectedFiles: File[],
    onProgress?: (progress?: number) => void,
    options?: { existingRawChars?: number }
  ): Promise<Record<string, unknown>> => {
    if (!selectedFiles || selectedFiles.length === 0) {
      if (onProgress) onProgress(undefined);
      return {};
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fileIdentities = await Promise.all(selectedFiles.map(async (file) => ({ file, ...(await getFileIdentity(file)) })));
    const filesNeedingUpload = fileIdentities.filter(({ signature }) => !uploadedFilesRef.current.has(signature));
    const totalFiles = fileIdentities.length;
    let completed = totalFiles - filesNeedingUpload.length;

    if (onProgress) {
      const initial = totalFiles === 0 ? 100 : Math.round((completed / totalFiles) * 100);
      onProgress(initial);
    }

    const anonId = (typeof window !== 'undefined')
      ? (localStorage.getItem('cogniguide_anon_id') || (() => {
        const v = crypto.randomUUID();
        localStorage.setItem('cogniguide_anon_id', v);
        return v;
      })())
      : undefined;

    let effectiveBucket: string | null = null;

    if (filesNeedingUpload.length > 0) {
      const filesMeta = filesNeedingUpload.map(({ file, storageKey }) => ({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        key: storageKey,
      }));

      const signedRes = await fetch('/api/storage/get-signed-uploads', {
        method: 'POST',
        headers,
        body: JSON.stringify({ files: filesMeta, anonId }),
      });
      if (!signedRes.ok) {
        const j = await signedRes.json().catch(() => null);
        throw new Error(j?.error || 'Failed to prepare uploads');
      }
      const signedPayload = await signedRes.json() as {
        bucket: string;
        items: Array<{ path: string; signedUrl: string }>;
      };
      const { bucket, items } = signedPayload;
      effectiveBucket = bucket;

      for (let i = 0; i < filesNeedingUpload.length; i++) {
        const { file, signature, storageKey } = filesNeedingUpload[i];
        const item = items?.[i];
        if (!item?.signedUrl) {
          throw new Error('Failed to retrieve upload URL.');
        }

        let currentPath = item.path;

        await uploadOneWithRetry(
          file,
          item.signedUrl,
          async () => {
            const refreshRes = await fetch('/api/storage/get-signed-uploads', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                files: [{
                  name: file.name,
                  size: file.size,
                  type: file.type || 'application/octet-stream',
                  key: storageKey,
                }],
                anonId,
              }),
            });
            if (!refreshRes.ok) {
              throw new Error('Failed to refresh upload URL');
            }
            const fresh = await refreshRes.json() as {
              bucket?: string;
              items?: Array<{ path: string; signedUrl: string }>;
            };
            const freshItem = fresh?.items?.[0];
            if (!freshItem?.signedUrl) {
              throw new Error('Failed to refresh upload URL');
            }
            currentPath = freshItem.path;
            effectiveBucket = fresh?.bucket || bucket;
            return freshItem.signedUrl;
          },
          onProgress
            ? (fileProgress) => {
              const aggregate = totalFiles === 0
                ? 100
                : Math.round(((completed + fileProgress / 100) / totalFiles) * 100);
              onProgress(aggregate);
            }
            : undefined
        );

        const meta: UploadedFileMetadata = {
          bucket,
          path: currentPath,
          storageKey,
          name: file.name,
          size: file.size,
          lastModified: typeof file.lastModified === 'number' ? file.lastModified : 0,
          uploadedAt: Date.now(),
        };
        uploadedFilesRef.current.set(signature, meta);
        completed += 1;
        if (onProgress) {
          const aggregate = totalFiles === 0 ? 100 : Math.round((completed / totalFiles) * 100);
          onProgress(aggregate);
        }
      }
    }

    if (!effectiveBucket && fileIdentities.length > 0) {
      const firstMeta = uploadedFilesRef.current.get(fileIdentities[0].signature);
      if (firstMeta) {
        effectiveBucket = firstMeta.bucket;
      }
    }

    if (!effectiveBucket) {
      effectiveBucket = 'uploads';
    }

    if (onProgress && completed >= totalFiles) {
      onProgress(100);
    }

    const objects = fileIdentities.map(({ file, signature }) => {
      const meta = uploadedFilesRef.current.get(signature);
      if (!meta) {
        throw new Error(`Missing upload metadata for ${file.name}`);
      }
      return {
        path: meta.path,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      };
    });

    const bodyPayload: Record<string, unknown> = { bucket: effectiveBucket, objects };
    if (typeof options?.existingRawChars === 'number') {
      bodyPayload.existingRawChars = options.existingRawChars;
    }

    const preRes = await fetch('/api/preparse', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });
    if (!preRes.ok) {
      const j = await preRes.json().catch(() => null);
      throw new Error(j?.error || 'Failed to prepare files.');
    }
    return await preRes.json() as Record<string, unknown>;
  }, [getFileIdentity]);

  const handleFileChange = useCallback(async (selectedFiles: File[]) => {
    // Clear any previous errors when files change
    setError(null);
    setRateLimitWarning(null);
    
    if (!selectedFiles || selectedFiles.length === 0) {
      setFiles([]);
      processedFileSetsCache.current.clear();
      setPreParsed(null);
      lastPreparseKeyRef.current = null;
      limitExceededCacheRef.current = null;
      uploadedFilesRef.current.clear();
      fileIdentityCacheRef.current = new WeakMap();
      setAllowedNameSizes(undefined);
      setUploadWarning(null);
      setRateLimitWarning(null);
      return;
    }

    const incomingSignature = getNameSizeSignature(selectedFiles.map((file) => ({ name: file.name, size: file.size })));
    const cachedLimitExceeded = limitExceededCacheRef.current;
    if (cachedLimitExceeded) {
      if (cachedLimitExceeded.signature === incomingSignature) {
        setFiles(selectedFiles);
        setPreParsed(cachedLimitExceeded.preParsed);
        evaluateLowTextWarning(
          cachedLimitExceeded.preParsed?.text || '',
          cachedLimitExceeded.preParsed?.rawCharCount,
          selectedFiles
        );
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

    const identityList = await Promise.all(selectedFiles.map(async (file) => ({
      file,
      signature: await getFileSignature(file),
    })));
    const activeSignatures = new Set(identityList.map((entry) => entry.signature));
    // Remove metadata for files that are no longer selected
    for (const signature of Array.from(uploadedFilesRef.current.keys())) {
      if (!activeSignatures.has(signature)) {
        uploadedFilesRef.current.delete(signature);
      }
    }

    const previousKey = lastPreparseKeyRef.current;
    setFiles(selectedFiles);
    // Generate a key for the current file set
    const fileSetKey = identityList.map((entry) => entry.signature).sort().join('__');
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
      evaluateLowTextWarning(text, rawCharCount, selectedFiles);

      // Handle cumulative pruning feedback from cached result
      const limitExceeded = Boolean(j?.limitExceeded);
      const includedFiles = Array.isArray(j?.includedFiles) ? j.includedFiles as { name: string; size: number }[] : [];
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

    const previousCacheEntry = previousKey && previousKey !== fileSetKey
      ? processedFileSetsCache.current.get(previousKey)
      : undefined;
    const previousCacheAge = previousCacheEntry ? Date.now() - previousCacheEntry.processedAt : 0;
    const previousCacheValid = Boolean(previousCacheEntry && previousCacheAge < 5 * 60 * 1000);
    const previousSignatures = previousKey
      ? previousKey.split('__').filter((value) => value.length > 0)
      : [];
    const previousSignatureSet = new Set(previousSignatures);
    const canReusePrevious = Boolean(
      previousCacheValid &&
      previousSignatures.length > 0 &&
      previousSignatures.every((sig) => activeSignatures.has(sig))
    );

    const filesToProcess = canReusePrevious
      ? identityList.filter((entry) => !previousSignatureSet.has(entry.signature)).map((entry) => entry.file)
      : selectedFiles;

    if (canReusePrevious) {
      debugLog(
        `Reusing ${previousSignatures.length} cached files from ${previousKey}; processing ${filesToProcess.length} new files.`
      );
    }

    // No valid cache, pre-parse now using Supabase Storage JSON flow (fallback to legacy on failure)
    try {
      setIsPreParsing(true);
      setUploadProgress(0);
      const baseRecord = canReusePrevious ? previousCacheEntry?.result : undefined;
      const baseText = typeof baseRecord?.text === 'string' ? (baseRecord.text as string) : '';
      const baseImages = Array.isArray(baseRecord?.images) ? (baseRecord.images as string[]) : [];
      const baseRawCharCount = typeof baseRecord?.totalRawChars === 'number' ? (baseRecord.totalRawChars as number) : 0;
      const baseMaxChars = typeof baseRecord?.maxChars === 'number' ? (baseRecord.maxChars as number) : undefined;
      const baseIncludedFiles = Array.isArray(baseRecord?.includedFiles)
        ? (baseRecord.includedFiles as { name: string; size: number }[])
        : [];
      const baseExcludedFiles = Array.isArray(baseRecord?.excludedFiles)
        ? (baseRecord.excludedFiles as { name: string; size: number }[])
        : [];
      const basePartialFile =
        baseRecord?.partialFile && typeof baseRecord.partialFile === 'object'
          ? (baseRecord.partialFile as { name: string; size: number; includedChars: number })
          : null;
      const baseLimitExceeded = Boolean(baseRecord?.limitExceeded);
      const baseIsAuthed = Boolean(baseRecord?.isAuthed);

      let j: Record<string, unknown> = {};
      try {
        if (filesToProcess.length > 0) {
          j = await uploadAndPreparse(
            filesToProcess,
            (progress) => {
              setUploadProgress(progress);
            },
            canReusePrevious ? { existingRawChars: baseRawCharCount } : undefined
          );
        }
      } catch (e) {
        // Fallback: legacy small-upload path if JSON/storage fails
        const totalBytes = filesToProcess.reduce((sum, f) => sum + (f.size || 0), 0);
        const reason = extractErrorMessage(e) || 'Unknown error';

        // Check if it's an image-related error and provide more specific guidance
        const hasImages = filesToProcess.some(f => f.type.startsWith('image/'));
        if (hasImages && (reason.toLowerCase().includes('image') || reason.toLowerCase().includes('upload') || reason.toLowerCase().includes('storage'))) {
          setError(`Image upload failed: ${reason}. Please try uploading your images again or use a different image format.`);
          setPreParsed(null);
          setUploadWarning(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }

        if (totalBytes > 4 * 1024 * 1024) {
          setError(`Storage pre-parse failed: ${reason}. Large files cannot be sent directly; please retry later or check storage configuration.`);
          setPreParsed(null);
          setUploadWarning(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }
        const formData = new FormData();
        filesToProcess.forEach((f) => formData.append('files', f));
        if (canReusePrevious) {
          formData.append('existingRawChars', String(baseRawCharCount));
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch('/api/preparse', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (!res.ok) {
          try {
            const jj = await res.json() as Record<string, unknown>;
            const errorMsg = typeof jj?.error === 'string' ? jj.error : 'Failed to prepare files.';
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
          setUploadWarning(null);
          setAllowedNameSizes(undefined);
          setIsPreParsing(false);
          setUploadProgress(undefined);
          return;
        }
        j = await res.json() as Record<string, unknown>;
      }

      const newText = typeof j?.text === 'string' ? (j.text as string) : '';
      const newImages = Array.isArray(j?.images) ? (j.images as string[]) : [];
      const newRawCharCount = typeof j?.totalRawChars === 'number' ? (j.totalRawChars as number) : undefined;
      const newMaxChars = typeof j?.maxChars === 'number' ? (j.maxChars as number) : undefined;
      const newIncludedFiles = Array.isArray(j?.includedFiles)
        ? (j.includedFiles as { name: string; size: number }[])
        : [];
      const newExcludedFiles = Array.isArray(j?.excludedFiles)
        ? (j.excludedFiles as { name: string; size: number }[])
        : [];
      const newPartialFile = j?.partialFile && typeof j.partialFile === 'object'
        ? (j.partialFile as { name: string; size: number; includedChars: number })
        : null;
      const newLimitExceeded = Boolean(j?.limitExceeded);
      const newIsAuthed = typeof j?.isAuthed === 'boolean' ? (j.isAuthed as boolean) : undefined;

      const combinedTextParts = [baseText, newText].filter((part) => part && part.length > 0);
      const combinedText = combinedTextParts.join('\n\n');
      const combinedImages = Array.from(new Set<string>([...baseImages, ...newImages]));
      const combinedRawCharCount = typeof newRawCharCount === 'number' && !Number.isNaN(newRawCharCount)
        ? newRawCharCount
        : baseRawCharCount;
      const combinedMaxChars = typeof newMaxChars === 'number' ? newMaxChars : baseMaxChars;
      const combinedIncludedFiles = mergeNameSizeLists(baseIncludedFiles, newIncludedFiles);
      const combinedExcludedFiles = mergeNameSizeLists(baseExcludedFiles, newExcludedFiles);
      const combinedPartialFile = newPartialFile ?? basePartialFile ?? null;
      const combinedLimitExceeded = baseLimitExceeded || newLimitExceeded;
      const combinedIsAuthed = typeof newIsAuthed === 'boolean' ? newIsAuthed : baseIsAuthed;

      const combinedResult: Record<string, unknown> = {
        text: combinedText,
        images: combinedImages,
        totalRawChars: combinedRawCharCount,
        maxChars: combinedMaxChars,
        limitExceeded: combinedLimitExceeded,
        includedFiles: combinedIncludedFiles,
        excludedFiles: combinedExcludedFiles,
        partialFile: combinedPartialFile ?? null,
        isAuthed: combinedIsAuthed,
      };

      // Cache the complete result for this file set
      processedFileSetsCache.current.set(fileSetKey, {
        result: combinedResult,
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

      const rawCharCount = combinedRawCharCount;
      setPreParsed({ text: combinedText, images: combinedImages, rawCharCount });
      evaluateLowTextWarning(combinedText, rawCharCount, selectedFiles);

      // Handle cumulative pruning feedback
      const limitExceeded = combinedLimitExceeded;
      const includedFiles = combinedIncludedFiles;
      const includedSignature = getNameSizeSignature(includedFiles);
      if (limitExceeded) {
        const truncationError = (combinedIsAuthed || isAuthed)
          ? 'Content exceeds the length limit for your current plan. the content has been truncated.'
          : null;
        setAllowedNameSizes(includedFiles);
        setError(truncationError);
        limitExceededCacheRef.current = {
          signature: includedSignature,
          preParsed: { text: combinedText, images: combinedImages, rawCharCount },
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
  }, [getFileSignature, debugLog, MAX_FILE_BYTES, isAuthed, uploadAndPreparse, getNameSizeSignature, mergeNameSizeLists, evaluateLowTextWarning]);

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
    setShareItem(null);
    setRateLimitWarning(null);
    if (mode === 'flashcards') {
      const hasFiles = files.length > 0;
      // Require either files or a prompt topic for flashcards generation
      if (!hasFiles && !trimmedPrompt) {
        setError('Please upload at least one file or enter a topic to generate flashcards.');
        return;
      }

      if (isOutOfFreeGenerations) {
        setError(OUT_OF_GENERATIONS_MESSAGE);
        return;
      }

      // Only clear error and start loading if we pass the validation checks
      setIsLoading(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);
      setFlashcardsDeckId(undefined);

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
              evaluateLowTextWarning(effectivePreParsed.text || '', effectivePreParsed.rawCharCount, files);
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
          try {
            const j = await res.json() as Record<string, unknown>;
            if (typeof j?.code === 'string' && j.code === 'FREE_GENERATION_LIMIT_REACHED') {
              msg = typeof j?.message === 'string' ? j.message : 'Monthly generation limit reached. Upgrade to keep creating more.';
            } else if (typeof j?.error === 'string') {
              msg = j.error;
            }
          } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (res.status === 429) {
            let warningMsg = HIGH_DEMAND_WARNING_MESSAGE;
            if (contentType.includes('application/json')) {
              try {
                const j = await res.json() as Record<string, unknown>;
                if (typeof j?.message === 'string' && j.message.trim()) {
                  warningMsg = j.message.trim();
                } else if (typeof j?.error === 'string' && j.error.trim()) {
                  warningMsg = j.error.trim();
                }
              } catch {}
            } else {
              try {
                const text = (await res.text()).trim();
                if (text) warningMsg = text;
              } catch {}
            }
            showHighDemandWarning(warningMsg);
            setError(null);
            return;
          }
          if (contentType.includes('application/json')) {
            let errorMsg = 'Failed to generate flashcards.';
            try {
              const j = await res.json() as Record<string, unknown>;
              if (typeof j?.error === 'string') errorMsg = j.error;
            } catch {}
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
          const data = await res.json().catch(() => null) as Record<string, unknown> | null;
          const rawCards = Array.isArray(data?.['cards']) ? data?.['cards'] : [];
          const cards = Array.isArray(rawCards) ? (rawCards as FlashcardType[]) : [];
          if (cards.length === 0) throw new Error('No cards generated');
          setFlashcardsCards(cards);
          setFlashcardsTitle(typeof data?.['title'] === 'string' ? (data['title'] as string) : null);
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards })
                .select('id')
                .single();
              if (!insErr) {
                const inserted = (ins ?? null) as Record<string, unknown> | null;
                const insertedId = inserted && typeof inserted['id'] === 'string' ? inserted['id'] : null;
                if (insertedId) {
                  setFlashcardsDeckId(insertedId);
                  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
                }
              }
            } catch {}
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let streamedTitle: string | null = null;
          const accumulated: FlashcardType[] = [];
          while (true) {
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
              if (!insErr) {
                const inserted = (ins ?? null) as Record<string, unknown> | null;
                const insertedId = inserted && typeof inserted['id'] === 'string' ? inserted['id'] : null;
                if (insertedId) {
                  setFlashcardsDeckId(insertedId);
                  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
                }
              }
            } catch {}
          }
        }

        // No longer require sign-in after successful generation
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate flashcards.';
        const normalized = errorMessage.toLowerCase();
        if (normalized.includes('rate limit') || normalized.includes('high demand')) {
          showHighDemandWarning(errorMessage);
          setError(null);
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (files.length === 0 && !trimmedPrompt) {
      setError('Please upload at least one file or enter a text prompt to generate a mind map.');
      return;
    }

    if (isOutOfFreeGenerations) {
      setError(OUT_OF_GENERATIONS_MESSAGE);
      return;
    }

    // Only clear error and start loading if we pass the validation checks
    setMindMapId(null);
    setMindMapTitle(null);
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
          evaluateLowTextWarning(effectivePreParsed.text || '', effectivePreParsed.rawCharCount, files);
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
      if (response.status === 402) {
        let msg = 'Insufficient credits. Upload a smaller file or upgrade your plan.';
        try {
          const j = await response.json() as Record<string, unknown>;
          if (typeof j?.code === 'string' && j.code === 'FREE_GENERATION_LIMIT_REACHED') {
            msg = typeof j?.message === 'string' ? j.message : 'Monthly generation limit reached. Upgrade to keep creating more.';
          } else if (typeof j?.error === 'string') {
            msg = j.error;
          }
        } catch {}
        setError(msg);
        setIsLoading(false);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        if (response.status === 429) {
          let warningMsg = HIGH_DEMAND_WARNING_MESSAGE;
          if (contentType.includes('application/json')) {
            try {
              const j = await response.json();
              if (typeof j?.message === 'string' && j.message.trim()) {
                warningMsg = j.message.trim();
              } else if (typeof j?.error === 'string' && j.error.trim()) {
                warningMsg = j.error.trim();
              }
            } catch {}
          } else {
            try {
              const text = (await response.text()).trim();
              if (text) warningMsg = text;
            } catch {}
          }
          showHighDemandWarning(warningMsg);
          setError(null);
          return;
        }
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
          setMindMapTitle(title);
          try {
            const { data: insertData, error: insertError } = await supabase
              .from('mindmaps')
              .insert({ user_id: userId, title, markdown: md })
              .select('id, title')
              .single();
            if (!insertError && insertData) {
              const insertedId = typeof insertData.id === 'string' ? insertData.id : null;
              if (insertedId) {
                setMindMapId(insertedId);
              }
              const insertedTitle = typeof insertData.title === 'string' ? insertData.title : null;
              if (insertedTitle) {
                setMindMapTitle(insertedTitle);
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
              }
            }
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
        setMindMapTitle(title);
        try {
          const { data: insertData, error: insertError } = await supabase
            .from('mindmaps')
            .insert({ user_id: userId, title, markdown: md })
            .select('id, title')
            .single();
          if (!insertError && insertData) {
            const insertedId = typeof insertData.id === 'string' ? insertData.id : null;
            if (insertedId) {
              setMindMapId(insertedId);
            }
            const insertedTitle = typeof insertData.title === 'string' ? insertData.title : null;
            if (insertedTitle) {
              setMindMapTitle(insertedTitle);
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('cogniguide:generation-complete'));
            }
          }
        } catch {}
      }
      // Mindmap stream completion event (stream path)
      try { if (typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('cogniguide:mindmap-stream-complete')), 0); } catch {}
      // No longer require sign-in after successful generation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map.';
      const normalized = errorMessage.toLowerCase();
      if (normalized.includes('rate limit') || normalized.includes('high demand')) {
        showHighDemandWarning(errorMessage);
        setError(null);
      } else {
        setError(errorMessage);
      }
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
  const warningMessages = [uploadWarning, rateLimitWarning].filter((warning): warning is string => Boolean(warning));

  return (
    <>
      <MindMapModal
        markdown={markdown}
        onClose={handleCloseModal}
        isPaidUser={resolvedIsPaidSubscriber}
        onRequireUpgrade={onRequireUpgrade ?? handleUpgradeClick}
        onShareMindMap={mindMapId ? () => setShareItem({ id: mindMapId, type: 'mindmap', title: mindMapTitle ?? null }) : undefined}
      />
      <FlashcardsModal
        open={flashcardsOpen}
        title={flashcardsTitle}
        cards={flashcardsCards}
        isGenerating={isLoading && mode === 'flashcards'}
        error={flashcardsError}
        onClose={handleCloseFlashcards}
        deckId={flashcardsDeckId}
        isPaidUser={resolvedIsPaidSubscriber}
        onRequireUpgrade={onRequireUpgrade ?? handleUpgradeClick}
        mindMapModelChoice={modelChoice}
        onShare={flashcardsDeckId ? () => setShareItem({ id: flashcardsDeckId, type: 'flashcards', title: flashcardsTitle ?? null }) : undefined}
      />
      <ShareLinkDialog
        open={Boolean(shareItem?.id)}
        onClose={() => setShareItem(null)}
        resourceId={shareItem?.id ?? null}
        resourceType={shareItem?.type ?? 'mindmap'}
        resourceTitle={shareItem?.title ?? null}
      />
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
                onFileRemove={async (file) => {
                  try {
                    const identity = await getFileIdentity(file);
                    uploadedFilesRef.current.delete(identity.signature);
                    fileIdentityCacheRef.current.delete(file);
                  } catch (err) {
                    debugLog('Failed to remove file identity on delete', err);
                  }
                  // Reset upload states when a file is removed during upload
                  setIsPreParsing(false);
                  setUploadProgress(undefined);
                  // Clear any cached pre-parsed results since file set changed
                  setPreParsed(null);
                  setUploadWarning(null);
                  setRateLimitWarning(null);
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
                ctaLabel={ctaLabel}
                ctaTooltip={ctaTooltip}
                mode={mode}
                previewLoading={previewLoading}
                onInteract={() => {
                  if (!authChecked) return;
                  if (!isAuthed) setShowAuth(true);
                }}
              />
              {warningMessages.map((message, index) => (
                <div key={`warning-${index}-${message.slice(0, 12)}`} className={index === 0 ? 'mt-4' : 'mt-2'}>
                  <div className="flex items-start gap-3 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-left text-sm text-amber-900">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                    <p className="font-medium leading-snug">{message}</p>
                  </div>
                </div>
              ))}
              {error && (
                <div className="mt-4">
                  {typeof error === 'string'
                    ? (() => {
                        if (error === requireAuthErrorMessage) {
                          return (
                            <div className="rounded-[1.25rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm text-primary">
                              <div className="flex items-start gap-3">
                                <Sparkles className="h-5 w-5 flex-shrink-0 text-primary" />
                                <p className="font-medium leading-snug">
                                  Please{' '}
                                  <button
                                    type="button"
                                    onClick={() => setShowAuth(true)}
                                    className="underline hover:no-underline font-semibold text-primary"
                                    title="Open sign up modal"
                                  >
                                    sign up
                                  </button>{' '}
                                  to generate with CogniGuide.
                                </p>
                              </div>
                            </div>
                          );
                        }

                        const lower = error.toLowerCase();
                        const upgradeRelated =
                          lower.includes('insufficient credits') ||
                          lower.includes('generation limit') ||
                          lower.includes('monthly generation') ||
                          lower.includes('out of generations') ||
                          lower.includes('generations for this month');
                        if (upgradeRelated) {
                          return (
                            <div className="rounded-[1.25rem] border border-primary/30 bg-primary/10 px-4 py-4 text-sm text-primary">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <Sparkles className="h-5 w-5 flex-shrink-0 text-primary" />
                                  <p className="font-medium leading-snug">{error}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleUpgradeClick}
                                  className="inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 whitespace-nowrap"
                                >
                                  <Sparkles className="h-4 w-4" />
                                  <span>Upgrade your plan</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-[1.25rem] border border-rose-200/80 bg-rose-50/80 px-4 py-4 text-sm text-rose-900">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
                              <p className="font-medium leading-snug">{error}</p>
                            </div>
                          </div>
                        );
                      })()
                    : (
                        <div className="rounded-[1.25rem] border border-rose-200/80 bg-rose-50/80 px-4 py-4 text-sm text-rose-900">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
                            <p className="font-medium leading-snug">{String(error)}</p>
                          </div>
                        </div>
                      )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
