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
  path: string;
  description: string;
  pageIntro: string;
  metaDescription: string;
  flashcards: UseCaseLink[];
};

export type UseCaseHub = {
  name: string;
  slug: string;
  path: string;
  menuDescription: string;
  pageIntro: string;
  metaDescription: string;
  subhubs: UseCaseSubhub[];
};

export type FlashcardBreadcrumbSegment = {
  label: string;
  href?: string;
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

const buildHubPath = (slug: string): string => `/flashcards/${slug}`;

const buildSubhubPath = (hubSlug: string, subhubSlug: string): string =>
  `/flashcards/${hubSlug}/${subhubSlug}`;

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

type HubCopy = {
  menuDescription: string;
  pageIntro: string;
  metaDescription: string;
};

type SubhubCopy = {
  description: string;
  pageIntro: string;
  metaDescription: string;
};

const hubCopy: Record<string, HubCopy> = {
  'Exam & Certification Prep': {
    menuDescription:
      'Exam blueprints for SAT, GRE, medical boards, and industry certifications.',
    pageIntro:
      'Target your next exam with curated study hubs covering standardized tests, board reviews, and professional credentials.',
    metaDescription:
      'Find AI-generated flashcard workflows for standardized exams, medical board prep, and professional certifications.',
  },
  'Language & Culture': {
    menuDescription:
      'Immersive language practice across global dialects, ESL skills, and cultural topics.',
    pageIntro:
      'Level up language proficiency with hubs dedicated to world languages, ESL mastery, grammar, and everyday vocabulary.',
    metaDescription:
      'Discover AI flashcards for world languages, ESL practice, grammar, and cultural vocabulary sets.',
  },
  'Literacy & Phonics': {
    menuDescription:
      'Build foundational literacy with phonics rules, tricky words, and verb practice.',
    pageIntro:
      'Support early readers with hubs covering phonics patterns, classroom programs, sight words, and essential grammar.',
    metaDescription:
      'Explore phonics-based flashcard paths for decoding skills, sight words, and foundational literacy concepts.',
  },
  'Math, Science & Core K-5': {
    menuDescription: 'Elementary math, science, and classroom themes for K-5 learners.',
    pageIntro:
      'Reinforce core K-5 subjects with hubs for math fluency, geometry visuals, early science, and classroom themes.',
    metaDescription:
      'Access AI flashcards for elementary math skills, science basics, and thematic classroom topics.',
  },
  'Nature, Geography & Time': {
    menuDescription:
      'Explore animals, earth science, seasons, and navigation vocabulary.',
    pageIntro:
      'Spark curiosity about the natural world with hubs on animals, the environment, seasons, and transportation.',
    metaDescription:
      'Browse flashcard journeys covering wildlife, geography, seasonal changes, and travel-related vocabulary.',
  },
  'App Integration & System Tools': {
    menuDescription:
      'Automate study workflows with Quizlet, Anki, and digital note integrations.',
    pageIntro:
      'Connect CogniGuide to your favorite study apps with hubs for Quizlet, Anki, and note conversion workflows.',
    metaDescription:
      'Learn how to generate Quizlet sets, build Anki decks, and convert notes with CogniGuide automations.',
  },
  'General Generator Features': {
    menuDescription:
      'Master the CogniGuide maker with creation workflows, formats, and exports.',
    pageIntro:
      'Unlock advanced generator capabilities with hubs focused on creation steps, file utilities, and output formats.',
    metaDescription:
      'See how to customize CogniGuide flashcard creation, convert files, and control export formats.',
  },
  'Vocabulary & Specialized Concepts': {
    menuDescription:
      'Deepen vocabulary knowledge and niche concept review with targeted templates.',
    pageIntro:
      'Customize vocabulary builders and specialized study sets with hubs for word lists, utilities, and numeric templates.',
    metaDescription:
      'Find vocabulary-focused flashcards, efficiency tips, and numeric study templates tailored to your goals.',
  },
};

const makeSubhubKey = (hubSlug: string, subhubSlug: string) => `${hubSlug}::${subhubSlug}`;

const subhubCopy: Record<string, SubhubCopy> = {
  [makeSubhubKey('exam-certification-prep', 'standardized-tests')]: {
    description:
      'SAT, GRE, GMAT, and other test-prep flashcards tuned for vocabulary, math, and reasoning drills.',
    pageIntro:
      'Jump into curated SAT, GRE, GMAT, and related standardized test resources designed to streamline exam review.',
    metaDescription:
      'Browse AI flashcards for SAT vocabulary, GRE practice, GMAT review, and other standardized tests.',
  },
  [makeSubhubKey('exam-certification-prep', 'medical-specialties-prep')]: {
    description:
      'Board-style flashcards for MedStudy, pediatrics, phlebotomy, and other medical exam essentials.',
    pageIntro:
      'Review high-yield medical topics with flashcards spanning MedStudy systems, pediatrics, imaging, and clinical procedures.',
    metaDescription:
      'Discover medical specialty flashcards covering MedStudy, pediatrics, imaging, and certification prep topics.',
  },
  [makeSubhubKey('exam-certification-prep', 'professional-technical-certs')]: {
    description:
      'Industry certification decks for NASM, CompTIA, ServSafe, real estate, and more.',
    pageIntro:
      'Prepare for professional credentials with flashcard paths covering fitness, IT, safety, and technical certification outlines.',
    metaDescription:
      'Explore flashcards for NASM, CompTIA, ServSafe, real estate exams, and other professional certifications.',
  },
  [makeSubhubKey('exam-certification-prep', 'academic-prep-science')]: {
    description:
      'AP sciences, GED review, and classroom study guides for core academic success.',
    pageIntro:
      'Strengthen academic foundations with flashcards for AP courses, GED prep, NCERT studies, and classroom science topics.',
    metaDescription:
      'Access AP science, GED, NCERT, and classroom study flashcards for academic prep and science mastery.',
  },
  [makeSubhubKey('language-culture', 'global-languages')]: {
    description:
      'AI-supported vocabulary decks for Cantonese, Tagalog, Telugu, Tamil, French, and more world languages.',
    pageIntro:
      'Immerse in world languages with flashcards covering pronunciation, vocabulary, and script practice across Asian and European tongues.',
    metaDescription:
      'Study Cantonese, Tagalog, Telugu, Tamil, French, and other global languages with targeted flashcard sets.',
  },
  [makeSubhubKey('language-culture', 'esl-english-mastery')]: {
    description:
      'Boost ESL fluency with everyday English verbs, weather phrases, grammar refreshers, and TEFL prep.',
    pageIntro:
      'Build English confidence through ESL flashcards focused on verbs, weather, communication, and adult learner scenarios.',
    metaDescription:
      'Find ESL flashcards for adults covering verbs, weather, conversational English, and TEFL-oriented practice.',
  },
  [makeSubhubKey('language-culture', 'advanced-grammar-structure')]: {
    description:
      'Master idioms, punctuation, prefixes, and pronoun usage with focused grammar flashcards.',
    pageIntro:
      'Polish advanced grammar with flashcards that drill idioms, punctuation rules, word forms, and pronoun distinctions.',
    metaDescription:
      'Explore flashcards on idioms, punctuation, prefixes and suffixes, antonyms, and pronoun usage for advanced grammar study.',
  },
  [makeSubhubKey('language-culture', 'social-interaction-themes')]: {
    description:
      'Conversation-ready vocabulary for family, greetings, appearances, and everyday discussions.',
    pageIntro:
      'Practice social language with flashcards around family relationships, greetings, conversations, and descriptive vocabulary.',
    metaDescription:
      'Review flashcards covering family terms, greetings, conversations, and social themes for everyday English.',
  },
  [makeSubhubKey('language-culture', 'food-apparel-vocab')]: {
    description:
      'Learn food, drink, clothing, and produce vocabulary across themed flashcard sets.',
    pageIntro:
      'Develop essential food and clothing vocabulary with flashcards that cover ingredients, meals, and wardrobe basics.',
    metaDescription:
      'Browse flashcards for food vocabulary, fruits and vegetables, and clothing terms to expand daily language.',
  },
  [makeSubhubKey('literacy-phonics', 'phonics-components')]: {
    description:
      'Foundational phonics decks covering vowels, blends, digraphs, and phonograms.',
    pageIntro:
      'Build decoding confidence with flashcards on vowel sounds, consonant blends, digraphs, phonemes, and phonograms.',
    metaDescription:
      'Study vowel patterns, blends, digraphs, phonemes, and phonograms with targeted phonics flashcards.',
  },
  [makeSubhubKey('literacy-phonics', 'phonics-programs')]: {
    description:
      'Support classroom phonics programs like Jolly Phonics, Zoo-Phonics, and Fundations.',
    pageIntro:
      'Reinforce popular phonics curricula through flashcards aligned to Jolly Phonics, Zoo-Phonics, and Fundations lessons.',
    metaDescription:
      'Access flashcards tailored to Jolly Phonics, Zoo-Phonics, and Fundations activities to boost literacy instruction.',
  },
  [makeSubhubKey('literacy-phonics', 'sight-tricky-words')]: {
    description:
      'High-frequency and tricky word flashcards to accelerate sight word recognition.',
    pageIntro:
      'Help learners master Dolch and tricky sight words with flashcards that blend spelling, recognition, and context practice.',
    metaDescription:
      'Find flashcards for Dolch sight words, tricky word lists, and spelling practice to support rapid reading fluency.',
  },
  [makeSubhubKey('literacy-phonics', 'verbs-tenses')]: {
    description:
      'Action verb and tense practice to strengthen grammar and writing foundations.',
    pageIntro:
      'Guide students through verb usage with flashcards on action verbs, irregular tenses, and phrasal verb mastery.',
    metaDescription:
      'Explore flashcards on verbs, action words, irregular tenses, and phrasal verbs to improve grammar skills.',
  },
  [makeSubhubKey('literacy-phonics', 'foundational-skills')]: {
    description:
      'Alphabet, handwriting, and letter-sound flashcards for emerging readers.',
    pageIntro:
      'Support early literacy with flashcards that teach alphabet sequencing, handwriting, letter sounds, and IPA awareness.',
    metaDescription:
      'Browse flashcards for alphabet practice, lowercase/cursive letters, and letter-sound connections for foundational literacy.',
  },
  [makeSubhubKey('math-science-core-k-5', 'math-operations-counting')]: {
    description:
      'Arithmetic practice covering addition, multiplication, times tables, money, and counting strategies.',
    pageIntro:
      'Build number sense with flashcards focused on operations, multiplication tables, counting exercises, and math vocabulary.',
    metaDescription:
      'Find elementary math flashcards for addition, multiplication, division, counting, money, and math facts.',
  },
  [makeSubhubKey('math-science-core-k-5', 'geometry-visuals')]: {
    description:
      'Shape, color, and spatial vocabulary flashcards that make geometry visual and fun.',
    pageIntro:
      'Introduce geometric thinking with flashcards about shapes, colors, spatial prepositions, and picture-based prompts.',
    metaDescription:
      'Explore flashcards covering shapes, colors, spatial prepositions, and visual geometry terms for young learners.',
  },
  [makeSubhubKey('math-science-core-k-5', 'early-science-senses')]: {
    description:
      'Science starters on biology, chemistry, senses, emotions, and observation language.',
    pageIntro:
      'Spark STEM curiosity with flashcards that explain the senses, emotions, basic biology, and introductory science vocabulary.',
    metaDescription:
      'Access flashcards on the five senses, emotions, basic biology, and early science concepts for elementary students.',
  },
  [makeSubhubKey('math-science-core-k-5', 'early-topics-themes')]: {
    description:
      'Classroom themes, stories, and community topics tailored to early elementary learners.',
    pageIntro:
      'Enhance thematic units with flashcards on classic stories, community helpers, classroom routines, and home vocabulary.',
    metaDescription:
      'Browse flashcards for early elementary themes like community helpers, story characters, and classroom routines.',
  },
  [makeSubhubKey('nature-geography-time', 'animals-fauna')]: {
    description:
      'Wildlife flashcards featuring zoo animals, birds, insects, and flowering plants.',
    pageIntro:
      'Explore biodiversity with flashcards about animal habitats, bird species, insects, and plant life.',
    metaDescription:
      'Find flashcards on animals, birds, insects, and flowers to teach fauna vocabulary and science facts.',
  },
  [makeSubhubKey('nature-geography-time', 'environment-space')]: {
    description:
      'Earth science and space-themed decks covering countries, flags, planets, and sustainability.',
    pageIntro:
      'Teach global awareness with flashcards on world geography, environmental stewardship, space science, and active lifestyles.',
    metaDescription:
      'Explore flashcards about countries, flags, planets, recycling, exercise, and seasonal activities focused on the environment.',
  },
  [makeSubhubKey('nature-geography-time', 'seasons-calendar')]: {
    description:
      'Calendar vocabulary for days, months, time-telling, seasons, and holiday themes.',
    pageIntro:
      'Help learners read the calendar with flashcards on days of the week, months, time-telling, and seasonal celebrations.',
    metaDescription:
      'Access flashcards for days, months, telling time, seasons, and holidays to teach calendar skills.',
  },
  [makeSubhubKey('nature-geography-time', 'transportation-location')]: {
    description:
      'Travel and location vocabulary, from vehicles and directions to rooms of the house.',
    pageIntro:
      'Build navigation language with flashcards on transportation modes, giving directions, and household location words.',
    metaDescription:
      'Find flashcards covering transportation, vehicles, directions, and household locations for spatial vocabulary practice.',
  },
  [makeSubhubKey('app-integration-system-tools', 'quizlet-generation')]: {
    description:
      'Step-by-step flashcards for creating, importing, and downloading Quizlet study sets.',
    pageIntro:
      'Automate Quizlet workflows with guides that show how to create sets, import content, and generate collaborative games.',
    metaDescription:
      'Learn how to create Quizlet sets, import decks, and launch Quizlet live experiences with CogniGuide.',
  },
  [makeSubhubKey('app-integration-system-tools', 'quizlet-testing-quizzes')]: {
    description:
      'Assessment-focused tutorials for building quizzes, tests, and private study games in Quizlet.',
    pageIntro:
      'Design engaging assessments with flashcards explaining Quizlet test modes, quiz creation, and secure study sessions.',
    metaDescription:
      'Discover flashcards covering Quizlet test maker features, private quiz creation, and game-based assessments.',
  },
  [makeSubhubKey('app-integration-system-tools', 'anki-generation')]: {
    description:
      'Automations for building and exporting Anki decks from your study materials.',
    pageIntro:
      'Streamline spaced repetition with flashcards that teach how to create, customize, and accelerate Anki deck production.',
    metaDescription:
      'Explore flashcards for generating Anki decks, notes, and student-ready spaced repetition resources.',
  },
  [makeSubhubKey('app-integration-system-tools', 'note-conversion')]: {
    description:
      'Convert notes from GoodNotes, OneNote, Evernote, and handwritten sources into flashcards.',
    pageIntro:
      'Turn every note into a study asset with flashcards on importing from GoodNotes, OneNote, Evernote, and handwriting scans.',
    metaDescription:
      'Find flashcards that show how to convert GoodNotes, OneNote, Evernote, and handwritten notes into CogniGuide flashcards.',
  },
  [makeSubhubKey('general-generator-features', 'core-maker-tools')]: {
    description:
      'Learn the essential CogniGuide maker settings for fast, high-quality flashcards.',
    pageIntro:
      'Master the core generator by exploring flashcards on AI maker options, interactive modes, and study workflows.',
    metaDescription:
      'Access flashcards explaining CogniGuide\'s core maker, digital creator, and AI generator capabilities.',
  },
  [makeSubhubKey('general-generator-features', 'creation-process')]: {
    description:
      'Guided playbooks for writing prompts, uploading content, and producing online study sets.',
    pageIntro:
      'Follow step-by-step creation workflows with flashcards on drafting prompts, uploading files, and publishing study sets.',
    metaDescription:
      'Browse flashcards covering how to create, write, and publish study materials with CogniGuide.',
  },
  [makeSubhubKey('general-generator-features', 'file-conversion-utility')]: {
    description:
      'Convert PDFs, existing flashcards, and external resources into CogniGuide-ready formats.',
    pageIntro:
      'Unlock productivity with flashcards showing how to convert PDFs, download resources, and streamline flashcard imports.',
    metaDescription:
      'Learn to convert PDFs, download study files, and optimize external resources for CogniGuide flashcards.',
  },
  [makeSubhubKey('general-generator-features', 'outputs-formatting')]: {
    description:
      'Customize flashcard outputs with images, multiple-choice layouts, revision notes, and more.',
    pageIntro:
      'Control your deliverables using flashcards on adding images, multiple-choice formats, and printable note styles.',
    metaDescription:
      'Find flashcards for creating image-rich flashcards, multiple-choice sets, and formatted study notes.',
  },
  [makeSubhubKey('vocabulary-specialized-concepts', 'vocabulary-builders')]: {
    description:
      'Vocabulary expansion templates for English learners, test prep, and literacy programs.',
    pageIntro:
      'Grow word banks with flashcards dedicated to vocabulary creation, sight words, and Nelson-Denny style practice.',
    metaDescription:
      'Explore flashcards for building vocabulary lists, English vocabulary practice, and Nelson-Denny preparation.',
  },
  [makeSubhubKey('vocabulary-specialized-concepts', 'efficiency-utility')]: {
    description:
      'Productivity tips for choosing the best flashcard maker, numbering systems, and study shortcuts.',
    pageIntro:
      'Optimize your workflow with flashcards that compare study tools, cover numbering templates, and highlight exam rules.',
    metaDescription:
      'Discover flashcards about selecting the best flashcard makers, study utilities, and numbering templates.',
  },
  [makeSubhubKey('vocabulary-specialized-concepts', 'general-concepts')]: {
    description:
      'Versatile study sets that tackle grammar, home vocabulary, fitness, and lifestyle topics.',
    pageIntro:
      'Keep learners engaged with flashcards spanning opposites, household vocabulary, exercise themes, and everyday concepts.',
    metaDescription:
      'Browse flashcards covering opposites, household vocabulary, exercise topics, and other general study concepts.',
  },
  [makeSubhubKey('vocabulary-specialized-concepts', 'number-templates')]: {
    description:
      'Number-focused flashcards for counting, operations, telling time, and money skills.',
    pageIntro:
      'Develop numeracy with flashcards on counting sequences, operations, time-telling, and financial literacy basics.',
    metaDescription:
      'Access flashcards for counting, addition, division, time, money, and other numeric templates.',
  },
};

const getHubCopy = (hubName: string): HubCopy => {
  const copy = hubCopy[hubName];
  if (copy) {
    return copy;
  }
  return {
    menuDescription: `Explore ${hubName} study resources crafted with CogniGuide.`,
    pageIntro: `Discover flashcard workflows curated for ${hubName}.`,
    metaDescription: `Explore ${hubName} flashcard workflows on CogniGuide.`,
  };
};

const getSubhubCopy = (
  hubName: string,
  hubSlug: string,
  subhubName: string,
  subhubSlug: string
): SubhubCopy => {
  const key = makeSubhubKey(hubSlug, subhubSlug);
  const copy = subhubCopy[key];
  if (copy) {
    return copy;
  }
  return {
    description: `AI flashcards for ${subhubName} topics within ${hubName}.`,
    pageIntro: `Dive into ${subhubName} resources curated for the ${hubName} hub.`,
    metaDescription: `Explore ${subhubName} flashcards in the ${hubName} hub on CogniGuide.`,
  };
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

export const useCaseHubs: UseCaseHub[] = Object.entries(rawHubData).map(([hubName, subhubMap]) => {
  const hubSlug = slugify(hubName);
  const hubMetadata = getHubCopy(hubName);

  return {
    name: hubName,
    slug: hubSlug,
    path: buildHubPath(hubSlug),
    menuDescription: hubMetadata.menuDescription,
    pageIntro: hubMetadata.pageIntro,
    metaDescription: hubMetadata.metaDescription,
    subhubs: Object.entries(subhubMap).map(([subhubName, slugs]) => {
      const subhubSlug = slugify(subhubName);
      const subhubMetadata = getSubhubCopy(hubName, hubSlug, subhubName, subhubSlug);
      return {
        name: subhubName,
        slug: subhubSlug,
        path: buildSubhubPath(hubSlug, subhubSlug),
        description: subhubMetadata.description,
        pageIntro: subhubMetadata.pageIntro,
        metaDescription: subhubMetadata.metaDescription,
        flashcards: buildFlashcardLinks(slugs),
      };
    }),
  };
});

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

export const getFlashcardBreadcrumbs = (slug: string): FlashcardBreadcrumbSegment[] => {
  const segments: FlashcardBreadcrumbSegment[] = [
    { label: 'Home', href: '/' },
    { label: 'Flashcards', href: '/flashcards' },
  ];

  for (const hub of useCaseHubs) {
    const subhub = hub.subhubs.find((candidate) =>
      candidate.flashcards.some((flashcard) => flashcard.slug === slug)
    );

    if (!subhub) {
      continue;
    }

    const flashcard = subhub.flashcards.find((item) => item.slug === slug);

    segments.push({ label: hub.name, href: hub.path });
    segments.push({ label: subhub.name, href: subhub.path });
    segments.push({
      label: flashcard?.anchorText ?? flashcard?.title ?? humanize(slug),
    });

    return segments;
  }

  const fallbackTitle = flashcardPageMap.get(slug)?.title ?? humanize(slug);
  segments.push({ label: fallbackTitle });
  return segments;
};

export const flashcardsPillarMetadata: Metadata = {
  title: 'AI Flashcards & Study Generator | CogniGuide',
  description:
    'Learn how CogniGuide creates AI flashcards with spaced repetition, explore top study workflows, and jump into curated hubs for exams, languages, phonics, and K-5 skills.',
};

export const flashcardHierarchyMetadataBase: Metadata = {
  title: 'Flashcard Study Hubs | CogniGuide',
  description:
    'Browse AI flashcard hubs organized by exam prep, language learning, literacy, STEM, K-5 skills, and more specialized study goals.',
};

