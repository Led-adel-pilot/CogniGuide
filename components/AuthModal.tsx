'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Mail, LogIn } from 'lucide-react';
import posthog from 'posthog-js';

interface AuthModalProps {
  open: boolean;
}

export default function AuthModal({ open }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setMessage(null);
      setError(null);
    }
  }, [open]);

  const handleEmailMagicLink = async () => {
    try {
      setIsSending(true);
      setError(null);
      setMessage(null);
      const upgrade = typeof window !== 'undefined' && localStorage.getItem('cogniguide_upgrade_flow') === 'true';
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard${upgrade ? '?upgrade=true' : ''}`,
        },
      });
      if (signInError) throw signInError;
      setMessage('Check your email for the sign-in link.');

      // Track user signup event
      posthog.capture('user_signed_up', {
        method: 'email'
      });
    } catch (error: any) {
      setError(error.message || 'Failed to send magic link');
    } finally {
      setIsSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Track user signup event
    posthog.capture('user_signed_up', {
      method: 'google'
    });

    const upgrade = typeof window !== 'undefined' && localStorage.getItem('cogniguide_upgrade_flow') === 'true';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard${upgrade ? '?upgrade=true' : ''}` },
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-background border w-full max-w-[460px] rounded-[1.5rem] shadow-2xl p-6 relative">
        <h2 className="text-xl font-bold mb-2">Create a free account</h2>
        <p className="text-sm text-muted-foreground mb-4">Sign up to continue generating and save your history.</p>

        {message && <div className="mb-3 text-sm text-green-100 bg-green-600 border border-green-700 dark:text-green-800 dark:bg-green-100 dark:border-green-200 rounded p-2">{message}</div>}
        {error && <div className="mb-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded p-2">{error}</div>}

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-0 flex-grow border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleEmailMagicLink}
              disabled={isSending || !email}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-full disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              Send Link
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-muted" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-muted" />
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2 border rounded-full hover:bg-muted/50"
          >
            <img alt="Google" src="https://www.google.com/favicon.ico" className="h-4 w-4" />
            <span>Continue with Google</span>
          </button>

          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <LogIn className="h-3 w-3" />
            Already have an account? Use the same options to sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
