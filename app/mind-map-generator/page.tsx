import type { Metadata } from 'next';
import Script from 'next/script';
import MindMapGeneratorLanding from '@/components/MindMapGeneratorLanding';
import { siteMetadata } from '@/lib/siteMetadata';

const pageTitle = 'AI Mind Map Generator & Maker - Create Mind Maps Online | CogniGuide';
const pageDescription =
  "Instantly generate interactive mind maps from text, PDFs, and documents with CogniGuide's free AI mind map maker. No sign-up required to start.";
const pageUrl = `${siteMetadata.url}/mind-map-generator`;

const keywordSet = new Set<string>([
  ...siteMetadata.keywords,
  'ai mind map generator',
  'mind map maker',
  'mind map generator online',
  'mind map generator free',
  'mind map maker no sign up',
  'concept map creator',
  'automatic mind map generator',
  'mind map generator from text',
  'mind map tool for students',
]);

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: Array.from(keywordSet),
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    siteName: siteMetadata.name,
    images: [
      {
        url: siteMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteMetadata.name} - AI Mind Map Generator`,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
    images: [siteMetadata.ogImage],
  },
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CogniGuide AI Mind Map Generator',
  operatingSystem: 'Web',
  applicationCategory: 'EducationalApplication',
  url: pageUrl,
  description:
    "CogniGuide's AI mind map maker turns notes, PDFs, and documents into interactive mind maps for studying, brainstorming, and content planning.",
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  featureList: [
    'AI mind map generator from text, PDFs, and slides',
    'Automatic branching and concept detection',
    'Interactive editing, sharing, and exporting tools',
    'Concept map, semantic map, and idea map layouts',
    'Mind map maker with no sign-up required to start',
  ],
  author: {
    '@type': 'Organization',
    name: siteMetadata.name,
  },
  publisher: {
    '@type': 'Organization',
    name: siteMetadata.name,
  },
  sameAs: [
    siteMetadata.url,
    'https://twitter.com/CogniGuideApp',
    'https://www.linkedin.com/company/cogniguide/',
  ],
};

export default function MindMapGeneratorPage() {
  return (
    <>
      <MindMapGeneratorLanding />
      <Script id="mind-map-generator-software-application" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(softwareApplicationJsonLd)}
      </Script>
    </>
  );
}
