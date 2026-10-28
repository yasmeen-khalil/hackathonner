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
    for (const p of ["google-calendar", "discord"]) platforms[p] ??= { connected: false };
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

const CAL_NAME = "Hackathonner";
/** The app's own calendar inside the user's Google account. Created once, then reused. The main calendar is never touched. */
async function hackathonnerCalendarId(uid: string, connectionKey: string, timeZone?: string | null): Promise<string> {
  const list = await pickAction(uid, "google-calendar", "list the calendars on the user's calendar list", "GET", /calendarList\/?$/);
  const r = await oneConnect!.runAction(uid, { connectionKey, actionId: list._id });
  if (!r.ok) throw new Error(r.blockedByGrant ? "Listing calendars is outside what you granted. Widen the Hackathonner permission set on One." : `Calendar list answered ${r.status}`);
  const items = ((r.data as { items?: { id: string; summary?: string }[] })?.items) || [];
  const mine = items.find(c => c.summary === CAL_NAME);
  if (mine) return mine.id;
  const create = await pickAction(uid, "google-calendar", "create a new secondary calendar", "POST", /\/calendars\/?$/);
  const c = await oneConnect!.runAction(uid, { connectionKey, actionId: create._id, body: { summary: CAL_NAME, description: "Deadlines and agendas added by Hackathonner.", ...(timeZone ? { timeZone } : {}) } });
  if (!c.ok) throw new Error(c.blockedByGrant ? "Creating a calendar is outside what you granted. Widen the Hackathonner permission set on One." : `Create calendar answered ${c.status}`);
  return (c.data as { id: string }).id;
}

export async function POST(req: NextRequest) {
  const uid = await currentUserId();
  if (!uid) return json({ error: "Unauthorized" }, 401);
  if (!oneConfigured || !oneConnect) return json({ error: "One Connect is not configured" }, 503);
  const { hackathonId, what, channelId } = await req.json() as { hackathonId: string; what: "deadline" | "all" | "discord"; channelId?: string };
  const conns = (await oneConnect.listConnections(uid)) as Conn[];
  try {
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
    const cal = conns.find(c => c.platform === "google-calendar");
    if (!cal) return json({ error: "Google Calendar is not connected through One" }, 400);
    const rows = (await backend(uid, `/api/hackathons/${hackathonId}/calendar-rows?what=${what}`)).rows as { summary: string; start: string; end: string; description: string; location: string }[];
    if (!rows.length) return json({ error: "The brief has no dated deadline or agenda yet" }, 400);
    const h0 = await backend(uid, `/api/hackathons/${hackathonId}`);
    const calendarId = await hackathonnerCalendarId(uid, cal.key, h0.brief?.timezone);
    const action = await pickAction(uid, "google-calendar", "create an event on a calendar", "POST", /\/events\/?$/);
    const created: { summary: string; start: string; link?: string }[] = [];
    for (const row of rows) {
      const r = await oneConnect.runAction(uid, { connectionKey: cal.key, actionId: action._id, pathParams: { calendarId },
        body: { summary: row.summary, description: row.description, location: row.location, start: { dateTime: row.start }, end: { dateTime: row.end } } });
      if (!r.ok) return json({ error: r.blockedByGrant ? "Outside what you granted to Hackathonner on One" : `Calendar answered ${r.status}`, detail: r.data, created }, 502);
      created.push({ summary: row.summary, start: row.start, link: (r.data as { htmlLink?: string })?.htmlLink });
    }
    await backend(uid, `/api/hackathons/${hackathonId}`, { method: "PATCH", body: JSON.stringify({ after: { ...(h0.after || {}), calendar_events: created, calendar_name: CAL_NAME } }) });
    return json({ created, calendar: CAL_NAME });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 502);
  }
}
