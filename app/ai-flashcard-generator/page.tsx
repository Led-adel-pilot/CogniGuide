import type { Metadata } from "next";
import FlashcardGeneratorLanding from "@/components/FlashcardGeneratorLanding";

export const metadata: Metadata = {
  title: "AI Flashcard Generator | Create Spaced-Repetition Flashcards from PDFs & Notes",
  description:
    "Upload your study material and instantly generate high-quality flashcards. CogniGuide uses AI + spaced repetition (FSRS) to help you remember more in less time.",
  alternates: { canonical: "https://yourdomain.com/ai-flashcard-generator" },
  keywords: [
    "ai flashcard generator",
    "ai flashcard maker",
    "flashcard generator",
    "free online flashcard maker",
    "flashcard maker online",
    "ai generated flashcards",
  ],
  openGraph: {
    title: "AI Flashcard Generator | CogniGuide",
    description:
      "Turn PDFs, slides, and notes into spaced-repetition flashcards powered by FSRS.",
    url: "https://yourdomain.com/ai-flashcard-generator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Flashcard Generator | CogniGuide",
    description:
      "Generate study flashcards from documents and remember more with FSRS.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <FlashcardGeneratorLanding />;
}
