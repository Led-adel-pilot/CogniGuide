'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Copy, Check, Link2, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';

type ShareableType = 'mindmap' | 'flashcards';

type ShareLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  resourceId: string | null;
  resourceType: ShareableType;
  resourceTitle?: string | null;
};

const shareLinkCache = new Map<string, string>();

const buildShareUrl = (token: string | null | undefined, type: ShareableType): string | null => {
  if (!token || typeof token !== 'string' || token.length === 0) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (origin) {
    return `${origin.replace(/\/$/, '')}/share/${type}/${token}`;
  }
  return `/share/${type}/${token}`;
};

export default function ShareLinkDialog({
  open,
  onClose,
  resourceId,
  resourceType,
  resourceTitle,
}: ShareLinkDialogProps) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const cacheKey = resourceId ? `${resourceType}:${resourceId}` : null;
    const cached = cacheKey ? shareLinkCache.get(cacheKey) ?? null : null;
    setShareLink(cached);
    setError(null);
    setCopied(false);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
  }, [open, resourceId, resourceType]);

  useEffect(() => {
    setIsMounted(true);
    if (typeof document !== 'undefined') {
      const target = document.getElementById('modal-root') ?? document.body;
      setPortalTarget(target);
    }
    return () => {
      setIsMounted(false);
      setPortalTarget(null);
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = null;
      }
    };
  }, []);

  const canCreateLink = Boolean(resourceId) && !isLoading;

  const titleText = useMemo(() => {
    if (resourceType === 'mindmap') return 'Mind Map';
    if (resourceType === 'flashcards') return 'Flashcards';
    return 'Resource';
  }, [resourceType]);

  const handleCopySuccessFlag = useCallback(() => {
    setCopied(true);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleAction = useCallback(async () => {
    if (shareLink) {
      const success = await copyTextToClipboard(shareLink);
      if (success) {
        handleCopySuccessFlag();
      }
      return;
    }

    if (!resourceId || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/api/share-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ itemId: resourceId, itemType: resourceType }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to create share link.');
      }
      const link =
        (typeof result.url === 'string' && result.url.length > 0
          ? result.url
          : buildShareUrl(result.token, resourceType)) ?? null;
      if (!link) {
        throw new Error('Share link did not return a valid URL.');
      }
      const cacheKey = `${resourceType}:${resourceId}`;
      shareLinkCache.set(cacheKey, link);
      setShareLink(link);
      const success = await copyTextToClipboard(link);
      if (success) {
        handleCopySuccessFlag();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create share link.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [handleCopySuccessFlag, isLoading, resourceId, resourceType, shareLink]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const content = (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[2147483647] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="relative bg-background rounded-[1.5rem] p-6 w-full max-w-md border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted/60"
          aria-label="Close share dialog"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-1">
          <h2 className="text-lg font-bold">
            Share public link to {titleText}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Anyone with the link can view this {resourceType === 'mindmap' ? 'mind map' : 'flashcard deck'}{resourceTitle ? ` (${resourceTitle})` : ''}.
        </p>
        {error ? <div className="mb-3 text-sm text-red-600">{error}</div> : null}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 rounded-3xl border border-border/40 bg-background p-2 shadow-inner focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-0">
            <input
              value={shareLink ?? ''}
              readOnly
              placeholder="https://cogniguide.app/share/…"
              className="flex-1 border-none bg-transparent px-4 py-3 text-sm font-medium text-foreground outline-none focus:ring-0"
              aria-label="Share link"
            />
            <button
              type="button"
              onClick={handleAction}
              disabled={!canCreateLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:rounded-full sm:mr-1 sm:my-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : shareLink ? (
                copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              <span>
                {isLoading
                  ? 'Creating…'
                  : shareLink
                    ? copied
                      ? 'Copied!'
                      : 'Copy link'
                    : 'Create link'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!open || !isMounted || !portalTarget) {
    return null;
  }

  return createPortal(content, portalTarget);
}
