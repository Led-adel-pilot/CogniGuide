import { type ReactNode } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import CogniGuideLogo from '@/CogniGuide_logo.png';

export const metadata: Metadata = {
  title: 'How to Study for Exams: 7 Techniques to Ace Your Next Test',
  description:
    "Tired of cramming? Learn how to study for exams effectively with 7 proven techniques. Study smarter, remember more, and ace your tests. Start learning now!",
};

const UPDATED_AT = 'September 25, 2024';
const READING_TIME = '12 minute read';

const SectionHeading = ({
  number,
  children,
  className = 'mt-8 mb-4',
}: {
  number: string;
  children: ReactNode;
  className?: string;
}) => (
  <h2 className={`scroll-m-20 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl ${className}`}>
    <span className="mr-3 text-xl font-medium text-muted-foreground sm:text-2xl">{number}.</span>
    {children}
  </h2>
);

const HighlightCard = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) => {
  const toneStyles =
    tone === 'accent'
      ? 'border border-dashed border-primary/60 bg-primary/5'
      : 'border border-border/70 bg-muted/30';

  return (
    <div className={`mt-6 rounded-2xl p-6 shadow-sm backdrop-blur-sm ${toneStyles}`}>
      <p className="!m-0 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
};

export default function HowToStudyForExamsPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={32} height={32} className="h-8 w-8" />
            <span>CogniGuide</span>
          </Link>
        </div>
      </header>

      <main>
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-0">
          <header className="not-prose mb-12 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Study Skills
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
              How to Study for Exams and Actually Remember What You Learned
            </h1>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>By the CogniGuide Editorial Team</span>
              <span>Updated {UPDATED_AT}</span>
              <span>{READING_TIME}</span>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Exam weeks rarely arrive quietly. Notes pile up, deadlines press in, and the temptation to cram grows louder by the
              hour. The students who thrive do something different—they build repeatable habits that keep their knowledge fresh.
              These seven techniques can help you do the same, no marathon study session required.
            </p>
          </header>

          <div className="prose prose-lg prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:text-foreground prose-strong:text-foreground prose-a:text-primary max-w-none">
            <blockquote>
              <p>
                Studying is a craft. The more intentionally you design your process, the more your brain rewards you with lasting
                memories.
              </p>
            </blockquote>

            <SectionHeading number="1">
              Start with a study game plan
            </SectionHeading>
            <p>
              Before touching your notes, take ten minutes to map the terrain. List the topics you expect to see, the formats you
              will encounter (multiple choice, essays, problem sets), and how confident you feel about each one. A quick plan keeps
              you from spending hours polishing what you already know while ignoring the material that still feels shaky.
            </p>
            <HighlightCard>
              <span className="font-semibold text-foreground">Try this:</span> Open a blank document and split it into three
              columns—topics, confidence, and next action. Revisit the list at the end of each day to mark progress and adjust
              priorities.
            </HighlightCard>

            <SectionHeading number="2">Lean on active recall instead of rereading</SectionHeading>
            <p>
              Rereading notes feels productive because it is familiar. Active recall, on the other hand, asks you to close the
              book and bring an answer forward from memory. The tiny moment of discomfort when you cannot remember something is
              the signal that learning is about to happen—your brain strengthens the pathways each time you try again.
            </p>
            <ul>
              <li>Summarize a concept out loud without looking at your notes.</li>
              <li>Write down everything you remember about a chapter, then compare it with the original material.</li>
              <li>Create or answer practice questions that force you to explain the why behind each answer.</li>
            </ul>
            <HighlightCard tone="accent">
              <span className="font-semibold text-foreground">CogniGuide in your corner:</span> Upload a lecture deck or study
              guide and let CogniGuide generate interactive flashcards so the recall practice is ready whenever you are.
            </HighlightCard>

            <SectionHeading number="3">Space your reviews to beat the forgetting curve</SectionHeading>
            <p>
              Our brains are wired to forget what they do not revisit. Spaced repetition counters this by returning to the same
              idea over gradually longer intervals. A quick review one day after learning something, then again three days later,
              keeps the concept alive without requiring marathon study blocks.
            </p>
            <p>
              Schedule short refreshers on the concepts you rated as “needs work” in your study plan. You can use calendar
              reminders, a spreadsheet, or a spaced repetition app—what matters most is seeing the material again before it fades.
            </p>
            <HighlightCard>
              <span className="font-semibold text-foreground">Need a hand?</span> CogniGuide tracks which flashcards you are
              about to forget and resurfaces them automatically, saving you from building a complex schedule on your own.
            </HighlightCard>

            <SectionHeading number="4">Map difficult subjects to see how ideas connect</SectionHeading>
            <p>
              Some topics refuse to stay linear. Mind mapping gives you a bird’s-eye view of a chapter by placing the main idea in
              the center and branching out to supporting concepts, examples, and exceptions. The visual format mirrors the way the
              brain links ideas, making it easier to recall during a timed exam.
            </p>
            <p>
              Start with a blank page (digital or paper), write the course theme in the middle, and draw branches for subtopics.
              Add keywords or icons to mark where concepts overlap. When the page starts to feel crowded, you know it is time to
              consolidate or review.
            </p>
            <HighlightCard tone="accent">
              <span className="font-semibold text-foreground">Shortcut:</span> CogniGuide can turn lengthy notes into ready-made
              mind maps, which you can then edit or expand with your own insights.
            </HighlightCard>

            <SectionHeading number="5">Teach what you learn using the Feynman Technique</SectionHeading>
            <p>
              Richard Feynman famously advised explaining a topic to a curious child. Strip out jargon, rely on analogies, and keep
              refining your explanation until it holds together. When you stumble, you have discovered the next concept to revisit.
            </p>
            <p>
              Keep a running document of “explainer paragraphs” for each unit. If you cannot write a clear, four-sentence answer to
              an imagined question, you likely need to revisit your notes or ask for clarification from a professor or classmate.
            </p>

            <SectionHeading number="6">Work in focused bursts with the Pomodoro Technique</SectionHeading>
            <p>
              Long study sessions invite distraction. Instead, set a timer for 25 minutes and commit fully to a single task. When the
              timer ends, take a five-minute break to stretch, refill your water, or check your phone. After four sessions, enjoy a
              longer reset of fifteen to thirty minutes. The rhythm keeps your brain fresh while still covering hours of material in
              a day.
            </p>
            <p>
              If 25 minutes feels too long, start with 15 or even 10. The point is not the number but the promise that deep focus is
              temporary—and therefore manageable.
            </p>

            <SectionHeading number="7">Shape your environment for calmer focus</SectionHeading>
            <p>
              Set aside a dedicated spot for studying, even if it is just a cleared corner of the kitchen table. Place the materials
              you need within reach, silence or move your phone, and remove any visual clutter. Students managing ADHD often find
              that small environmental tweaks produce an outsized boost in concentration.
            </p>
            <ul>
              <li>Use noise-cancelling headphones or ambient playlists to block competing sounds.</li>
              <li>Keep a capture pad nearby to jot down distracting thoughts or to-dos without abandoning your session.</li>
              <li>End each study block by resetting the space so it is ready for the next one.</li>
            </ul>

            <h2 className="mt-20 scroll-m-20 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl mb-8">
              Frequently asked questions
            </h2>
            <div className="not-prose divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-background">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                  <span>What is the most effective method for studying?</span>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Active strategies beat passive review every time. Techniques like active recall, spaced repetition, and teaching
                    concepts to someone else force you to retrieve information and explain it—two of the strongest signals you can send
                    to your brain that the material matters.
                  </p>
                </div>
              </details>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                  <span>What is the 2-3-5-7 study method?</span>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    It is a spaced repetition schedule that prompts you to review material seven, five, three, and two days before a big
                    assessment. The decreasing intervals keep topics active just before you need them most.
                  </p>
                </div>
              </details>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                  <span>How many hours should I study each day?</span>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Quality matters more than raw hours. Many college students aim for two to three hours of focused study per credit hour
                    each week, but the right number depends on the difficulty of the course and how efficiently you can stay engaged during
                    each block.
                  </p>
                </div>
              </details>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-lg font-semibold text-foreground transition-colors hover:text-primary group-open:text-primary">
                  <span>How do I study without forgetting everything later?</span>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Pair spaced repetition with active recall. Review a topic before it slips away, test yourself without notes, and protect
                    your sleep—memory consolidation happens overnight, not during the final cram session.
                  </p>
                </div>
              </details>
            </div>
          </div>

          <section className="not-prose mt-16 rounded-3xl border border-border bg-muted/40 p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
              Keep your momentum going
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Studying well is rarely about a single dramatic shift. It is the combination of small, repeatable systems—recall
              prompts, spaced reviews, tidy notes, and focused time—that make exam week feel manageable. CogniGuide was built to
              support that routine by turning your documents into flashcards, maps, and review plans with just a few clicks.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              When you are ready to lighten the administrative load of studying,{' '}
              <Link
                href="/"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                explore CogniGuide for free
              </Link>{' '}
              and keep your focus on learning, not logistics.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}




