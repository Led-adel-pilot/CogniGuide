import type { Metadata } from 'next';

export type ProgrammaticCTA =
  | {
      type: 'modal';
      label: string;
      ariaLabel?: string;
    }
  | {
      type: 'link';
      label: string;
      href: string;
      target?: string;
      rel?: string;
      ariaLabel?: string;
    };

export type RichTextBlock =
  | {
      type: 'paragraph';
      html: string;
    }
  | {
      type: 'list';
      ordered?: boolean;
      items: string[];
    };

export interface ProgrammaticFeature {
  title: string;
  description: string;
}

export interface ProgrammaticStep {
  title: string;
  description: string;
}

export interface ProgrammaticFaqItem {
  question: string;
  answer: string;
}

export interface ProgrammaticEmbeddedFlashcard {
  question: string;
  answer: string;
}

export interface ProgrammaticRelatedLink {
  label: string;
  href: string;
  description?: string;
}

export interface ProgrammaticSectionCopy {
  heading: string;
  subheading?: string;
}

export interface ProgrammaticMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  robots?: Metadata['robots'];
  openGraph?: Metadata['openGraph'];
  twitter?: Metadata['twitter'];
}

export interface ProgrammaticFlashcardPage {
  slug: string;
  path: string;
  metadata: ProgrammaticMetadata;
  hero: ProgrammaticSectionCopy & {
    eyebrow?: string;
    primaryCta?: ProgrammaticCTA;
  };
  featuresSection: ProgrammaticSectionCopy & {
    features: ProgrammaticFeature[];
  };
  howItWorksSection: ProgrammaticSectionCopy & {
    steps: ProgrammaticStep[];
    cta?: ProgrammaticCTA;
  };
  seoSection?: ProgrammaticSectionCopy & {
    body: RichTextBlock[];
  };
  faqSection?: ProgrammaticSectionCopy & {
    items: ProgrammaticFaqItem[];
    cta?: ProgrammaticCTA;
  };
  relatedTopicsSection?: ProgrammaticSectionCopy & {
    links: ProgrammaticRelatedLink[];
  };
  structuredData?: Record<string, unknown>;
  embeddedFlashcards?: ProgrammaticEmbeddedFlashcard[];
}

export type ProgrammaticFlashcardPageMap = Record<string, ProgrammaticFlashcardPage>;
