import { siteMetadata } from '@/lib/siteMetadata';
import type {
  ProgrammaticFaqItem,
  ProgrammaticFlashcardPage,
  ProgrammaticFlashcardPageMap,
} from './flashcardPageSchema';
import { generatedFlashcardPages } from './generated/flashcardPages';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';

const defaultFaqItems: ProgrammaticFaqItem[] = [
  {
    question: 'What is an AI flashcard generator?',
    answer:
      'It is a tool that creates question–answer study cards from your documents and notes using large language models, then schedules reviews with spaced repetition.',
  },
  {
    question: 'Can I upload PDFs or slides?',
    answer:
      'Yes. Upload PDFs, DOCX, PPTX, plain text, or images with text—CogniGuide will parse them and generate cards.',
  },
  {
    question: 'How does spaced repetition work here?',
    answer:
      'We use an FSRS-based scheduler to predict the best time to review each card so you retain information longer with fewer sessions.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'You can try CogniGuide free—no credit card required. Upgrade anytime for larger decks and faster generation.',
  },
];

export const defaultFlashcardLanding: ProgrammaticFlashcardPage = {
  slug: 'ai-flashcard-generator',
  path: '/ai-flashcard-generator',
  metadata: {
    title: 'AI Flashcard Generator | Create Spaced-Repetition Flashcards from PDFs & Notes',
    description:
      'Upload your study material and instantly generate high-quality flashcards. CogniGuide uses AI + spaced repetition (FSRS) to help you remember more in less time.',
    keywords: [
      'ai flashcard generator',
      'ai flashcard maker',
      'flashcard generator',
      'free online flashcard maker',
      'flashcard maker online',
      'ai generated flashcards',
    ],
    canonical: 'https://www.cogniguide.app/ai-flashcard-generator',
    openGraph: {
      title: 'AI Flashcard Generator | CogniGuide',
      description: 'Turn PDFs, slides, and notes into spaced-repetition flashcards powered by FSRS.',
      url: 'https://www.cogniguide.app/ai-flashcard-generator',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'AI Flashcard Generator | CogniGuide',
      description: 'Generate study flashcards from documents and remember more with FSRS.',
    },
    robots: { index: true, follow: true },
  },
  hero: {
    heading: 'AI Flashcard Generator — Master More in Less Time',
    subheading:
      'Upload your PDFs, slides, images, or notes. CogniGuide instantly creates high-quality Q&A cards and schedules reviews with spaced repetition (FSRS) so you remember more with less study time.',
    primaryCta: { type: 'modal', label: 'Try for Free' },
  },
  featuresSection: {
    heading: 'Why choose an AI flashcard maker?',
    subheading:
      'Stop spending hours making cards by hand. CogniGuide turns your study material into clean, effective flashcards and optimises your review plan automatically with spaced repetition.',
    features: [
      {
        title: 'Save hours every week',
        description: 'Automatically extract key facts and definitions from PDFs, lecture slides, and images.',
      },
      {
        title: 'Remember longer with FSRS',
        description: 'Our scheduler uses a proven spaced-repetition algorithm to time reviews for maximum retention.',
      },
      {
        title: 'Study anywhere',
        description: 'Open decks on desktop or mobile. Resume where you left off—your progress stays in sync.',
      },
    ],
  },
  howItWorksSection: {
    heading: 'How to create flashcards with AI',
    subheading: 'Three simple steps from upload to study.',
    steps: [
      {
        title: 'Upload your material',
        description: 'Add PDFs, DOCX, PPTX, images, or paste notes. We’ll parse and prepare the content.',
      },
      {
        title: 'Generate your deck',
        description: 'Our AI creates clean question–answer cards. Saving you hours of manual work.',
      },
      {
        title: 'Study with spaced repetition',
        description: 'Review on an FSRS schedule tuned to your exam date for deeper long-term memory.',
      },
    ],
    cta: { type: 'link', label: 'Get started free', href: '/pricing' },
  },
  seoSection: {
    heading: 'AI flashcard generator & maker: who is this for?',
    body: [
      {
        type: 'paragraph',
        html: "CogniGuide is an <strong>AI flashcard generator</strong> built for medical and nursing students, engineers, language learners, and busy professionals preparing for certifications. If you’ve been searching for an <em>AI flashcard maker</em> or a faster alternative to manual card creation, this page is for you.",
      },
      {
        type: 'list',
        items: [
          '<strong>Students:</strong> Turn dense lecture slides into concise Q–A cards.',
          '<strong>Professionals:</strong> Prep for AWS, PMP, CFA and more—without hand-typing every card.',
          '<strong>Language learners:</strong> Build vocab decks from readings and images with text.',
        ],
      },
      {
        type: 'paragraph',
        html: 'Prefer visual first? Try our <a class="underline" href="/ai-mind-map-generator">AI mind map generator</a> and then convert nodes into flashcards.',
      },
    ],
  },
  faqSection: {
    heading: 'AI flashcard generator FAQs',
    subheading: 'Everything you need to know before your first deck.',
    items: defaultFaqItems,
    cta: { type: 'modal', label: 'Generate my first deck' },
  },
  relatedTopicsSection: {
    heading: 'Related AI study tools',
    links: [
      {
        label: 'AI mind map generator',
        href: '/ai-mind-map-generator',
        description: 'Turn complex topics into visual mind maps before converting them into flashcards.',
      },
      {
        label: 'Study pricing plans',
        href: '/pricing',
        description: 'Compare free and premium features for growing your study workflow.',
      },
    ],
  },
  structuredData: undefined,
};

export const programmaticFlashcardPageMap: ProgrammaticFlashcardPageMap = Object.fromEntries(
  generatedFlashcardPages.map((page) => [page.slug, page])
);

type BuildFaqOptions = {
  url: string;
  faq: ProgrammaticFaqItem[];
};

type BuildFaqJsonLdOptions = BuildFaqOptions & { includeContext?: boolean };

export function buildFaqJsonLd({
  url,
  faq,
  includeContext = true,
}: BuildFaqJsonLdOptions): Record<string, unknown> {
  const node = {
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
    url,
    inLanguage: 'en',
    name: siteMetadata.title,
  };

  if (!includeContext) {
    return node;
  }

  return {
    '@context': 'https://schema.org',
    ...node,
  };
}

export function getProgrammaticFlashcardPage(slug: string): ProgrammaticFlashcardPage | undefined {
  return programmaticFlashcardPageMap[slug];
}

export { generatedFlashcardPages };

export const allFlashcardPages: ProgrammaticFlashcardPage[] = [defaultFlashcardLanding, ...generatedFlashcardPages];

type UseCaseBreadcrumb = {
  hub: { name: string; slug: string };
  subhub: { name: string; slug: string };
};

const useCaseBreadcrumbMap = new Map<string, UseCaseBreadcrumb>();

useCaseHubs.forEach((hub) => {
  hub.subhubs.forEach((subhub) => {
    subhub.flashcards.forEach((flashcard) => {
      if (!useCaseBreadcrumbMap.has(flashcard.slug)) {
        useCaseBreadcrumbMap.set(flashcard.slug, {
          hub: { name: hub.name, slug: hub.slug },
          subhub: { name: subhub.name, slug: subhub.slug },
        });
      }
    });
  });
});

type BreadcrumbListItem = {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
};

const getHomeUrl = (): string =>
  siteMetadata.url.endsWith('/') ? siteMetadata.url : `${siteMetadata.url}/`;

const buildBreadcrumbItems = (
  page: ProgrammaticFlashcardPage,
  canonical: string
): BreadcrumbListItem[] => {
  const items: BreadcrumbListItem[] = [];
  let position = 1;

  const addItem = (name: string, item: string) => {
    items.push({
      '@type': 'ListItem',
      position: position++,
      name,
      item,
    });
  };

  const homeUrl = getHomeUrl();
  addItem('CogniGuide', homeUrl);

  const breadcrumb = useCaseBreadcrumbMap.get(page.slug);

  if (breadcrumb) {
    const useCasesUrl = `${homeUrl}use-cases`;
    addItem('Use Cases', useCasesUrl);
    addItem(breadcrumb.hub.name, `${useCasesUrl}/${breadcrumb.hub.slug}`);
    addItem(
      breadcrumb.subhub.name,
      `${useCasesUrl}/${breadcrumb.hub.slug}/${breadcrumb.subhub.slug}`
    );
  } else {
    addItem('Flashcards', `${siteMetadata.url}/flashcards`);
  }

  addItem(page.metadata.title ?? page.hero.heading ?? page.slug, canonical);

  return items;
};

function ensureStructuredData(page: ProgrammaticFlashcardPage): void {
  const canonical =
    page.metadata.canonical ?? `${siteMetadata.url}${page.path ?? `/flashcards/${page.slug}`}`;

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: buildBreadcrumbItems(page, canonical),
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

ensureStructuredData(defaultFlashcardLanding as ProgrammaticFlashcardPage);
generatedFlashcardPages.forEach((page) => ensureStructuredData(page));
