import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import DeadlineBar from "@/components/DeadlineBar";
import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = { title: "Hackathonner", description: "Paste a hackathon's links, get its brief, gameplan and countdown." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#1A1712] antialiased">
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
        {hasClerk && <div className="flex items-center px-3"><Suspense fallback={null}><Show when="signed-in"><UserButton /></Show></Suspense></div>}
      </div>
      <div className="flex min-h-[calc(100vh-44px)]">
        <Suspense fallback={<div className="md:w-44" />}><Nav /></Suspense>
        <main className="flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10">{children}</main>
      </div>
    </>
  );
  return hasClerk ? <ClerkProvider>{inner}</ClerkProvider> : inner;
}
