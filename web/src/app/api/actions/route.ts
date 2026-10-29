// Real actions in the user's own apps through One Connect. GET: what this user has connected. POST: do one thing.
import { NextRequest } from "next/server";
import { oneConnect, oneConfigured } from "@/lib/one";
import { backend, currentUserId } from "@/lib/backend";

export const maxDuration = 120;
type Conn = { platform: string; key: string; name?: string; access?: unknown };

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }); }

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return json({ error: "Unauthorized" }, 401);
  if (!oneConfigured || !oneConnect) return json({ configured: false, connected: false, platforms: {} });
  try {
    const connected = await oneConnect.isConnected(uid);
    if (!connected) return json({ configured: true, connected: false, platforms: {} });
    const conns = (await oneConnect.listConnections(uid)) as Conn[];
    const platforms: Record<string, { connected: boolean; name?: string }> = {};
    for (const c of conns) platforms[c.platform] = { connected: true, name: c.name };
    for (const p of ["google-calendar", "gmail"]) platforms[p] ??= { connected: false };
    return json({ configured: true, connected: true, platforms });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("reconnect_required")) return json({ configured: true, connected: false, platforms: {}, reconnect: true });
    return json({ configured: true, connected: false, platforms: {}, error: msg.slice(0, 200) });
  }
}

type Act = { _id: string; method?: string; path?: string; title?: string };
async function pickAction(uid: string, platform: string, intent: string, method: string, pathTest: RegExp) {
  const actions = (await oneConnect!.searchActions(uid, platform, intent, { limit: 10 })) as Act[];
  const hit = actions.find(a => (a.method || "").toUpperCase() === method && pathTest.test(a.path || ""));
  if (!hit) throw new Error(`No ${platform} action matched ${method} ${pathTest} for "${intent}". Found: ${actions.map(a => `${a.method} ${a.path}`).join(", ") || "nothing"}`);
  return hit;
}

async function userEmail(uid: string): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    const e = u?.primaryEmailAddress?.emailAddress || u?.emailAddresses?.[0]?.emailAddress;
    if (e) return e;
  }
  try { const res = await oneConnect!.fetch(uid, "/users/whoami"); const d = await res.json(); return d?.user?.email || null; } catch { return null; }
}

function toBase64Url(s: string) { return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

type AnyBrief = { name?: string; start?: string; timezone?: string; venue?: { name?: string; address?: string; city?: string }; submission?: { deadline?: string; deadline_text?: string; url?: string; fields?: string[] }; required_tools?: { name: string }[]; tracks?: { name: string }[]; links?: { label: string; url: string }[] };
function briefEmail(h: { brief?: AnyBrief; plan?: { next_action?: string; checklist?: { title: string; due?: string | null }[] } }) {
  const b = h.brief || {}; const sub = b.submission || {}; const v = b.venue || {};
  const when = b.start ? new Date(b.start).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: b.timezone || undefined }) : "date not stated on the pages";
  const lines = [
    `${b.name || "Hackathon"} brief, from Hackathonner`, "",
    `When: ${when}`, `Where: ${[v.name, v.address, v.city].filter(Boolean).join(", ") || "not stated"}`,
    `Submission deadline: ${sub.deadline ? new Date(sub.deadline).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: b.timezone || undefined }) : (sub.deadline_text || "not stated")}`,
    `Submit at: ${sub.url || "see the event page"}`, sub.fields?.length ? `The form asks for: ${sub.fields.join("; ")}` : "",
    "", `Required tools: ${(b.required_tools || []).map(t => t.name).join(", ") || "none stated"}`, `Tracks: ${(b.tracks || []).map(t => t.name).join(", ") || "none stated"}`,
    "", h.plan?.next_action ? `Next action: ${h.plan.next_action}` : "",
    ...(h.plan?.checklist || []).map(c => `  - ${c.title}${c.due ? ` (by ${new Date(c.due).toLocaleString("en-US", { timeStyle: "short", timeZone: b.timezone || undefined })})` : ""}`),
    "", "Links:", ...(b.links || []).map(l => `  ${l.label}: ${l.url}`),
  ].filter(l => l !== "");
  return { subject: `${b.name || "Hackathon"}: brief and gameplan`, text: lines.join("\n") };
}
/** The app's own calendar inside the user's Google account. Created once, then reused. The main calendar is never touched. */
export async function POST(req: NextRequest) {
  const uid = await currentUserId();
  if (!uid) return json({ error: "Unauthorized" }, 401);
  if (!oneConfigured || !oneConnect) return json({ error: "One Connect is not configured" }, 503);
  const { hackathonId, what, channelId } = await req.json() as { hackathonId: string; what: "discord" | "email"; channelId?: string };
  const conns = (await oneConnect.listConnections(uid)) as Conn[];
  try {
    if (what === "email") {
      const gm = conns.find(c => c.platform === "gmail");
      if (!gm) return json({ error: "Gmail is not connected through One" }, 400);
      const h = await backend(uid, `/api/hackathons/${hackathonId}`);
      const to = await userEmail(uid);
      if (!to) return json({ error: "Could not find your email address" }, 400);
      const { subject, text } = briefEmail(h);
      const raw = toBase64Url(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}`);
      const action = await pickAction(uid, "gmail", "send an email message", "POST", /messages\/send\/?$/);
      const r = await oneConnect.runAction(uid, { connectionKey: gm.key, actionId: action._id, pathParams: { userId: "me" }, body: { raw } });
      if (!r.ok) return json({ error: r.blockedByGrant ? "Sending mail is outside what you granted to Hackathonner on One" : `Gmail answered ${r.status}`, detail: r.data }, 502);
      await backend(uid, `/api/hackathons/${hackathonId}`, { method: "PATCH", body: JSON.stringify({ after: { ...(h.after || {}), emailed_to: to, emailed_at: new Date().toISOString() } }) });
      return json({ ok: true, to });
    }
    if (what === "discord") {
      const dc = conns.find(c => c.platform === "discord");
      if (!dc) return json({ error: "Discord is not connected through One" }, 400);
      const h = await backend(uid, `/api/hackathons/${hackathonId}`);
      const b = h.brief || {}; const sub = b.submission || {};
      const content = [`**${b.name}** brief`, `Deadline: ${sub.deadline_text || sub.deadline || "not found"}`, `Submit: ${sub.url || "see event page"}`,
        `Required tools: ${(b.required_tools || []).map((t: { name: string }) => t.name).join(", ")}`, `Tracks: ${(b.tracks || []).map((t: { name: string }) => t.name).join(", ")}`].join("\n");
      const channel = channelId || process.env.DISCORD_CHANNEL_ID;
      if (!channel) return json({ error: "No Discord channel id" }, 400);
      const action = await pickAction(uid, "discord", "send a message to a channel", "POST", /\/messages\/?$/);
      const r = await oneConnect.runAction(uid, { connectionKey: dc.key, actionId: action._id, pathParams: { channelId: channel }, body: { content: content.slice(0, 1900) } });
      if (!r.ok) return json({ error: r.blockedByGrant ? "Outside what you granted to Hackathonner on One" : `Discord answered ${r.status}`, detail: r.data }, 502);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 502);
  }
}
