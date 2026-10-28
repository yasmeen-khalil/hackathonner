import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import DeadlineBar from "@/components/DeadlineBar";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = { title: "Hackathonner", description: "Paste a hackathon's links, get its brief, gameplan and countdown." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const inner = (
    <>
      <div className="flex items-stretch border-b border-neutral-200 bg-white">
        <div className="flex-1"><DeadlineBar /></div>
        {hasClerk && <div className="flex items-center border-l border-neutral-200 px-3"><SignedIn><UserButton /></SignedIn></div>}
      </div>
      <div className="flex min-h-[calc(100vh-2.5rem)]">
        <Suspense fallback={<div className="md:w-44" />}><Nav /></Suspense>
        <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
      </div>
    </>
  );
  return hasClerk ? <ClerkProvider>{inner}</ClerkProvider> : inner;
}
