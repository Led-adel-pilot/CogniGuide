import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cancellation Policy - CogniMap',
  description: 'How to cancel your CogniMap subscription and what happens after cancellation.',
};

const CancellationPolicyPage = () => {
  return (
    <div className="bg-white text-gray-800 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Cancellation Policy</h1>
        <div className="space-y-6 text-lg">
          <p>
            <strong>Last Updated:</strong> August 13, 2025
          </p>
          <p>
            You can cancel your subscription at any time. Cancellation stops future renewals. Your access remains active until the end of the current billing period.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-2">1. How to Cancel</h2>
            <p>
              You can cancel from your account billing portal (if enabled) or by contacting our support team at{' '}
              <a href="mailto:contact@cogniguide.app" className="text-blue-600 hover:underline">
                contact@cogniguide.app
              </a>{' '}
              using your purchase email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">2. Renewals & Billing Cycles</h2>
            <p>
              We bill in advance for the upcoming period (monthly or annually). When you cancel, you will not be charged again. Your plan remains active until the end of the current paid period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">3. Proration</h2>
            <p>
              We do not prorate refunds for unused time. If required by local law, we will comply accordingly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">4. Account Deletion vs. Cancellation</h2>
            <p>
              Cancellation stops future billing but retains your account and data. If you need your account and data deleted, please contact support and we will process your request in accordance with our data retention policies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CancellationPolicyPage;
