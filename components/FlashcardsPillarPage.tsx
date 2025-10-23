import Link from 'next/link';
import { useCaseHubs } from '@/lib/programmatic/useCaseData';

const featureHighlights = [
  {
    title: 'Generate decks from any file',
    description:
      'Upload PDFs, DOCX, PPTX, text, or images and CogniGuide automatically extracts the key facts for question–answer cards.',
  },
  {
    title: 'Master content with spaced repetition',
    description:
      'Every deck uses an FSRS-based review schedule so you revisit information at the moment it is most likely to be forgotten.',
  },
  {
    title: 'Collaborate and share quickly',
    description:
      'Invite classmates or teammates, export decks, and embed flashcards anywhere your study group needs them.',
  },
];

const howItWorksSteps = [
  {
    title: 'Upload or paste your study material',
    description: 'Drop in PDFs, slides, notes, or copy/paste key topics so the AI has everything it needs.',
  },
  {
    title: 'Review the generated flashcards',
    description: 'CogniGuide drafts question–answer pairs, supporting images, and mnemonics that you can edit in seconds.',
  },
  {
    title: 'Study on autopilot',
    description: 'Launch review sessions that adapt to your memory curve, notifications, and upcoming exam date.',
  },
];

const credibilityPoints = [
  {
    title: 'Purpose-built for serious learners',
    description:
      'From MCAT to Mandarin, our templates cover exams, languages, phonics, STEM, and early education so each workflow starts with relevant prompts.',
  },
  {
    title: 'Keeps decks organised automatically',
    description:
      'Tag decks by subject, share with classmates, and sync progress across devices without hunting through spreadsheets or clunky imports.',
  },
  {
    title: 'Integrated with the rest of CogniGuide',
    description:
      'Turn mind maps into flashcards, save custom prompts, and jump between study modes without losing your history.',
  },
];

export default function FlashcardsPillarPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6 lg:px-8">
      <header className="space-y-6 text-center lg:text-left">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary/80">Active recall, streamlined</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Master active recall with AI flashcards built for spaced repetition
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          CogniGuide drafts decks in seconds so you can stay focused on spaced repetition sessions instead of spending hours
          writing cards.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-start">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Start for free
          </Link>
          <Link
            href="#flashcard-categories"
            className="inline-flex items-center justify-center rounded-full border border-border px-8 py-3 text-base font-semibold text-foreground transition hover:border-primary/60 hover:text-primary"
          >
            Explore flashcard hubs
          </Link>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {featureHighlights.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>

      <section id="flashcard-categories" className="space-y-6">
        <div className="text-center sm:text-left">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Jump into a flashcard hub</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Browse structured study hubs organised by exam type, language, literacy skill, and classroom focus. Each hub breaks
            down into subtopics with links to ready-to-use landing pages.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {useCaseHubs.map((hub) => (
            <Link
              key={hub.slug}
              href={hub.path}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow transition hover:border-primary/60 hover:bg-card/80"
            >
              <span className="text-xl font-semibold group-hover:text-primary">{hub.name}</span>
              <span className="mt-3 text-sm text-muted-foreground">{hub.menuDescription}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How the flashcard generator works</h2>
          <p className="text-lg text-muted-foreground">
            Every workflow is optimised for speed. Import material once, let AI draft the cards, and review on a schedule tuned to
            your memory.
          </p>
          <ol className="space-y-4">
            {howItWorksSteps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold">Build authority across every subject</h3>
          <p className="text-muted-foreground">
            The CogniGuide taxonomy keeps your programme tightly organised. Connect pillar hubs to subtopics and landing pages for
            the strongest possible internal linking structure.
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Exam prep:</span> GMAT, SAT, NCLEX, AWS, CompTIA, and more exam-focused
              flashcards with test day guidance.
            </li>
            <li>
              <span className="font-semibold text-foreground">Languages & culture:</span> Vocabulary decks for ESL, Spanish, French,
              Tagalog, Cantonese, Hindi, and cultural themes.
            </li>
            <li>
              <span className="font-semibold text-foreground">Literacy & phonics:</span> K-5 foundational skills from phonemes and
              sight words to comprehension practice.
            </li>
            <li>
              <span className="font-semibold text-foreground">STEM mastery:</span> Physics, biology, coding, and engineering concepts
              with definitions, visuals, and problem-solving prompts.
            </li>
          </ul>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full bg-muted px-6 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10"
          >
            View plans & credits
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why learners stick with CogniGuide</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {credibilityPoints.map((point) => (
            <div key={point.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{point.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{point.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-8 text-center sm:text-left">
        <p className="text-sm text-muted-foreground">
          Dive deeper into active recall strategies with our guide{' '}
          <Link href="https://claude.ai/public/artifacts/d4e61670-43bd-4a31-9787-2f6848d0f5d7" className="text-primary underline underline-offset-4">
            Active Recall and Flashcards: A Student&apos;s Guide to Effective Learning
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
