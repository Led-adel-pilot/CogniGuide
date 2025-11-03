import type { Metadata } from 'next';
import HowToStudyForExamsClient from './HowToStudyForExamsClient';

export const metadata: Metadata = {
  title: 'How to Study for Exams: 7 Techniques to Ace Your Next Test',
  description:
    "Tired of cramming? Learn how to study for exams effectively with 7 proven techniques. Study smarter, remember more, and ace your tests. Start learning now!",
};

export default function HowToStudyForExamsPage() {
  return <HowToStudyForExamsClient />;
}
