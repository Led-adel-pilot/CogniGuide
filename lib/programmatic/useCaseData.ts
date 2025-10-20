import type { Metadata } from 'next';
import { generatedFlashcardPages } from '@/lib/programmatic/generated/flashcardPages';
import { flashcardLinkMetadata } from '@/lib/programmatic/generated/flashcardLinkMetadata';

export type UseCaseLink = {
  slug: string;
  href: string;
  title: string;
  anchorText: string;
  description: string;
};

export type UseCaseSubhub = {
  name: string;
  slug: string;
  flashcards: UseCaseLink[];
};

export type UseCaseHub = {
  name: string;
  slug: string;
  subhubs: UseCaseSubhub[];
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const humanize = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const flashcardPageMap = new Map(
  generatedFlashcardPages.map((page) => [
    page.slug,
    {
      href: page.path ?? `/flashcards/${page.slug}`,
      title: page.metadata?.title ?? humanize(page.slug),
      description: page.metadata?.description,
    },
  ])
);

const rawHubData: Record<string, Record<string, string[]>> = {
  'Exam & Certification Prep': {
    'Standardized Tests': [
      'sat-vocabulary',
      'sat-vocabulary-online',
      'sat-vocabulary-barrons-test-prep',
      'sat-online',
      'sat-quizlet',
      'sat-vocab',
      'barrons-sat-vocabulary',
      'barrons-sat',
      'gre-magoosh',
      'magoosh-gre-vocabulary',
      'kaplan-gre-vocabulary',
      'gmat',
    ],
    'Medical Specialties & Prep': [
      'medstudy',
      'medstudy-internal-medicine',
      'medstudy-pediatrics',
      'medstudy-pediatrics-download',
      'anki-medical',
      'anki-medical-students',
      'ardms-abdomen-quizlet',
      'phlebotomy-essentials-7th-edition-quizlet',
      'uworld',
      'lange-pathology',
      'histology',
      'newborn',
      'infant-stimulation',
    ],
    'Professional & Technical Certs': [
      'bicsi-rcdd',
      'nasm',
      'sie',
      'colregs',
      'api-570',
      'nccer-pipefitter',
      'comptia',
      'epa-608',
      'servicenow-cis-itsm-quizlet',
      'fema-ics-200-quizlet',
      'servsafe-7th-edition-quizlet',
      'smartserve-quizlet',
      'modern-real-estate-practice-20th-edition',
      'babok-30',
    ],
    'Academic Prep & Science': [
      'ap-biology',
      'ap-chemistry',
      'ap-psychology',
      'barrons-ap-statistics',
      'class-10',
      'class-10-download',
      'ncert',
      'ged',
      'cgp-combined-science-revision',
      'midterm-notes',
      'critical-pass-reddit',
      'pathophysiology-exam-1-questions-quizlet',
      'right-brain-education',
      'shichida',
      'shichida-download',
      'python',
    ],
  },
  'Language & Culture': {
    'Global Languages': [
      'cantonese',
      'tagalog',
      'telugu',
      'tamil',
      'nihongo-notion',
      'marathi',
      'urdu-alphabets',
      'filipino',
      'filipino-alphabet',
      'hindi-swar',
      'french',
    ],
    'ESL & English Mastery': [
      'esl',
      'esl-adults',
      'esl-action-verbs',
      'english-online',
      'english-learning',
      'esl-weather',
      'grammar-adults',
      'learning-english',
      'verbs-english',
      'spanish',
      'asl',
      'tefl',
    ],
    'Advanced Grammar & Structure': [
      'idioms',
      'punctuation',
      'prefixes-suffixes',
      'synonyms-antonyms',
      'opposite',
      'antonyms',
      'adjectives-opposites',
      'adjective',
      'comparatives',
      'pronouns',
      'personal-pronouns',
      'possessive-pronouns',
    ],
    'Social Interaction & Themes': [
      'family-members',
      'family',
      'my-family',
      'greeting',
      'greetings-kindergarten',
      'hello',
      'greetings-english',
      'conversation',
      'physical-appearance',
    ],
    'Food & Apparel Vocab': [
      'food',
      'food-drinks',
      'healthy-food',
      'food-vocabulary',
      'clothes',
      'clothes-vocabulary',
      'fruits',
      'fruits-vegetables',
      'fruit-vegetable',
    ],
  },
  'Literacy & Phonics': {
    'Phonics Components': [
      'vowel',
      'short-vowel',
      'long-vowel',
      'cvc',
      'cvc-blending',
      'consonant-blends',
      'blend',
      'digraph',
      'phoneme',
      'phonogram',
      '70-phonograms',
      'phonics-sound',
    ],
    'Phonics Programs': [
      'jolly-phonics-group-1',
      'jolly-phonics-download',
      'zoo-phonics',
      'fundations-digraph-sound',
      'fundations-trick',
    ],
    'Sight & Tricky Words': [
      'sight',
      'pre-primer-sight',
      'dolch-sight',
      'tricky',
      'high-frequency',
      'make-sight',
      'beginning-sound-picture',
      'spelling',
    ],
    'Verbs & Tenses': [
      'verb',
      'verbs',
      'action-verb',
      'action-verbs',
      'english-verbs',
      'past-simple-irregular-verbs',
      'irregular-verbs',
      'phrasal-verbs',
      'tenses',
      'action',
    ],
    'Foundational Skills': [
      'alphabet',
      'abc',
      'alphabet-letter',
      'lowercase-letter',
      'cursive',
      'letter-sound',
      'ipa',
    ],
  },
  'Math, Science & Core K-5': {
    'Math Operations & Counting': [
      'addition',
      'addition-subtraction',
      'multiplication',
      'multiplication-table',
      'times-table',
      'division',
      'integer',
      'fraction',
      'math',
      'abacus',
      'money',
      'counting',
    ],
    'Geometry & Visuals': [
      'shapes',
      'shape',
      'colors',
      'color',
      'colors-shapes',
      'picture',
      'action-picture',
      'preposition-picture',
    ],
    'Early Science & Senses': [
      'science',
      'biology',
      'organic-chemistry',
      'five-senses',
      '5-senses',
      'senses',
      'emotions',
      'emotions-feelings',
      'feelings-emotions',
      'feeling',
    ],
    'Early Topics & Themes': [
      'brown-bear',
      'thirsty-crow',
      'everybody-up-starter',
      'families',
      'community-helpers',
      'community-signs',
      'days-week-kindergarten',
      'animals-kindergarten',
      'power-up-1',
      'house',
    ],
  },
  'Nature, Geography & Time': {
    'Animals & Fauna': [
      'animals',
      'zoo-animals',
      'wild-animals',
      'birds',
      'insect',
      'farm-animals',
      'flowers',
      'fruit-vegetable',
    ],
    'Environment & Space': [
      'countries',
      'flags-world',
      'planet',
      'recycling',
      'plants',
      'exercise',
      'winter-sports',
      'winter',
    ],
    'Seasons & Calendar': [
      'time',
      'days-week',
      'days-months',
      'months',
      'months-year',
      'telling-time',
      '4-seasons',
      'summer',
      'summer-vocabulary',
      'halloween',
    ],
    'Transportation & Location': [
      'transport',
      'transportation',
      'vehicle',
      'directions',
      'bedroom',
      'household-items',
    ],
  },
  'App Integration & System Tools': {
    'Quizlet Generation': [
      'quizlet',
      'create-quizlet',
      'quizlet-make',
      'quizlet-create',
      'quizlet-make-set',
      'quizlet-create-set',
      'quizlet-create-study-set',
      'quizlet-how-make',
      'create-my-quizlet',
      'make-my-quizlet',
      'download-from-quizlet',
      'sites-like-quizlet',
      'make-quizlet-live',
    ],
    'Quizlet Testing & Quizzes': [
      'quizlet-make-private',
      'quizlet-make-quiz',
      'quizlet-game-create',
      'create-quizlet-quiz',
      'quizlet-test-maker',
      'test-maker',
      'quiz-maker',
    ],
    'Anki Generation': [
      'anki-english',
      'create-anki',
      'make-anki',
      'create-anki-quickly',
      'make-anki-fast',
      'anki-deck-generator',
      'anki-maker',
      'anki-note',
      'anki-notes',
      'students',
    ],
    'Note Conversion': [
      'goodnotes',
      'goodnotes-5',
      'good-notes',
      'good-note',
      'create-goodnotes',
      'one-note',
      'evernote',
      'knowt',
      'note-recognition',
      'handwritten-revision',
    ],
  },
  'General Generator Features': {
    'Core Maker Tools': [
      'maker',
      'creator',
      'generator',
      'ai-generator',
      'digital-maker',
      'easy-maker',
      'online-maker',
      'online-creator',
      'automatic-maker',
      'study-maker',
      'interactive-maker',
      'virtual-maker',
    ],
    'Creation Process': [
      'create',
      'make',
      'write',
      'create-study-online',
      'create-digital',
      'create-online',
      'make-online',
      'make-online-study',
      'make-my',
      'make-study',
      'create-virtual',
    ],
    'File Conversion & Utility': [
      'pdf-flashcards',
      'flash-cards-pdf',
      'flash-cards-pdf-free',
      'convert-notes',
      'maker-from',
      'download',
      'maker-download',
      'by-chegg',
      'maker-software',
      'maker-program',
      'canva-maker',
      'best-website-make',
      'online',
      'free-notecards',
    ],
    'Outputs & Formatting': [
      'maker-pictures',
      'creator-images',
      'flip-maker',
      'create-multiple-choice',
      'blank',
      'stationery',
      'revision-note',
      'study-notes',
      'study-note',
      'note-name',
      'online-study-note',
    ],
  },
  'Vocabulary & Specialized Concepts': {
    'Vocabulary Builders': [
      'vocab-maker',
      'language-maker',
      'make-vocabulary',
      'create-vocabulary',
      'vocabulary',
      'english-vocabulary',
      'vocabulary-english',
      'online-vocabulary',
      'nelson-denny-vocabulary',
      'make-sight',
    ],
    'Efficiency & Utility': [
      'best-maker',
      'best-create',
      'best-making',
      'best-make',
      'best-creating',
      '1-10',
      '1-20',
      'colregs',
    ],
    'General Concepts': [
      'singular-plural',
      'opposite-adjectives',
      'house',
      'bedroom',
      'household-items',
      'clothes',
      'action-verb',
      'action-verbs',
      'power-up-1',
      'exercise',
    ],
    'Number Templates': [
      'counting',
      'multiplication',
      'addition',
      'division',
      'abacus',
      'money',
      'time',
      'telling-time',
      'math',
      'integer',
      'fraction',
    ],
  },
};

const buildFlashcardLinks = (slugs: string[]): UseCaseLink[] =>
  slugs.map((slug) => {
    const entry = flashcardPageMap.get(slug);
    const linkMetadata = flashcardLinkMetadata[slug];
    const title = entry?.title ?? humanize(slug);
    const anchorText =
      linkMetadata?.anchorTextVar1 ??
      linkMetadata?.anchorTextVar2 ??
      title;
    const description =
      linkMetadata?.description ??
      entry?.description ??
      title;

    return {
      slug,
      href: entry?.href ?? `/flashcards/${slug}`,
      title,
      anchorText,
      description,
    };
  });

export const useCaseHubs: UseCaseHub[] = Object.entries(rawHubData).map(([hubName, subhubMap]) => ({
  name: hubName,
  slug: slugify(hubName),
  subhubs: Object.entries(subhubMap).map(([subhubName, slugs]) => ({
    name: subhubName,
    slug: slugify(subhubName),
    flashcards: buildFlashcardLinks(slugs),
  })),
}));

export const useCaseHubMap = new Map(useCaseHubs.map((hub) => [hub.slug, hub]));

export const getHubBySlug = (slug: string): UseCaseHub | undefined => useCaseHubMap.get(slug);

export const getSubhubBySlugs = (
  hubSlug: string,
  subhubSlug: string
): { hub: UseCaseHub; subhub: UseCaseSubhub } | undefined => {
  const hub = getHubBySlug(hubSlug);
  if (!hub) return undefined;
  const subhub = hub.subhubs.find((item) => item.slug === subhubSlug);
  if (!subhub) return undefined;
  return { hub, subhub };
};

export const useCasesMetadataBase: Metadata = {
  title: 'Use Cases | CogniGuide',
  description:
    'Explore AI flashcard and study tool use cases organized by exam prep, language learning, phonics, K-5 skills, and more specialized study goals.',
};

