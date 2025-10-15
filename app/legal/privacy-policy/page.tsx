import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - CogniGuide',
  description: 'Privacy Policy for CogniGuide.',
};

const PrivacyPolicyPage = () => {
  return (
    <div className="bg-white text-gray-800 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-lg">
          <p>
            <strong>Last Updated:</strong> August 13, 2025
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-2">1. Introduction</h2>
            <p>
              Welcome to CogniGuide ("we," "our," "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">2. Information We Collect</h2>
            <p>
              We may collect information about you in a variety of ways. The information we may collect on the Service includes:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, that you voluntarily give to us when you register with the Service.
              </li>
              <li>
                <strong>Uploaded Content:</strong> Documents, images, and text prompts you upload for the purpose of generating mind maps or flashcards. This content is processed by our AI service providers (e.g., Google Gemini) to provide the core functionality of our service.
              </li>
              <li>
                <strong>Usage Data:</strong> Information our servers automatically collect when you access the Service, such as your IP address, browser type, operating system, access times, and the pages you have viewed directly before and after accessing the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">3. Use of Your Information</h2>
            <p>
              Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Service to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Create and manage your account.</li>
              <li>Process your uploaded content to generate mind maps and flashcards.</li>
              <li>Email you regarding your account or order.</li>
              <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
              <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-2">4. Data Processing and Third-Party Services</h2>
             <p>
              To provide our services, we use third-party vendors for payment processing and AI model hosting.
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong>Payment Processing:</strong> We use Paddle for payment processing. We do not store or collect your payment card details. That information is provided directly to Paddle, whose use of your personal information is governed by their Privacy Policy.
              </li>
               <li>
                <strong>AI Services:</strong> We use Google's Gemini API to process the content you upload. Your content is sent to their servers for analysis to generate the mind maps and flashcards. We do not use your content to train our models. Please refer to the privacy policies of our AI service providers for more information on their data handling practices.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">5. Security of Your Information</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-2">6. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:contact@cogniguide.app" className="text-blue-600 hover:underline">contact@cogniguide.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
