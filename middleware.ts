import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/') {
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
  ],
}
