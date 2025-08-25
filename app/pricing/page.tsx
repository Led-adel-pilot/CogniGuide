import Link from 'next/link';
import { BrainCircuit, Zap, Check } from 'lucide-react';
import PricingClient from '../../components/PricingClient';
import posthog from 'posthog-js';

export const metadata = {
  title: 'Pricing — CogniGuide',
  description:
    'Compare CogniGuide plans. Free, Student, and Pro tiers with monthly credits to turn notes and documents into mind maps and flashcards.',
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header (lightweight copy for this page) */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-7 w-7 text-primary" />
            <Link href="/" className="text-2xl font-bold font-heading tracking-tighter" onClick={() => posthog.capture('pricing_header_logo_clicked')}>CogniGuide</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Pricing</Link>
            <Link href="/#generator" className="hidden sm:flex items-center justify-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105" onClick={() => posthog.capture('pricing_header_open_generator_clicked')}>
              <Zap className="h-4 w-4" />
              Open Generator
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-8">
        {/* Plans + Paddle integration */}
        <PricingClient />
      </main>
    </div>
  );
}
