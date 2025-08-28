'use client';

import FlashcardsModal, { type Flashcard } from '@/components/FlashcardsModal';

const sampleFlashcards: Flashcard[] = [
    {
        "question": "What is Active Recall?",
        "answer": "A learning method where you actively stimulate your memory for a piece of information, rather than passively reviewing it."
    },
    {
        "question": "How does Active Recall improve learning?",
        "answer": "It strengthens memory traces and makes them easier to retrieve in the future. It's more effective than passive review."
    },
    {
        "question": "Give an example of Active Recall.",
        "answer": "Trying to remember the answer to a question without looking at your notes, or using flashcards."
    },
    {
        "question": "What is Spaced Repetition?",
        "answer": "A learning technique that involves reviewing information at increasing intervals over time."
    },
    {
        "question": "What is the 'spacing effect'?",
        "answer": "The psychological phenomenon that underpins Spaced Repetition, where learning is greater when studying is spread out over time."
    },
    {
        "question": "How does Spaced Repetition help with long-term memory?",
        "answer": "By reviewing information just as you're about to forget it, it strengthens long-term memory consolidation."
    },
    {
        "question": "What is a common tool for implementing Spaced Repetition?",
        "answer": "Spaced Repetition System (SRS) software, like Anki or Quizlet, or physical flashcard systems like the Leitner system."
    },
    {
        "question": "How do Active Recall and Spaced Repetition work together?",
        "answer": "They are a powerful combination. You use Active Recall to test yourself on flashcards, and a Spaced Repetition schedule determines when you see each card."
    },
    {
        "question": "What is a major benefit of using Active Recall and Spaced Repetition for studying?",
        "answer": "It leads to more efficient and effective learning, resulting in better long-term retention of information compared to cramming."
    },
    {
        "question": "Why is rereading notes considered a less effective study method?",
        "answer": "It's a passive activity that doesn't engage active recall, leading to an illusion of competence without deep learning."
    }
];

export default function EmbeddedFlashcards() {
    return (
        <FlashcardsModal
            open={true}
            isEmbedded={true}
            cards={sampleFlashcards}
            title="Sample Flashcards"
            onClose={() => {}}
        />
    );
}
