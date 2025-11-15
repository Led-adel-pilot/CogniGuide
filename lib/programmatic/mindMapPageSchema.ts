import type {
  ProgrammaticCTA,
  ProgrammaticFaqItem,
  ProgrammaticFeature,
  ProgrammaticLinkingRecommendations,
  ProgrammaticMetadata,
  ProgrammaticRelatedLink,
  ProgrammaticSectionCopy,
  ProgrammaticStep,
  RichTextBlock,
} from './flashcardPageSchema';

export type {
  ProgrammaticCTA,
  ProgrammaticFaqItem,
  ProgrammaticFeature,
  ProgrammaticLinkingRecommendations,
  ProgrammaticMetadata,
  ProgrammaticRelatedLink,
  ProgrammaticSectionCopy,
  ProgrammaticStep,
  RichTextBlock,
};

export interface ProgrammaticEmbeddedMindMap {
  markdown: string;
  title?: string;
  description?: string;
}

export interface ProgrammaticMindMapPage {
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
  linkingRecommendations?: ProgrammaticLinkingRecommendations;
  structuredData?: Record<string, unknown>;
  embeddedMindMap?: ProgrammaticEmbeddedMindMap;
}

export type ProgrammaticMindMapPageMap = Record<string, ProgrammaticMindMapPage>;
