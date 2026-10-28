import { SignIn } from "@clerk/nextjs";
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
export default function SignInPage() {
  if (!hasClerk) return <p className="p-8 text-sm text-neutral-500">Sign-in is not configured in this environment. Everything runs as one local user.</p>;
  return <div className="flex min-h-[60vh] items-center justify-center"><SignIn /></div>;
}
