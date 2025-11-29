import type { Metadata, Viewport } from "next";
import "./globals.css";
import TooltipLayer from "@/components/TooltipLayer";
import { siteMetadata } from "@/lib/siteMetadata";

const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

const baseMetadata: Metadata = {
  metadataBase: new URL(siteMetadata.url),
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.shortName}`,
  },
  description: siteMetadata.description,
  keywords: siteMetadata.keywords,
  openGraph: {
    title: siteMetadata.title,
    description: siteMetadata.description,
    url: siteMetadata.url,
    siteName: siteMetadata.name,
    images: [
      {
        url: siteMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteMetadata.name} – AI-Powered Study Assistant`,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteMetadata.title,
    description: siteMetadata.description,
    images: [siteMetadata.ogImage],
  },
  alternates: {
    canonical: siteMetadata.url,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: googleSiteVerification,
  },
};

if (!googleSiteVerification) {
  delete baseMetadata.verification;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = baseMetadata;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteMetadata.name,
  alternateName: siteMetadata.shortName,
  url: siteMetadata.url,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description: siteMetadata.description,
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-powered document and image understanding",
    "Interactive mind map generation",
    "Flashcards with spaced repetition scheduling",
    "Public sharing with secure links",
    "Realtime streaming rendering",
  ],
  author: {
    "@type": "Organization",
    name: siteMetadata.name,
  },
  publisher: {
    "@type": "Organization",
    name: siteMetadata.name,
    email: siteMetadata.contactEmail,
  },
  sameAs: [
    siteMetadata.url,
    "https://twitter.com/CogniGuideApp",
    "https://www.linkedin.com/company/cogniguide/",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://us-assets.i.posthog.com" crossOrigin="anonymous" />
        <script
          // Strip a leftover bare # (Supabase can leave it after handling tokens) so the URL stays clean
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var hash = window.location.hash || '';
                  if (hash === '#') {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('cogniguide_theme');
                let theme = 'light';
                if (savedTheme === 'dark') {
                  theme = 'dark';
                } else if (savedTheme === 'system' || !savedTheme) {
                  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    theme = 'dark';
                  }
                }
                document.documentElement.dataset.theme = theme;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <TooltipLayer />
        <main className="flex-1">{children}</main>

        <div id="modal-root" />
      </body>
    </html>
  );
}
