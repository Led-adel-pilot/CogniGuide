'use client';

import { Send } from 'lucide-react';

export default function ContactForm() {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); alert('This is a UI placeholder. Hook up your form handler.'); }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Your email</label>
        <input type="email" required placeholder="you@example.com" className="w-full rounded-[0.9rem] border p-3 focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Subject</label>
        <input type="text" required placeholder="How can we help?" className="w-full rounded-[0.9rem] border p-3 focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Message</label>
        <textarea required rows={5} placeholder="Describe your issue or question" className="w-full rounded-[0.9rem] border p-3 focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90">
        <Send className="h-4 w-4" />
        Send
      </button>
    </form>
  );
}
