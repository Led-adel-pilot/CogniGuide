'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import posthog from 'posthog-js';
import CogniGuideLogo from '../CogniGuide_logo.png';
import AuthModal from './AuthModal';

export default function PricingHeader() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <AuthModal open={showAuth} />
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
          <Link
            href="/"
            className="text-2xl font-bold font-heading tracking-tighter"
            onClick={() => posthog.capture('pricing_header_logo_clicked')}
          >
            CogniGuide
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAuth(true)}
            className="hidden sm:flex items-center justify-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            Sign up — Free
          </button>
        </div>
      </div>
    </header>
    </>
  );
}


