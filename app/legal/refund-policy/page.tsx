import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Dispute Policy - CogniMap',
  description: 'Refunds and disputes for CogniMap subscriptions and purchases.',
};

const RefundPolicyPage = () => {
  return (
    <div className="bg-white text-gray-800 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Refund & Dispute Policy</h1>
        <div className="space-y-6 text-lg">
          <p>
            <strong>Last Updated:</strong> August 13, 2025
          </p>
          <p>
            CogniMap is a subscription software service that helps you transform notes and documents into interactive mind maps and flashcards.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-2">1. Eligibility</h2>
            <p>
              If the service does not work as described for you and our support team cannot resolve the issue, you may request a refund within 14 days of the initial purchase or renewal. We may ask for additional information to help diagnose the problem.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">2. Requests</h2>
            <p>
              To request a refund, contact our support team at{' '}
              <a href="mailto:cogniguide.dev@gmail.com" className="text-blue-600 hover:underline">
                cogniguide.dev@gmail.com
              </a>{' '}
              with your order email and a brief description of the issue.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">3. Chargebacks</h2>
            <p>
              If you believe a charge was made in error, please contact us first so we can help resolve it quickly. Unauthorized charges will be refunded.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">4. Exclusions</h2>
            <p>
              We do not offer refunds for partial billing periods or unused credits. Promotional credits are not refundable. CogniMap does not sell physical goods; returns do not apply.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
