import Link from 'next/link';
import ContactForm from './ContactForm';

export const metadata = {
  title: 'Contact — CogniGuide',
  description: 'Contact CogniGuide customer support.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="py-16">
        <div className="container max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold font-heading tracking-tight mb-4">Contact Us</h1>
          <p className="text-muted-foreground mb-8">
            Have a question about CogniGuide or your subscription? Reach out and we’ll get back to you as soon as possible.
          </p>

          <div className="rounded-[1.25rem] border bg-background p-6 shadow-sm mb-8">
            <h2 className="font-heading font-semibold mb-2">Customer Support</h2>
            <p className="text-sm text-muted-foreground">
              Email us at: <a className="underline" href="mailto:cogniguide.dev@gmail.com">cogniguide.dev@gmail.com</a>
            </p>
          </div>

          <div className="rounded-[1.25rem] border bg-background p-6 shadow-sm">
            <h2 className="font-heading font-semibold mb-4">Send us a message</h2>
            <ContactForm />
          </div>

          <div className="text-sm text-muted-foreground mt-8">
            Looking for pricing? <Link className="underline" href="/pricing">See plans</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
