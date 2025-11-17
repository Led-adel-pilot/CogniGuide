import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - CogniGuide',
  description: 'The terms and conditions for using CogniGuide.',
};

const TermsPage = () => {
  return (
    <div className="bg-white text-gray-800 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Terms of Service</h1>
        <div className="space-y-6 text-lg">
          <p>
            <strong>Last Updated:</strong> August 13, 2025
          </p>
          <p>
            Please read these terms carefully. By accessing or using CogniGuide, you agree to be bound by these Terms of Service.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-2">1. Service Description</h2>
            <p>
              CogniGuide is an AI study tool that converts documents and notes into interactive mind maps and flashcards. Access is provided on a subscription basis with monthly credit allocations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">2. Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and for all activities that occur under it. You must provide accurate information and notify us of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">3. Acceptable Use</h2>
            <p>
              Do not misuse the service, attempt to reverse engineer, or use it to create harmful or illegal content. We may suspend or terminate access for violations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">4. Payments</h2>
            <p>
              Subscriptions renew automatically unless canceled. See our{' '}
              <Link href="/legal/cancellation-policy" className="text-blue-600 hover:underline">
                Cancellation Policy
              </Link>{' '}
              and{' '}
              <Link href="/legal/refund-policy" className="text-blue-600 hover:underline">
                Refund Policy
              </Link>{' '}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">5. Content</h2>
            <p>
              You retain ownership of your content. You grant us a limited license to process it for the purpose of providing the service. We do not claim any rights to your underlying materials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">6. Disclaimers</h2>
            <p>
              The service is provided "as is" without warranties of any kind. We do not guarantee accuracy or fitness for a particular purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">7. Liability</h2>
            <p>
              To the maximum extent permitted by law, we will not be liable for any indirect or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">8. Contact</h2>
            <p>
              Questions? Contact us at{' '}
              <a href="mailto:contact@cogniguide.app" className="text-blue-600 hover:underline">
                contact@cogniguide.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
