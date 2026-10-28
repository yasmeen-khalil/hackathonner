// Next.js 16 calls this file proxy.ts (it was middleware.ts before). Clerk protects every route except sign-in.
// When no Clerk key is configured (a judge running the repo locally), everything is open and the user is "local".
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export default function proxy(req: Parameters<typeof withClerk>[0], evt: Parameters<typeof withClerk>[1]) {
  return hasClerk ? withClerk(req, evt) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
