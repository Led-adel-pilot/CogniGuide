const CG_COOKIE_PREFIX = 'cg_authed=';
const SUPABASE_COOKIE_REGEX = /^sb-[^=]+-auth-token=/;

export function readSignedInFromCookies(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const cookies = document.cookie.split(';');
  let cgValue: string | null = null;
  let hasSupabaseSession = false;

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (!cookie) continue;

    if (cookie.startsWith(CG_COOKIE_PREFIX)) {
      cgValue = cookie.slice(CG_COOKIE_PREFIX.length);
      continue;
    }

    if (SUPABASE_COOKIE_REGEX.test(cookie)) {
      hasSupabaseSession = true;
    }
  }

  if (cgValue !== null && cgValue === '1') {
    return true;
  }

  if (hasSupabaseSession) {
    return true;
  }

  // Check LocalStorage for Supabase session
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
        return true;
      }
    }
  } catch {}

  return false;
}

export function writeCgAuthedCookie(signedIn: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    document.cookie = signedIn
      ? 'cg_authed=1; Path=/; Max-Age=2592000; SameSite=Lax; Secure'
      : 'cg_authed=; Path=/; Max-Age=0; SameSite=Lax; Secure';
  } catch {}
}

export function broadcastAuthState(signedIn: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('cg_auth_sync', JSON.stringify({ signedIn, ts: Date.now() }));
  } catch {}
}
