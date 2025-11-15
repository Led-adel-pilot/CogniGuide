import { siteMetadata } from '@/lib/siteMetadata';
import { mindMapGeneratorFaqs } from '@/lib/data/mindMapGeneratorFaqs';
import type {
  ProgrammaticFaqItem,
  ProgrammaticMindMapPage,
  ProgrammaticMindMapPageMap,
} from './mindMapPageSchema';
import { generatedMindMapPages } from './generated/mindMapPages';
import { buildFaqJsonLd } from './flashcardPages';

const defaultFaqItems: ProgrammaticFaqItem[] = mindMapGeneratorFaqs;

export const defaultMindMapLanding: ProgrammaticMindMapPage = {
  slug: 'ai-mind-map-generator',
  path: '/ai-mind-map-generator',
  metadata: {
    title: 'AI Mind Map Generator | Turn PDFs & Notes into Visual Maps',
    description:
      'Upload PDFs, DOCX, PPTX, or paste text and CogniGuide instantly creates interactive mind maps. Export, edit, and convert branches into flashcards.',
    keywords: [
      'ai mind map generator',
      'ai mind map maker',
      'mind map generator online',
      'pdf to mind map',
      'concept map maker',
      'interactive mind maps',
    ],
    canonical: 'https://www.cogniguide.app/ai-mind-map-generator',
    openGraph: {
      title: 'AI Mind Map Generator | CogniGuide',
      description: 'Transform dense research packets into interactive mind maps you can edit, share, and export.',
      url: 'https://www.cogniguide.app/ai-mind-map-generator',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Mind Map Generator | CogniGuide',
      description: 'Generate mind maps from text, PDFs, and images in seconds.',
    },
    robots: { index: true, follow: true },
  },
  hero: {
    eyebrow: 'AI mind map software',
    heading: 'Mind Map Anything in Seconds',
    subheading:
      'Drop in your lecture notes, SOPs, or messy brainstorm prompts. CogniGuide restructures everything into a clean, interactive mind map you can expand, export, and turn into flashcards.',
    primaryCta: { type: 'modal', label: 'Generate a mind map' },
  },
  featuresSection: {
    heading: 'Why generate mind maps with CogniGuide?',
    subheading:
      'Replace manual diagramming with an AI workflow that understands hierarchy, relationships, and study context.',
    features: [
      {
        title: 'Upload any study material',
        description: 'PDFs, DOCX, PPTX, copied notes, or even OCR\'d images transform into organized nodes.',
      },
      {
        title: 'Edit like a designer',
        description: 'Drag branches, recolor sections, collapse layers, and export beautiful SVG, PNG, or PDF files.',
      },
      {
        title: 'Flashcards built in',
        description: 'Convert any branch into spaced-repetition flashcards whenever you need active recall practice.',
      },
    ],
  },
  howItWorksSection: {
    heading: 'How the AI mind map workflow works',
    subheading: 'Designed for students, teams, and solo researchers who need clarity fast.',
    steps: [
      {
        title: 'Upload or paste your content',
        description: 'Choose PDFs, DOCX, presentations, or freeform text and select your generation mode.',
      },
      {
        title: 'AI analyzes and structures it',
        description: 'CogniGuide extracts key ideas, groups them into logical branches, and drafts supporting bullets.',
      },
      {
        title: 'Customize & export',
        description: 'Expand, edit, and color-code your map. Export visuals or build flashcards from any branch.',
      },
    ],
    cta: { type: 'link', label: 'See pricing', href: '/pricing' },
  },
  seoSection: {
    heading: 'Mind map generator for research, studying, and strategy',
    body: [
      {
        type: 'paragraph',
        html: '<strong>CogniGuide\'s AI mind map generator</strong> turns dense notes into structured visuals so you can spot gaps, summarize faster, and teach others with confidence.',
      },
      {
        type: 'list',
        items: [
          '<strong>Students:</strong> Convert chapters, lab manuals, and lecture transcripts into tidy outlines.',
          '<strong>Product & ops teams:</strong> Map SOPs, onboarding flows, and GTM plans without whiteboarding.',
          '<strong>Researchers:</strong> Surface themes across interviews, research packets, and long-form PDFs.',
        ],
      },
      {
        type: 'paragraph',
        html: 'Need spaced repetition after mapping a topic? <a class="underline" href="/ai-flashcard-generator">Spin up flashcards</a> from any branch with one click.',
      },
    ],
  },
  faqSection: {
    heading: 'AI mind map generator FAQs',
    subheading: 'Everything you need to know before generating your first map.',
    items: defaultFaqItems,
    cta: { type: 'modal', label: 'Start mapping for free' },
  },
  relatedTopicsSection: {
    heading: 'Popular AI study workflows',
    links: [
      {
        label: 'AI flashcard generator',
        href: '/ai-flashcard-generator',
        description: 'Turn your mind map nodes into adaptive flashcards with FSRS scheduling.',
      },
      {
        label: 'Pricing plans',
        href: '/pricing',
        description: 'Compare free and paid tiers for mind maps, flashcards, and export credits.',
      },
    ],
  },
  embeddedMindMap: {
    markdown: `# Sample AI Mind Map
- Upload your files or paste notes
  - PDFs, DOCX, PPTX, lecture notes
- CogniGuide extracts the core ideas
  - Groups related topics and subtopics
  - Surfaces supporting facts and next steps
- Customize your map
  - Recolor branches, drag nodes, collapse sections
- Export & keep learning
  - Share the link, download assets, or turn branches into flashcards`,
  },
};

export const programmaticMindMapPageMap: ProgrammaticMindMapPageMap = Object.fromEntries(
  generatedMindMapPages.map((page) => [page.slug, page])
);

export function getProgrammaticMindMapPage(slug: string): ProgrammaticMindMapPage | undefined {
  return programmaticMindMapPageMap[slug];
}

export { generatedMindMapPages };

export const allMindMapPages: ProgrammaticMindMapPage[] = [defaultMindMapLanding, ...generatedMindMapPages];

const getHomeUrl = (): string =>
  siteMetadata.url.endsWith('/') ? siteMetadata.url : `${siteMetadata.url}/`;

function ensureStructuredData(page: ProgrammaticMindMapPage): void {
  const canonical = page.metadata.canonical ?? `${siteMetadata.url}${page.path ?? `/mind-maps/${page.slug}`}`;
  const homeUrl = getHomeUrl();

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'CogniGuide',
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Mind Maps',
        item: `${siteMetadata.url}/mind-maps`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: page.metadata.title ?? page.hero.heading ?? page.slug,
        item: canonical,
      },
    ],
  };

  const faqItems = page.faqSection?.items ?? [];
  const graph: Record<string, unknown>[] = [breadcrumb];

  if (faqItems.length > 0) {
    graph.push({
      ...buildFaqJsonLd({ url: canonical, faq: faqItems, includeContext: false }),
      '@id': `${canonical}#faq`,
    });
  }

  page.structuredData = {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

ensureStructuredData(defaultMindMapLanding);
generatedMindMapPages.forEach((page) => ensureStructuredData(page));
