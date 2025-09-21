import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How to Study for Exams: 7 Techniques to Ace Your Next Test',
  description: 'Tired of cramming? Learn how to study for exams effectively with 7 proven techniques. Study smarter, remember more, and ace your tests. Start learning now!',
};

export default function HowToStudyForExamsPage() {
  return (
    <div className="bg-background text-foreground font-sans leading-relaxed min-h-screen">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <article className="prose lg:prose-lg xl:prose-xl max-w-none">
          <header className="text-center mb-12">
            <div className="inline-block p-1 bg-primary rounded-lg mb-6">
              <div className="bg-primary-foreground px-4 py-2 rounded-lg">
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">Study Guide</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              How to Study for Exams and Actually Remember What You Learned
            </h1>
            <div className="w-24 h-1 bg-border mx-auto rounded-full"></div>
          </header>

          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            That feeling of dread. You’re staring at a mountain of textbooks, lecture notes are spilling off your desk, and the exam date is looming closer and closer. For the "Overwhelmed Student," this scene is all too familiar. You pour in hours of highlighting and rereading, only to feel like you forget everything the moment you walk into the exam hall.
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            What if there was a better way? A way to study <em className="text-foreground font-semibold">smarter</em>, not just harder?
          </p>

          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            The good news is, there is. Effective studying isn't about brute force; it's about using proven techniques that work <em className="text-foreground font-semibold">with</em> your brain's natural learning processes. In this guide, we'll walk you through seven powerful strategies to help you conquer your exams, reduce stress, and retain information long-term.
          </p>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">1</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Active Recall: The Anti-Passive Study Method
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              The single biggest mistake students make is passively reviewing material. Rereading notes, highlighting, and watching lectures are not effective ways to build strong memories. The key is <strong className="text-foreground bg-muted px-2 py-1 rounded">active recall</strong>, which means actively retrieving information from your memory.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">What it is:</strong> Active recall is the process of deliberately trying to remember information without looking at your notes. This could be through flashcards, practice questions, or simply closing your book and summarizing a concept out loud.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">Why it works:</strong> Every time you force your brain to retrieve a piece of information, you strengthen the neural pathways associated with it, making it easier to recall in the future.
                </div>
              </li>
            </ul>

            <div className="mt-8 bg-muted rounded-xl p-6 border border-border">
              <h3 className="text-2xl font-bold mb-4 text-foreground flex items-center">
                <span className="w-8 h-8 border-2 border-border rounded-full flex items-center justify-center mr-3 bg-muted text-muted-foreground font-bold text-sm">⚡</span>
                The Manual Way vs. The Smart Way
              </h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  <strong className="bg-muted px-2 py-1 rounded text-foreground">Manual Effort:</strong> You could spend hours creating physical flashcards for every key concept in your textbook. You'd write a question on one side and the answer on the other.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-red-100 px-2 py-1 rounded text-red-700">The Inefficiency:</strong> For dense subjects with hundreds of key terms, this is incredibly time-consuming. It's also difficult to shuffle and organize them effectively as your pile of cards grows.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-blue-100 px-2 py-1 rounded text-blue-700">CogniGuide as the Solution:</strong> This is where an AI tool like CogniGuide can revolutionize your workflow. Simply upload your lecture notes or textbook chapter, and CogniGuide will automatically generate interactive, spaced repetition flashcards. It takes the manual labor out of creating study materials so you can focus on the most important part: learning.
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-primary rounded-xl text-primary-foreground">
              <p className="text-lg font-semibold text-center">
                Ready to stop cramming and start learning?{' '}
                <Link href="/" className="underline hover:text-primary-foreground/80 font-bold">
                  Sign up for CogniGuide for free
                </Link>{' '}
                and turn your documents into powerful study tools in seconds.
              </p>
            </div>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">2</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Spaced Repetition: Beat the Forgetting Curve
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Have you ever crammed for a test, only to forget everything a week later? That's the <strong className="text-foreground bg-muted px-2 py-1 rounded">"forgetting curve"</strong> in action. Spaced repetition is a scientifically proven method to combat this by reviewing information at increasing intervals.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">What it is:</strong> Instead of reviewing a topic repeatedly in one sitting, you space out your review sessions over time. For example, you might review a concept one day after learning it, then three days later, then a week later, and so on.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">Why it works:</strong> This technique interrupts the forgetting process and signals to your brain that this information is important and should be moved to long-term memory.
                </div>
              </li>
            </ul>

            <div className="mt-8 bg-muted rounded-xl p-6 border border-border">
              <h3 className="text-2xl font-bold mb-4 text-foreground flex items-center">
                <span className="w-8 h-8 border-2 border-border rounded-full flex items-center justify-center mr-3 bg-muted text-muted-foreground font-bold text-sm">🔄</span>
                The Manual Way vs. The Smart Way
              </h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  <strong className="bg-muted px-2 py-1 rounded text-foreground">Manual Effort:</strong> You could try to create a complex calendar system to keep track of when to review each topic for every class. You might use a system like the 2-3-5-7 method, where you review material 2, 3, 5, and 7 days before an exam.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-red-100 px-2 py-1 rounded text-red-700">The Inefficiency:</strong> Manually tracking dozens of topics with different review schedules is a logistical nightmare. It's easy to lose track, and the planning itself can become a source of stress.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-blue-100 px-2 py-1 rounded text-blue-700">CogniGuide as the Solution:</strong> CogniGuide's flashcard system has spaced repetition built-in. The AI automatically schedules your reviews, showing you the information you're about to forget at the perfect time. It takes the guesswork out of studying and ensures your revision is always optimized for long-term retention. <a href="#" className="text-muted-foreground hover:underline">[Link to: Spaced Repetition Guide]</a>
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">3</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Mind Mapping: Visualize Complex Connections
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Some topics are too complex for linear notes. Mind mapping is a visual thinking tool that helps you organize information, see the bigger picture, and make connections between different ideas.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">What it is:</strong> A mind map starts with a central concept in the middle of the page, and related ideas branch out from there. It uses keywords, images, and colors to create a visual representation of a topic.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  <div className="w-3 h-3 bg-foreground rounded-full"></div>
                </div>
                <div>
                  <strong className="text-foreground">Why it works:</strong> Mind maps mirror how our brains naturally think—by making associations. This visual approach can improve memory and help you understand the relationships between different concepts.
                </div>
              </li>
            </ul>

            <div className="mt-8 bg-muted rounded-xl p-6 border border-border">
              <h3 className="text-2xl font-bold mb-4 text-foreground flex items-center">
                <span className="w-8 h-8 border-2 border-border rounded-full flex items-center justify-center mr-3 bg-muted text-muted-foreground font-bold text-sm">🗺️</span>
                The Manual Way vs. The Smart Way
              </h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  <strong className="bg-muted px-2 py-1 rounded text-foreground">Manual Effort:</strong> You can draw a mind map with pen and paper. You'd start with your main topic and spend time brainstorming and drawing connections to subtopics.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-red-100 px-2 py-1 rounded text-red-700">The Inefficiency:</strong> While effective, creating a detailed mind map for a long document or a dense chapter can be a slow process. It can also get messy and be difficult to edit or add to later.
                </p>
                <p className="text-muted-foreground">
                  <strong className="bg-blue-100 px-2 py-1 rounded text-blue-700">CogniGuide as the Solution:</strong> To automate this process, you can use CogniGuide to instantly generate a mind map from any document. Upload your research paper, article, or notes, and the AI will extract the core concepts and visually map their connections. It's the perfect way to get a quick, comprehensive overview of any topic.
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-primary rounded-xl text-primary-foreground">
                <p className="text-lg font-semibold text-center">
                    Transform your study sessions from passive to active.{' '}
                    <Link href="/" className="underline hover:text-primary-foreground/80 font-bold">
                        Create your first AI-powered mind map with CogniGuide for free today!
                    </Link>
                </p>
            </div>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">4</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                The Feynman Technique: Understand to Explain
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Nobel Prize-winning physicist <strong className="text-foreground bg-muted px-2 py-1 rounded">Richard Feynman</strong> had a simple method for learning anything: try to explain it to a child. If you can't explain a concept in simple terms, you don't truly understand it yet.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">What it is:</strong> The Feynman Technique has four steps:
                        <ol className="list-decimal list-inside ml-6 mt-4 space-y-2">
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg">Choose a concept you want to learn.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg">Pretend you are teaching it to a 12-year-old, using simple language.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg">Identify gaps in your understanding where your explanation is shaky.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg">Go back to the source material to fill those gaps, then simplify your explanation again.</li>
                        </ol>
                    </div>
                </li>
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">Why it works:</strong> This technique forces you to move beyond memorizing jargon and truly grapple with the underlying concepts until you can articulate them clearly.
                    </div>
                </li>
            </ul>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">5</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                The Pomodoro Technique: Focused Bursts of Study
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              If you struggle with focus, especially when dealing with <strong className="text-foreground bg-muted px-2 py-1 rounded">ADHD</strong>, the Pomodoro Technique can be a game-changer. It's a time management method that breaks work into focused intervals.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">What it is:</strong> You study in 25-minute, distraction-free blocks (called "Pomodoros"), separated by short 5-minute breaks. After four Pomodoros, you take a longer break of 15-30 minutes.
                    </div>
                </li>
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">Why it works:</strong> This method helps prevent burnout, reduces procrastination, and trains your brain to stay focused for short, manageable periods.
                    </div>
                </li>
            </ul>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">6</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                The SQ3R Method: A Smarter Way to Read
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              <strong className="text-foreground bg-muted px-2 py-1 rounded">SQ3R</strong> is a reading comprehension technique that turns passive reading into an active study session. The acronym stands for <strong className="text-foreground">Survey, Question, Read, Recite, and Review</strong>.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">What it is:</strong>
                        <ol className="list-decimal list-inside ml-6 mt-4 space-y-2">
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg"><strong className="text-foreground">Survey:</strong> Skim the chapter headings and summaries to get an overview.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg"><strong className="text-foreground">Question:</strong> Turn headings into questions to guide your reading.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg"><strong className="text-foreground">Read:</strong> Read the text to find the answers to your questions.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg"><strong className="text-foreground">Recite:</strong> Summarize what you've just read in your own words.</li>
                            <li className="text-muted-foreground bg-muted px-3 py-1 rounded-lg"><strong className="text-foreground">Review:</strong> Look back over your notes and the chapter to solidify your understanding.</li>
                        </ol>
                    </div>
                </li>
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">Why it works:</strong> This active approach engages your brain on multiple levels, significantly improving retention compared to just reading.
                    </div>
                </li>
            </ul>
          </section>

          <section className="mt-16 border-l-8 border-border pl-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                <span className="text-primary-foreground font-bold text-xl">7</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Organization and Environment: Set Yourself Up for Success
              </h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Your study environment and level of organization play a huge role in your effectiveness. For students with <strong className="text-foreground bg-muted px-2 py-1 rounded">ADHD</strong>, minimizing distractions and having a clear system is crucial.
            </p>
            <ul className="space-y-4 text-lg text-muted-foreground">
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">What it is:</strong> This involves creating a dedicated, quiet study space, turning off phone notifications, and organizing your notes and materials.
                    </div>
                </li>
                <li className="flex items-start">
                    <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <div className="w-3 h-3 bg-foreground rounded-full"></div>
                    </div>
                    <div>
                        <strong className="text-foreground">Why it works:</strong> A clean, organized space reduces cognitive load and minimizes potential distractions, allowing you to dedicate all your mental energy to the task at hand.
                    </div>
                </li>
            </ul>
          </section>

          <section className="mt-16">
            <div className="text-center mb-8">
              <h3 className="text-4xl font-bold text-foreground mb-4">
                Frequently Asked Questions
              </h3>
              <div className="w-24 h-1 bg-border mx-auto rounded-full"></div>
            </div>
            <div className="space-y-8">
              <div className="border-l-4 border-border pl-6">
                <h4 className="font-bold text-xl text-foreground mb-3">
                  What is the best method for studying?
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  The most effective methods are <strong className="text-foreground">active, not passive</strong>. Techniques like Active Recall, Spaced Repetition, and the Feynman Technique, which force your brain to engage with the material, are far superior to simply rereading notes.
                </p>
              </div>
              <div className="border-l-4 border-border pl-6">
                <h4 className="font-bold text-xl text-foreground mb-3">
                  What is the 2 3 5 7 study method?
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  The <strong className="text-foreground bg-muted px-2 py-1 rounded">2-3-5-7 method</strong> is a form of spaced repetition where you plan your revision sessions to occur 7, 5, 3, and 2 days before your exam. It's a structured way to fight the forgetting curve.
                </p>
              </div>
              <div className="border-l-4 border-border pl-6">
                <h4 className="font-bold text-xl text-foreground mb-3">
                  How many hours a day to study?
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  There is no magic number, as it depends on your course load and personal efficiency. However, many sources suggest that for college students, <strong className="text-foreground">2-3 hours of study time per credit hour each week</strong> is a good benchmark. This could translate to 4-6 hours per day. The quality and focus of your study time are more important than the sheer number of hours.
                </p>
              </div>
              <div className="border-l-4 border-border pl-6">
                <h4 className="font-bold text-xl text-foreground mb-3">
                  How to study without forgetting?
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  To avoid forgetting, you must move information into your <strong className="text-foreground">long-term memory</strong>. The key is to use spaced repetition to review material at strategic intervals and active recall to constantly test your memory. Getting enough sleep is also critical, as it's during sleep that your brain consolidates memories.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 text-center bg-primary rounded-3xl p-12 text-primary-foreground">
            <div className="inline-block p-1 bg-primary-foreground/20 rounded-lg mb-6">
              <div className="bg-primary-foreground px-6 py-2 rounded-lg">
                <span className="text-lg font-bold text-primary uppercase tracking-wide">🎓 Study Smarter</span>
              </div>
            </div>
            <h2 className="text-5xl font-bold mb-6 text-primary-foreground">
              Your Ultimate Study Partner
            </h2>
            <p className="text-xl text-primary-foreground/90 leading-relaxed mb-4 max-w-3xl mx-auto">
              Feeling overwhelmed by exams is a sign that your current study methods aren't working for you. It's time to stop the cycle of cramming and forgetting. By embracing active, efficient techniques, you can walk into your next exam with confidence.
            </p>
            <p className="text-xl text-primary-foreground/90 leading-relaxed mb-8 max-w-3xl mx-auto">
              <strong className="text-primary-foreground">CogniGuide</strong> was built for the overwhelmed student. It automates the most time-consuming parts of studying—creating flashcards and visualizing concepts—so you can spend your time on what matters most: understanding and remembering.
            </p>
            <div className="mb-6">
              <Link href="/" className="inline-block bg-primary-foreground text-primary font-bold py-4 px-10 rounded-full hover:bg-primary-foreground/90 transition-colors duration-300 text-xl shadow-lg hover:shadow-xl">
                🚀 Sign up for CogniGuide for free
              </Link>
            </div>
            <p className="text-lg text-primary-foreground/80">
              Revolutionize how you study for exams and learn smarter, faster, and more effectively.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
