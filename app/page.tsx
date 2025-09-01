import { redirect } from 'next/navigation';
import HomeLanding from '@/components/HomeLanding';

export default function Home() {
  // Derive Supabase cookie name from env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && typeof window === 'undefined') {
    try {
      const host = new URL(supabaseUrl).host;
      const projectRef = host.split('.')[0];
      const cookieName = `sb-${projectRef}-auth-token`;
      // Read cookie from request headers using Next.js server runtime
      const cookiesHeader = require('next/headers').cookies as () => { get: (name: string) => { value?: string } };
      const cookieStore = cookiesHeader();
      // Fast path: our own cookie
      const cgAuthed = cookieStore.get('cg_authed')?.value === '1';
      const hasSession = cgAuthed || Boolean(cookieStore.get(cookieName)?.value);
      if (hasSession) {
        redirect('/dashboard');
      }
    } catch {
      // ignore
    }
  }

  return <HomeLanding />;
}
