import PricingClient from '../../components/PricingClient';
import PricingHeader from '../../components/PricingHeader';

export const metadata = {
  title: 'Pricing — CogniGuide',
  description:
    'Compare CogniGuide plans. Free, Student, and Pro tiers with monthly credits to turn notes and documents into mind maps and flashcards.',
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PricingHeader />

      <main className="flex-1 pt-8">
        {/* Plans + Paddle integration */}
        <PricingClient />
      </main>
    </div>
  );
}
