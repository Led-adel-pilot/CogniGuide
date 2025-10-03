import type { Metadata } from 'next';
import Script from 'next/script';
import MindMapGeneratorLanding from '@/components/MindMapGeneratorLanding';
import { mindMapGeneratorFaqs } from '@/lib/data/mindMapGeneratorFaqs';
import { siteMetadata } from '@/lib/siteMetadata';

const pageTitle = 'AI Mind Map Generator & Maker - Create Mind Maps Online | CogniGuide';
const pageDescription =
  "Instantly generate interactive mind maps from text, PDFs, and documents with CogniGuide's free AI mind map maker. Jump in and start mapping right away.";
const pageUrl = `${siteMetadata.url}/ai-mind-map-generator`;

const keywordSet = new Set<string>([
  ...siteMetadata.keywords,
  'ai mind map generator',
  'ai mind map maker',
  'free mind map generator online',
  'pdf to mind map',
  'concept map creator',
  'mind map generator from text',
  'ai mind map',
  'free mind map maker',
  'spaced repetition flashcards',
]);

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: Array.from(keywordSet),
  alternates: {
    canonical: pageUrl,
  },
  robots: {
    index: true,
    follow: true,
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
    'Instant structure from raw notes and research packets',
    'Turn PDFs, notes, and slides into interactive visuals',
    'Interactive editing, sharing, and exporting tools',
    'Concept map, semantic map, and idea map layouts',
    'Flashcards and spaced repetition built into every map',
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

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: mindMapGeneratorFaqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteMetadata.url,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'AI Mind Map Generator',
      item: pageUrl,
    },
  ],
};

export default function MindMapGeneratorPage() {
  return (
    <>
      <MindMapGeneratorLanding />
      <Script id="mind-map-generator-software-application" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(softwareApplicationJsonLd)}
      </Script>
      <Script id="mind-map-generator-faq" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(faqJsonLd)}
      </Script>
      <Script id="mind-map-generator-breadcrumbs" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
    </>
  );
}
