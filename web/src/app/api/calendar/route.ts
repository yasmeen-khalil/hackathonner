// Read-only: looks at the user's upcoming Google Calendar events through their One grant and picks out hackathons.
// Nothing is ever written to the calendar.
import { oneConnect, oneConfigured } from "@/lib/one";
import { currentUserId } from "@/lib/backend";

export const maxDuration = 60;
type Conn = { platform: string; key: string };
type Act = { _id: string; method?: string; path?: string };
type GEvent = { id: string; summary?: string; description?: string; location?: string; htmlLink?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };
export type CalendarSuggestion = { id: string; title: string; start?: string; end?: string; location?: string; links: string[]; htmlLink?: string };

const HACK = /hack(athon|-a-thon)?\b|hack (day|night|week)|buildathon|build day|demo day|game jam|\bjam\b|ideathon|datathon|makeathon|devpost|hackfest/i;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }); }

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return json({ error: "Unauthorized" }, 401);
  if (!oneConfigured || !oneConnect) return json({ configured: false, connected: false, suggestions: [] });
  try {
    if (!(await oneConnect.isConnected(uid))) return json({ configured: true, connected: false, suggestions: [] });
    const conns = (await oneConnect.listConnections(uid)) as Conn[];
    const cal = conns.find(c => c.platform === "google-calendar");
    if (!cal) return json({ configured: true, connected: true, calendar: false, suggestions: [] });
    const actions = (await oneConnect.searchActions(uid, "google-calendar", "list events on a calendar", { limit: 10 })) as Act[];
    const list = actions.find(a => (a.method || "").toUpperCase() === "GET" && /\/events\/?$/.test(a.path || ""));
    if (!list) return json({ configured: true, connected: true, calendar: true, suggestions: [], error: "No event-listing action found" });
    const now = new Date(); const horizon = new Date(now.getTime() + 90 * 86400_000);
    const r = await oneConnect.runAction(uid, { connectionKey: cal.key, actionId: list._id, pathParams: { calendarId: "primary" },
      query: { timeMin: now.toISOString(), timeMax: horizon.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" } });
    if (!r.ok) return json({ configured: true, connected: true, calendar: true, suggestions: [], error: r.blockedByGrant ? "Reading the calendar is outside what you granted" : `Calendar answered ${r.status}` });
    const items = ((r.data as { items?: GEvent[] })?.items) || [];
    const suggestions: CalendarSuggestion[] = items
      .filter(e => HACK.test(`${e.summary || ""} ${e.description || ""}`))
      .map(e => ({ id: e.id, title: e.summary || "Untitled event", start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, location: e.location,
        links: Array.from(new Set<string>([...((e.description || "").match(URL_RE) || []), ...((e.location || "").match(URL_RE) || [])])), htmlLink: e.htmlLink }));
    return json({ configured: true, connected: true, calendar: true, scanned: items.length, suggestions });
  } catch (e) {
    const msg = String(e);
    return json({ configured: true, connected: !msg.includes("reconnect_required"), suggestions: [], error: msg.slice(0, 200) });
  }
}
