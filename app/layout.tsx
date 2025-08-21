import type { Metadata } from "next";
import "./globals.css";
import { Poppins } from "next/font/google";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CogniGuide",
  description: "Your AI study guide: turn notes and documents into mind maps and flashcards, and prepare for exams.",
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: [
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head></head>
      <body className={`${poppins.className} flex min-h-screen flex-col bg-background text-foreground`}>
        <main className="flex-1">{children}</main>
        
        <div id="modal-root" />
      </body>
    </html>
  );
}
