// The only door to the Python API. Checks the Clerk session, forwards the request with the shared secret and the
// user id, and streams the response back (the brief arrives as server-sent events).
import { NextRequest } from "next/server";

export const maxDuration = 300;

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

async function userId(): Promise<string | null> {
  if (!hasClerk) return "local";
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const uid = await userId();
  if (!uid) return new Response("Unauthorized", { status: 401 });
  const { path } = await ctx.params;
  const url = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = { "X-User-Id": uid, "X-API-Key": process.env.BACKEND_SECRET || "" };
  for (const h of ["content-type", "accept"]) { const v = req.headers.get(h); if (v) headers[h] = v; }
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  let upstream: Response;
  try {
    upstream = await fetch(url, { method: req.method, headers, body, cache: "no-store" });
  } catch (e) {
    return new Response(`The API is unreachable at ${BACKEND}: ${String(e)}`, { status: 502 });
  }
  const out = new Headers();
  for (const h of ["content-type", "cache-control"]) { const v = upstream.headers.get(h); if (v) out.set(h, v); }
  if (out.get("content-type")?.includes("text/event-stream")) { out.set("cache-control", "no-cache, no-transform"); out.set("x-accel-buffering", "no"); }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
