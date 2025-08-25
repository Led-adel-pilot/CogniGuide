'use client';

import Link from 'next/link';
import { BrainCircuit, Zap } from 'lucide-react';
import posthog from 'posthog-js';

export default function PricingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-7 w-7 text-primary" />
          <Link
            href="/"
            className="text-2xl font-bold font-heading tracking-tighter"
            onClick={() => posthog.capture('pricing_header_logo_clicked')}
          >
            CogniGuide
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pricing" className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Pricing</Link>
          <Link
            href="/#generator"
            className="hidden sm:flex items-center justify-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
            onClick={() => posthog.capture('pricing_header_open_generator_clicked')}
          >
            <Zap className="h-4 w-4" />
            Open Generator
          </Link>
        </div>
      </div>
    </header>
  );
}


