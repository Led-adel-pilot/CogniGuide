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

  if (cgValue !== null) {
    return cgValue === '1';
  }

  return hasSupabaseSession;
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
