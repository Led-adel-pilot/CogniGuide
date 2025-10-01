import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import HomeLanding from '@/components/HomeLanding';
import { siteMetadata } from '@/lib/siteMetadata';

const pageTitle = 'AI Mind Maps & Flashcards for Effective Studying';
const pageDescription =
  'Turn class notes, textbooks, and lecture slides into interactive mind maps and adaptive flashcards with CogniGuide\'s AI study assistant.';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: Array.from(new Set([...siteMetadata.keywords, 'study productivity', 'exam preparation'])),
  openGraph: {
    title: `${siteMetadata.name} | ${pageTitle}`,
    description: pageDescription,
    url: siteMetadata.url,
    siteName: siteMetadata.name,
    images: [
      {
        url: siteMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteMetadata.name} - AI-Powered Study Assistant`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteMetadata.name} | ${pageTitle}`,
    description: pageDescription,
    images: [siteMetadata.ogImage],
  },
  alternates: {
    canonical: siteMetadata.url,
  },
};

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
