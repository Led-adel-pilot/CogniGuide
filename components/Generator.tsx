'use client';

import { useState, useEffect, useCallback, useRef, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import posthog from 'posthog-js';
import Dropzone, { getDropzoneFileKey } from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import { supabase } from '@/lib/supabaseClient';
import { FREE_PLAN_GENERATIONS, type ModelChoice } from '@/lib/plans';
import { getStoredGenerationIntent, rememberGenerationIntent, type GenerationIntent } from '@/lib/generationIntent';
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
  // Cache for individual file processing results (keyed by file signature)
  const processedFilesCache = useRef<Map<string, { result: Record<string, unknown>; processedAt: number }>>(new Map());
  const pendingOnboardingFilesRef = useRef<File[] | null>(null);
  const pendingOnboardingAutoSubmitRef = useRef(false);

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
  const initialStoredIntentRef = useRef<GenerationIntent | null>(getStoredGenerationIntent());
  const [mode, setMode] = useState<GenerationIntent>(() => initialStoredIntentRef.current ?? 'mindmap');
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
  const [uploadProgress, setUploadProgress] = useState<Record<string, number> | undefined>(undefined);
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
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
  const serverIntentHydratedRef = useRef(false);
  const serverIntentHydratingRef = useRef(false);

  useEffect(() => {
    const hasStored = Boolean(initialStoredIntentRef.current);
    const hydrationDone = serverIntentHydratedRef.current;
    const isDefaultMindmap = mode === 'mindmap' && !hasStored && !hydrationDone;
    if (isDefaultMindmap) return;
    rememberGenerationIntent(mode);
  }, [mode]);

  useEffect(() => {
    const hydrateIntentFromServer = async () => {
      if (!authChecked || !isAuthed || !userId || serverIntentHydratedRef.current || serverIntentHydratingRef.current) return;
      if (getStoredGenerationIntent()) return;
      serverIntentHydratingRef.current = true;

      try {
        const [{ data: latestMindmap }, { data: latestFlashcards }] = await Promise.all([
          supabase
            .from('mindmaps')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('flashcards')
            .select('created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const mindmapTime = latestMindmap?.created_at ? new Date(latestMindmap.created_at).getTime() : null;
        const flashcardsTime = latestFlashcards?.created_at ? new Date(latestFlashcards.created_at).getTime() : null;

        let nextMode: GenerationIntent | null = null;
        if (mindmapTime !== null && flashcardsTime !== null) {
          nextMode = mindmapTime >= flashcardsTime ? 'mindmap' : 'flashcards';
        } else if (mindmapTime !== null) {
          nextMode = 'mindmap';
        } else if (flashcardsTime !== null) {
          nextMode = 'flashcards';
        }

        if (nextMode && !getStoredGenerationIntent()) {
          setMode(nextMode);
          rememberGenerationIntent(nextMode);
        }

        serverIntentHydratedRef.current = true;
      } catch (error) {
        serverIntentHydratedRef.current = false;
        console.error('Failed to hydrate generation intent from server:', error);
      } finally {
        serverIntentHydratingRef.current = false;
      }
    };

    hydrateIntentFromServer();
  }, [authChecked, isAuthed, userId]);

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
    onProgress?: (file: File, progress: number) => void,
    onFileProcessed?: (file: File, result: Record<string, unknown>) => void,
    options?: { existingRawChars?: number }
  ): Promise<Record<string, unknown>> => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return {};
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fileIdentities = await Promise.all(selectedFiles.map(async (file) => ({ file, ...(await getFileIdentity(file)) })));
    
    // Files that need parsing (not in cache)
    const filesNeedingParse = fileIdentities.filter(({ signature }) => !processedFilesCache.current.has(signature));
    
    // Of those, which need uploading?
    const filesNeedingUpload = filesNeedingParse.filter(({ signature }) => !uploadedFilesRef.current.has(signature));
    
    // Initialize progress for files we are about to process
    if (onProgress) {
        filesNeedingParse.forEach(({ file, signature }) => {
             // If already uploaded but just needing parse, show 100% upload
            if (uploadedFilesRef.current.has(signature)) {
                onProgress(file, 100);
            } else {
                onProgress(file, 0);
            }
        });
    }

    const anonId = (typeof window !== 'undefined')
      ? (localStorage.getItem('cogniguide_anon_id') || (() => {
        const v = crypto.randomUUID();
        localStorage.setItem('cogniguide_anon_id', v);
        return v;
      })())
      : undefined;

    let effectiveBucket: string | null = null;

    // Batch get signed URLs for those needing upload
    let signedItems: Array<{ path: string; signedUrl: string }> = [];
    
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
      effectiveBucket = signedPayload.bucket;
      signedItems = signedPayload.items;
    } else if (filesNeedingParse.length > 0) {
         // If we don't need to upload, we still need the bucket name to call preparse
         // Try to find it from uploadedFilesRef
         const sig = filesNeedingParse[0].signature;
         const existing = uploadedFilesRef.current.get(sig);
         effectiveBucket = existing?.bucket || 'uploads';
    }

    // Parallel Process (Upload if needed -> Preparse)
    await Promise.all(filesNeedingParse.map(async ({ file, signature, storageKey }) => {
        let currentPath: string | undefined;
        
        // Check if we need to upload this specific file
        const uploadIndex = filesNeedingUpload.findIndex(f => f.signature === signature);
        if (uploadIndex >= 0) {
             const item = signedItems[uploadIndex];
             if (!item?.signedUrl) throw new Error('Failed to retrieve upload URL.');
             currentPath = item.path;
             
             // Upload
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
                if (!refreshRes.ok) throw new Error('Failed to refresh upload URL');
                const fresh = await refreshRes.json();
                const freshItem = fresh?.items?.[0];
                if (!freshItem?.signedUrl) throw new Error('Failed to refresh upload URL');
                currentPath = freshItem.path;
                return freshItem.signedUrl;
              },
              onProgress ? (p) => onProgress(file, p) : undefined
            );
            
            const meta: UploadedFileMetadata = {
              bucket: effectiveBucket!,
              path: currentPath,
              storageKey,
              name: file.name,
              size: file.size,
              lastModified: typeof file.lastModified === 'number' ? file.lastModified : 0,
              uploadedAt: Date.now(),
            };
            uploadedFilesRef.current.set(signature, meta);
            if (onProgress) onProgress(file, 100);
        } else {
            // Already uploaded
            const meta = uploadedFilesRef.current.get(signature);
            if (!meta) throw new Error(`Missing upload metadata for ${file.name}`);
            currentPath = meta.path;
            effectiveBucket = meta.bucket;
        }

        // Individual Preparse
        const preRes = await fetch('/api/preparse', {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
                bucket: effectiveBucket, 
                objects: [{ path: currentPath, name: file.name, type: file.type, size: file.size }] 
            }),
        });
        if (!preRes.ok) {
             const j = await preRes.json().catch(() => null);
             throw new Error(j?.error || `Failed to process ${file.name}`);
        }
        const result = await preRes.json() as Record<string, unknown>;
        
        // Cache individual result
        processedFilesCache.current.set(signature, { result, processedAt: Date.now() });
        
        if (onFileProcessed) {
            onFileProcessed(file, result);
        }
    }));

    // Aggregate results from cache for all selected files
    const combinedResult: Record<string, unknown> = {
        text: '',
        images: [],
        totalRawChars: 0,
        isAuthed: false,
        includedFiles: [],
        limitExceeded: false
    };
    
    const allTexts: string[] = [];
    const allImages: string[] = [];
    let totalChars = 0;
    const incFiles: any[] = [];

    for (const { signature, file } of fileIdentities) {
        const cached = processedFilesCache.current.get(signature);
        if (cached) {
            const r = cached.result;
            if (typeof r.text === 'string') allTexts.push(r.text);
            if (Array.isArray(r.images)) allImages.push(...r.images);
            if (typeof r.totalRawChars === 'number') totalChars += r.totalRawChars;
            if (r.isAuthed) combinedResult.isAuthed = true;
            if (r.limitExceeded) combinedResult.limitExceeded = true;
            incFiles.push({ name: file.name, size: file.size });
        }
    }

    combinedResult.text = allTexts.join('\n\n');
    combinedResult.images = Array.from(new Set(allImages));
    combinedResult.totalRawChars = totalChars;
    combinedResult.includedFiles = incFiles;

    return combinedResult;
  }, [getFileIdentity]);

  const handleFileChange = useCallback(async (selectedFiles: File[]) => {
    // Clear any previous errors when files change
    setError(null);
    setRateLimitWarning(null);
    
    if (!selectedFiles || selectedFiles.length === 0) {
      setFiles([]);
      setPreParsed(null);
      lastPreparseKeyRef.current = null;
      limitExceededCacheRef.current = null;
      uploadedFilesRef.current.clear();
      fileIdentityCacheRef.current = new WeakMap();
      setAllowedNameSizes(undefined);
      setUploadWarning(null);
      setRateLimitWarning(null);
      setCompletedKeys(new Set());
      return;
    }

    // Validate file sizes before accepting them (50MB when using Supabase Storage)
    const tooLargeFile = selectedFiles.find(f => f.size > MAX_FILE_BYTES);
    if (tooLargeFile) {
      setError(`"${tooLargeFile.name}" is too large. Max file size is ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(1)} MB.`);
      return; // Don't update files state
    }

    setFiles(selectedFiles);

    // Log image files for debugging
    const imageFiles = selectedFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      debugLog(`Processing ${imageFiles.length} image files:`, imageFiles.map(f => `${f.name} (${f.type})`));
    }

    // Helper to re-aggregate state from cache for the current file selection
    const updateStateFromCache = async () => {
        const fileIdentities = await Promise.all(selectedFiles.map(async (file) => ({ file, ...(await getFileIdentity(file)) })));
        const allTexts: string[] = [];
        const allImages: string[] = [];
        let totalChars = 0;
        let isAuthedResult = false;
        let limitExceeded = false;
        const incFiles: any[] = [];
        const newCompletedKeys = new Set<string>();

        for (const { signature, file } of fileIdentities) {
            const cached = processedFilesCache.current.get(signature);
            if (cached) {
                const r = cached.result;
                if (typeof r.text === 'string') allTexts.push(r.text);
                if (Array.isArray(r.images)) allImages.push(...r.images);
                if (typeof r.totalRawChars === 'number') totalChars += r.totalRawChars;
                if (r.isAuthed) isAuthedResult = true;
                if (r.limitExceeded) limitExceeded = true;
                incFiles.push({ name: file.name, size: file.size });
                newCompletedKeys.add(getDropzoneFileKey(file));
            }
        }
        setCompletedKeys(newCompletedKeys);
        
        const combinedText = allTexts.join('\n\n');
        const combinedImages = Array.from(new Set(allImages));
        
        setPreParsed({ text: combinedText, images: combinedImages, rawCharCount: totalChars });
        evaluateLowTextWarning(combinedText, totalChars, selectedFiles);
        
        if (limitExceeded) {
             const truncationError = (isAuthedResult || isAuthed)
              ? 'Content exceeds the length limit for your current plan. the content has been truncated.'
              : null;
            setAllowedNameSizes(incFiles);
            setError(truncationError);
        } else {
            setAllowedNameSizes(undefined);
        }
    };

    // Initial check: maybe everything is already cached?
    await updateStateFromCache();

    try {
      setIsPreParsing(true);
      
      const j = await uploadAndPreparse(
        selectedFiles,
        (file, progress) => {
             setUploadProgress(prev => ({ ...(prev || {}), [getDropzoneFileKey(file)]: progress }));
        },
        (file, result) => {
             // Incremental update when a single file is done
             void updateStateFromCache();
        }
      );
      
      // Final consistency check
      await updateStateFromCache();

    } catch(e) {
      if (e instanceof Error) setError(`Pre-parse failed: ${e.message}`);
      // Non-fatal
    } finally {
      setIsPreParsing(false);
      setUploadProgress(undefined);
    }
  }, [getFileIdentity, debugLog, MAX_FILE_BYTES, isAuthed, uploadAndPreparse, evaluateLowTextWarning]);

  const requireAuthErrorMessage = 'Please sign up to generate with CogniGuide.';

  // Bridge onboarding modal dropzone files into the main generator flow
  useEffect(() => {
    const tryProcessOnboardingFiles = async (files: File[], options?: { autoSubmit?: boolean }) => {
      const wantsAutoSubmit = Boolean(options?.autoSubmit);
      pendingOnboardingFilesRef.current = files;
      if (wantsAutoSubmit) {
        pendingOnboardingAutoSubmitRef.current = true;
      }
      if (isLoading || markdown !== null || flashcardsOpen) return;
      if (!authChecked) return;
      if (!isAuthed) {
        setShowAuth(true);
        return;
      }
      try {
        await handleFileChange(files);
      } finally {
        if (pendingOnboardingFilesRef.current === files) {
          pendingOnboardingFilesRef.current = null;
        }
      }
    };

    const handleOnboardingFiles = (event: Event) => {
      const detail = (event as CustomEvent<{ files?: File[]; autoSubmit?: boolean }>).detail;
      const incomingFiles = detail?.files;
      if (!incomingFiles || incomingFiles.length === 0) return;
      void tryProcessOnboardingFiles(incomingFiles, { autoSubmit: detail?.autoSubmit });
    };

    const handleOnboardingAutoSubmit = () => {
      pendingOnboardingAutoSubmitRef.current = true;
      if (authChecked && !isAuthed) {
        setShowAuth(true);
      }
    };

    if (typeof window !== 'undefined') {
      (window as any).__cogniguide_onboarding_files = tryProcessOnboardingFiles;
      window.addEventListener('cogniguide:onboarding-files', handleOnboardingFiles as EventListener);
      window.addEventListener('cogniguide:onboarding-auto-submit', handleOnboardingAutoSubmit as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        if ((window as any).__cogniguide_onboarding_files) {
          delete (window as any).__cogniguide_onboarding_files;
        }
        window.removeEventListener('cogniguide:onboarding-files', handleOnboardingFiles as EventListener);
        window.removeEventListener('cogniguide:onboarding-auto-submit', handleOnboardingAutoSubmit as EventListener);
      }
    };
  }, [authChecked, flashcardsOpen, handleFileChange, isAuthed, isLoading, markdown]);

  useEffect(() => {
    const pendingFiles = pendingOnboardingFilesRef.current;
    if (!pendingFiles || pendingFiles.length === 0) return;
    if (isLoading || markdown !== null || flashcardsOpen) return;
    if (!authChecked) return;
    if (!isAuthed) {
      setShowAuth(true);
      return;
    }
    (async () => {
      try {
        await handleFileChange(pendingFiles);
      } finally {
        if (pendingOnboardingFilesRef.current === pendingFiles) {
          pendingOnboardingFilesRef.current = null;
        }
      }
    })();
  }, [authChecked, flashcardsOpen, handleFileChange, isAuthed, isLoading, markdown]);

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
              setUploadProgress({});
              const j = await uploadAndPreparse(files, (file, progress) => {
                setUploadProgress(prev => ({ ...(prev || {}), [getDropzoneFileKey(file)]: progress }));
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
          setUploadProgress({});
          const j = await uploadAndPreparse(files, (file, progress) => {
            setUploadProgress(prev => ({ ...(prev || {}), [getDropzoneFileKey(file)]: progress }));
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

  // Auto-start generation when onboarding sends input
  useEffect(() => {
    if (!pendingOnboardingAutoSubmitRef.current) return;
    if (!authChecked) return;
    if (!isAuthed) {
      setShowAuth(true);
      return;
    }
    if (isLoading || isPreParsing || flashcardsOpen || markdown !== null) return;
    const hasInput = files.length > 0 || prompt.trim().length > 0;
    if (!hasInput) return;
    pendingOnboardingAutoSubmitRef.current = false;
    void handleSubmit();
  }, [authChecked, files.length, flashcardsOpen, handleSubmit, isAuthed, isLoading, isPreParsing, markdown, prompt]);
  useEffect(() => {
    if (isLoading) {
      pendingOnboardingAutoSubmitRef.current = false;
    }
  }, [isLoading]);

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
        <div className="container px-0 sm:px-6 lg:px-8">
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
                    type="button"
                    data-mode="mindmap"
                    onClick={() => {
                      posthog.capture('generation_mode_changed', { new_mode: 'mindmap' });
                      setMode('mindmap');
                    }}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${mode==='mindmap' ? 'bg-background text-primary shadow' : 'text-muted-foreground hover:text-primary'}`}
                  >Mind Map</button>
                  <button
                    type="button"
                    data-mode="flashcards"
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
                completedKeys={completedKeys}
                allowedNameSizes={allowedNameSizes}
                size={compact ? 'compact' : 'default'}
                externalFiles={files}
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
