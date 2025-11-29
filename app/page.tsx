import { Metadata, Viewport } from 'next';
import HomeLanding from '@/components/HomeLanding';
import { siteMetadata } from '@/lib/siteMetadata';

const pageTitle = 'AI Mind Maps & Flashcards for Effective Studying';
const pageDescription =
  'Turn class notes, textbooks, and lecture slides into interactive mind maps and adaptive flashcards with CogniGuide\'s AI study assistant.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

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

export const dynamic = 'force-static';

export default function Home() {
  return <HomeLanding />;
}
