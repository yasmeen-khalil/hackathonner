import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import DeadlineBar from "@/components/DeadlineBar";

export const metadata: Metadata = { title: "Hackathon companion", description: "Paste a hackathon's links, get a dashboard built for it." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <DeadlineBar />
        <div className="flex min-h-[calc(100vh-2.5rem)]">
          <Suspense fallback={<div className="md:w-44" />}><Nav /></Suspense>
          <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
