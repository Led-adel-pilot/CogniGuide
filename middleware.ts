import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check specific paths or patterns that should redirect if authed
  // (The matcher handles the execution scope, but we double-check here for clarity if needed, 
  // though strictly speaking the matcher is the gatekeeper.)
  const shouldCheckAuth = 
    pathname === '/' ||
    pathname === '/ai-flashcard-generator' ||
    pathname === '/ai-mind-map-generator' ||
    pathname.startsWith('/flashcards') ||
    pathname.startsWith('/mind-maps')

  if (shouldCheckAuth) {
    // Fast path: check our own lightweight cookie set on auth change
    const cgAuthed = request.cookies.get('cg_authed')?.value
    if (cgAuthed === '1') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Fallback: check Supabase cookie if available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      try {
        const host = new URL(supabaseUrl).host // e.g. abcd1234.supabase.co
        const projectRef = host.split('.')[0]
        const cookieName = `sb-${projectRef}-auth-token`
        const hasSession = Boolean(request.cookies.get(cookieName)?.value)
        if (hasSession) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch {
        // ignore URL parsing errors and fall through
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/ai-flashcard-generator',
    '/ai-mind-map-generator',
    '/flashcards/:path*',
    '/mind-maps/:path*',
  ],
}
