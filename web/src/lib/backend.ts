// Server-only helper: talk to the Python API with the shared secret on behalf of a user.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";
export async function backend(userId: string, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { "X-User-Id": userId, "X-API-Key": process.env.BACKEND_SECRET || "", ...(init.headers as Record<string, string> || {}) };
  if (init.body && !headers["content-type"]) headers["content-type"] = "application/json";
  const r = await fetch(`${BACKEND}${path}`, { ...init, headers, cache: "no-store" });
  if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
export async function currentUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return "local";
  const { auth } = await import("@clerk/nextjs/server");
  return (await auth()).userId;
}
