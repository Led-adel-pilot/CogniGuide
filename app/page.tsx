import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import HomeLanding from '@/components/HomeLanding';

export const metadata: Metadata = {
  title:
    'CogniGuide | AI-Powered Mind Maps & Flashcards for Effective Studying',
  description:
    'Transform your study materials into interactive mind maps and SEO-friendly flashcards with CogniGuide. Our AI-powered study tools help you learn, review, and rank better on Google while retaining information more effectively. Supports PDF, DOCX, PPTX, and images.',
  keywords: [
    'AI study assistant',
    'mind map generator',
    'flashcard generator',
    'spaced repetition',
    'study tools',
    'learning assistant',
    'study seo',
    'education seo tools',
    'PDF to mind map',
    'document analysis',
    'CogniGuide',
  ],
  openGraph: {
    title:
      'CogniGuide | AI-Powered Mind Maps & Flashcards for Effective Studying',
    description:
      'Transform your study materials into interactive mind maps and SEO-friendly flashcards with CogniGuide. Our AI-powered study tools help you learn, review, and rank better on Google while retaining information more effectively. Supports PDF, DOCX, PPTX, and images.',
    url: 'https://www.cogniguide.app',
    siteName: 'CogniGuide',
    images: [
      {
        url: 'https://www.cogniguide.app/og-image.png', // It's recommended to create a specific Open Graph image
        width: 1200,
        height: 630,
        alt: 'CogniGuide - AI-Powered Study Assistant',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'CogniGuide | AI-Powered Mind Maps & Flashcards for Effective Studying',
    description:
      'Transform your study materials into interactive mind maps and SEO-friendly flashcards with CogniGuide. Our AI-powered study tools help you learn, review, and rank better on Google while retaining information more effectively. Supports PDF, DOCX, PPTX, and images.',
    images: ['https://www.cogniguide.app/og-image.png'], // It's recommended to create a specific Twitter card image
  },
  alternates: {
    canonical: 'https://www.cogniguide.app',
  },
  other: {
    'google-site-verification': 'your_google_site_verification_token', // Replace with your actual token
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
