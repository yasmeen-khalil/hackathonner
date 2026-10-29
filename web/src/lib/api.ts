// Every call goes through our own /api/backend proxy, which checks the session and holds the backend secret.
export const API = "/api/backend";

export type Link = { label: string; url: string; kind: string };
export type Venue = { name?: string | null; address?: string | null; city?: string | null; map_url?: string | null; doors_time?: string | null };
export type Track = { name: string; summary: string; requirements: string[]; disqualifiers: string[] };
export type RequiredTool = { name: string; what_it_is: string; job_here: string; key_source?: string | null; docs_url?: string | null; free_for_event?: boolean | null };
export type RubricItem = { criterion: string; weight?: string | null; looks_for?: string | null };
export type Submission = { url?: string | null; deadline?: string | null; deadline_text?: string | null; fields: string[]; instructions?: string | null };
export type AgendaItem = { time: string; title: string };
export type ChecklistItem = { title: string; due?: string | null; done: boolean };
export type Brief = {
  name: string; tagline?: string | null; organizer?: string | null; partners: string[];
  start?: string | null; end?: string | null; timezone?: string | null; format: string;
  venue: Venue; links: Link[]; contacts: string[]; tracks: Track[]; required_tools: RequiredTool[];
  rubric: RubricItem[]; submission: Submission; agenda: AgendaItem[]; prizes: string[]; unknowns: string[];
};
export type Plan = { next_action: string; checklist: ChecklistItem[]; timeline: AgendaItem[]; warnings: string[] };
export type Tools = { tools: RequiredTool[] };
export type After = { emailed_to?: string; emailed_at?: string; calendar_name?: string; calendar_events?: { summary: string; start: string; link?: string | null }[]; submitted_at?: string; repo_url?: string; video_url?: string; placing?: string; prizes?: string; judge_comments?: string; notes?: string; retro?: string };
export type Hackathon = {
  id: string; status: "building" | "ready" | "error" | "submitted"; name?: string | null; urls: string[];
  sources?: { sources: { url: string; chars: number }[] } | null; brief?: Brief | null; tools?: Tools | null; plan?: Plan | null;
  after?: After | null; error?: string | null; created_at: string; updated_at: string;
};
export type OneStatus = { cli: boolean; error?: string; platforms: Record<string, { connected: boolean; count: number; name?: string | null }> };
export type HackathonRow = {
  id: string; status: string; name: string; start?: string | null; end?: string | null; format?: string | null;
  city?: string | null; deadline?: string | null; after?: After | null; created_at: string; error?: string | null;
};

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
export const api = {
  list: () => fetch(`${API}/api/hackathons`, { cache: "no-store" }).then(j<HackathonRow[]>),
  get: (id: string) => fetch(`${API}/api/hackathons/${id}`, { cache: "no-store" }).then(j<Hackathon>),
  create: (urls: string[]) => fetch(`${API}/api/hackathons`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) }).then(j<{ id: string }>),
  patch: (id: string, body: Partial<{ name: string; status: string; after: After; plan: Plan; brief: Partial<Brief> | { submission: Partial<Submission> } }>) =>
    fetch(`${API}/api/hackathons/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j<Hackathon>),
  remove: (id: string) => fetch(`${API}/api/hackathons/${id}`, { method: "DELETE" }).then(j<{ ok: boolean }>),
  oneStatus: () => fetch(`${API}/api/one/status`, { cache: "no-store" }).then(j<OneStatus>),
  toDiscord: (id: string, channel_id?: string) =>
    fetch(`${API}/api/hackathons/${id}/discord`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel_id }) }).then(j<{ ok: boolean; message_id?: string }>),
  profile: () => fetch(`${API}/api/profile`, { cache: "no-store" }).then(j<Record<string, string>>),
  saveProfile: (data: Record<string, string>) => fetch(`${API}/api/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(j<Record<string, string>>),
};

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, opts);
}
