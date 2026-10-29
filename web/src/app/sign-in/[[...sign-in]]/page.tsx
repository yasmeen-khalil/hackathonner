import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
export default function SignInPage() {
  if (!hasClerk) return <p className="p-8 text-sm text-[#6B6458]">Sign-in is not configured in this environment. Everything runs as one local user.</p>;
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 text-center">
      <div>
        <img src="/brand/wordmark.svg" alt="hackathonner." className="mx-auto h-9" />
        <p className="mt-1 text-sm text-[#6B6458]">Paste a hackathon's links. Get its brief, gameplan and countdown.</p>
      </div>
      <Suspense fallback={null}><SignIn /></Suspense>
    </div>
  );
}
