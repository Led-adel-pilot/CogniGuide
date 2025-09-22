import { createHmac, timingSafeEqual } from 'crypto';

export type ShareableResourceType = 'mindmap' | 'flashcards';

interface SharePayload {
  type: ShareableResourceType;
  id: string;
}

function getSecret(): string {
  const secret = process.env.SHARE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Share link secret is not configured. Set SHARE_LINK_SECRET or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return secret;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function signPayload(payload: string): Buffer {
  const secret = getSecret();
  return createHmac('sha256', secret).update(payload).digest();
}

export function createShareToken(type: ShareableResourceType, id: string): string {
  if (!id) {
    throw new Error('Cannot create share token without an id.');
  }
  const payload: SharePayload = { type, id };
  const payloadBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
  const payloadEncoded = base64UrlEncode(payloadBuffer);
  const signature = signPayload(payloadEncoded);
  const signatureEncoded = base64UrlEncode(signature);
  return `${payloadEncoded}.${signatureEncoded}`;
}

export function verifyShareToken(token: string): SharePayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, signatureEncoded] = parts;
  if (!payloadEncoded || !signatureEncoded) return null;

  try {
    const expectedSignature = signPayload(payloadEncoded);
    const providedSignature = base64UrlDecode(signatureEncoded);
    if (expectedSignature.length !== providedSignature.length) return null;
    if (!timingSafeEqual(expectedSignature, providedSignature)) return null;

    const payloadBuffer = base64UrlDecode(payloadEncoded);
    const payloadJson = payloadBuffer.toString('utf8');
    const parsed = JSON.parse(payloadJson) as Partial<SharePayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    const { type, id } = parsed;
    if ((type !== 'mindmap' && type !== 'flashcards') || typeof id !== 'string' || !id) {
      return null;
    }
    return { type, id };
  } catch (error) {
    console.error('Failed to verify share token:', error);
    return null;
  }
}
