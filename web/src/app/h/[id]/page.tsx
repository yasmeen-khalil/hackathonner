"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API, api, Hackathon, Brief, Plan, Tools, After, OneStatus, fmtDate } from "@/lib/api";
import Countdown from "@/components/Countdown";
import { ConnectButton } from "@withone/connect/react";

const SECTIONS = ["brief", "rules", "toolkit", "gameplan", "submit", "debrief"] as const;
type Section = typeof SECTIONS[number];

function Skeleton({ lines = 4 }: { lines?: number }) {
  return <div className="animate-pulse space-y-2">{Array.from({ length: lines }).map((_, i) => <div key={i} className="h-4 rounded bg-[#E4F2E7]" style={{ width: `${90 - i * 12}%` }} />)}</div>;
}
function H({ children }: { children: React.ReactNode }) { return <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-[#6B6458] first:mt-0">{children}</h3>; }
function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "green" }) {
  const c = { neutral: "bg-[#E4F2E7] text-[#1A1712]", red: "bg-red-100 text-[#C8160C]", green: "bg-emerald-100 text-emerald-800" }[tone];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${c}`}>{children}</span>;
}

export default function WorkspacePage() {
  return <Suspense fallback={<Skeleton lines={6} />}><Workspace /></Suspense>;
}

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [h, setH] = useState<Hackathon | null>(null);
  const [status, setStatus] = useState<string>("");
  const [section, setSection] = useState<Section>("brief");
  const [err, setErr] = useState("");
  const [one, setOne] = useState<OneStatus | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const router = useRouter();
  useEffect(() => { api.oneStatus().then(setOne).catch(() => setOne(null)); }, []);

  useEffect(() => {
    api.get(id).then(d => { setH(d); if (d.after?.submitted_at) setSection("debrief"); }).catch(e => setErr(String(e)));
    const es = new EventSource(`${API}/api/hackathons/${id}/events`);
    esRef.current = es;
    es.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === "status") setStatus(m.message);
      else if (m.type === "section") setH(prev => prev ? { ...prev, [m.name]: m.data, name: m.name === "brief" ? m.data.name : prev.name } : prev);
      else if (m.type === "done") { setStatus(""); setH(prev => prev ? { ...prev, status: prev.status === "building" ? "ready" : prev.status } : prev); es.close(); }
      else if (m.type === "error") { setErr(m.message); setStatus(""); es.close(); }
    };
    es.onerror = () => { /* the server closes the stream when done */ };
    return () => es.close();
  }, [id]);

  const b = h?.brief as Brief | undefined, plan = h?.plan as Plan | undefined, tools = h?.tools as Tools | undefined;
  const deadline = b?.submission?.deadline;

  async function toggleCheck(i: number) {
    if (!plan) return;
    const next = { ...plan, checklist: plan.checklist.map((c, j) => j === i ? { ...c, done: !c.done } : c) };
    setH(prev => prev ? { ...prev, plan: next } : prev);
    await api.patch(id, { plan: next });
  }
  async function saveAfter(after: After) {
    const d = await api.patch(id, { after, ...(after.submitted_at ? { status: "submitted" } : {}) });
    setH(d);
  }

  const nav = useMemo(() => SECTIONS.filter(s => s !== "debrief" || h?.after?.submitted_at || h?.status === "ready" || h?.status === "submitted"), [h]);
  if (err && !h) return <p className="text-[#C8160C]">{err}</p>;
  if (!h) return <Skeleton lines={6} />;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-normal leading-tight tracking-tight md:text-5xl">{b?.name || "Building the brief…"}</h1>
            <p className="text-sm text-[#6B6458]">{[b?.organizer, fmtDate(b?.start, { weekday: "long", month: "long", day: "numeric" }), b?.venue?.city, b?.format?.replace("_", " ")].filter(Boolean).join(" · ")}</p>
            <button onClick={async () => { if (confirm("Remove this hackathon and its brief?")) { await api.remove(id); router.push("/"); } }} className="mt-1 text-xs text-[#6B6458] hover:text-[#C8160C]">Remove</button>
          </div>
          <div className="flex flex-col items-end gap-2">
            {h.after?.submitted_at ? <Chip tone="green">Submitted {fmtDate(h.after.submitted_at)}</Chip> : <Countdown iso={deadline} label="Submissions close in" />}
            {status && <span className="text-xs text-[#6B6458]">Helpers: {status}</span>}
            {(err || h.status === "error") && <span className="flex items-center gap-2 text-xs text-[#C8160C]">{err || h.error}
              <button onClick={async () => { setErr(""); setStatus("Starting again"); await fetch(`${API}/api/hackathons/${id}/rebuild`, { method: "POST" }); window.location.reload(); }} className="rounded-full bg-[#C8160C] px-3 py-0.5 font-bold text-white">Rebuild</button></span>}
          </div>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto text-sm">
          {nav.map(s => <button key={s} onClick={() => setSection(s)} className={`rounded-none px-3 py-1.5 capitalize ${section === s ? "font-bold text-[#1A1712] underline decoration-[#EC6699] decoration-2 underline-offset-8" : "text-[#6B6458]"}`}>{s}</button>)}
        </nav>
      </header>

      <div key={section} className="hk-rise">
      {section === "brief" && (!b ? <Skeleton /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <H>When</H>
            <p>{fmtDate(b.start, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}{b.end ? ` to ${fmtDate(b.end, { hour: "numeric", minute: "2-digit" })}` : ""} {b.timezone && <span className="text-[#6B6458]">({b.timezone})</span>}</p>
            {b.submission?.deadline_text && <p className="mt-1 text-sm">Submission deadline as written: <span className="font-medium">{b.submission.deadline_text}</span></p>}
            <H>Where</H>
            <p>{b.format === "online" ? "Online" : [b.venue?.name, b.venue?.address, b.venue?.city].filter(Boolean).join(", ") || "Not stated"}</p>
            {b.venue?.doors_time && <p className="text-sm text-[#6B6458]">Doors {b.venue.doors_time}</p>}
            {(b.venue?.map_url || b.venue?.address) && <a className="text-sm underline" target="_blank" href={b.venue?.map_url || `https://maps.google.com/?q=${encodeURIComponent(b.venue?.address || "")}`}>Open in Maps</a>}
            <H>Contacts</H>
            {b.contacts?.length ? <ul className="list-disc pl-5 text-sm">{b.contacts.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="text-sm text-[#6B6458]">None stated</p>}
            {b.partners?.length > 0 && <><H>Partners</H><div className="flex flex-wrap gap-1">{b.partners.map(p => <Chip key={p}>{p}</Chip>)}</div></>}
          </div>
          <div>
            <H>Links</H>
            <ul className="space-y-1 text-sm">{b.links.map((l, i) => <li key={i}><a className="underline" target="_blank" href={l.url}>{l.label}</a> <span className="text-[#6B6458]">{l.kind}</span></li>)}</ul>
            <H>Sources read</H>
            <ul className="space-y-1 text-xs text-[#6B6458]">{h.sources?.sources?.map(s => <li key={s.url}>{s.url} · {Math.round(s.chars / 1000)}k chars</li>)}</ul>
            {b.unknowns?.length > 0 && <><H>Not found on the pages, ask the organizers</H><ul className="list-disc pl-5 text-sm">{b.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul></>}
          </div>
        </div>
      ))}

      {section === "rules" && (!b ? <Skeleton /> : (
        <div>
          <H>Tracks</H>
          <div className="grid gap-3 md:grid-cols-2">{b.tracks.map(t => (
            <div key={t.name} className="hk-block p-4">
              <div className="font-medium">{t.name}</div><p className="mt-1 text-sm">{t.summary}</p>
              {t.requirements.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{t.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>}
              {t.disqualifiers.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.disqualifiers.map((d, i) => <Chip key={i} tone="red">{d}</Chip>)}</div>}
            </div>))}</div>
          <H>Rubric</H>
          {b.rubric.length ? <table className="w-full text-sm"><tbody>{b.rubric.map((r, i) => <tr key={i} className=""><td className="py-2 pr-3 font-medium">{r.criterion}</td><td className="py-2 pr-3 whitespace-nowrap text-[#6B6458]">{r.weight}</td><td className="py-2 text-[#6B6458]">{r.looks_for}</td></tr>)}</tbody></table> : <p className="text-sm text-[#6B6458]">No rubric found on the pages.</p>}
          {b.prizes.length > 0 && <><H>Prizes</H><ul className="list-disc pl-5 text-sm">{b.prizes.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
        </div>
      ))}

      {section === "toolkit" && (() => { const list = tools?.tools || b?.required_tools; return !list ? <Skeleton /> : (
        <div className="grid gap-3 md:grid-cols-2">{list.map(t => (
          <div key={t.name} className="hk-block p-4">
            <div className="flex items-center justify-between"><div className="font-medium">{t.name}</div>{t.free_for_event != null && <Chip tone={t.free_for_event ? "green" : "neutral"}>{t.free_for_event ? "free for the event" : "own account"}</Chip>}</div>
            <p className="mt-1 text-sm">{t.what_it_is}</p>
            <p className="mt-2 text-sm"><span className="text-[#6B6458]">Job here: </span>{t.job_here}</p>
            {t.key_source && <p className="mt-2 text-sm"><span className="text-[#6B6458]">Key: </span>{t.key_source}</p>}
            {t.docs_url && <a className="mt-2 inline-block text-sm underline" target="_blank" href={t.docs_url}>Docs</a>}
          </div>))}{!tools && <p className="text-xs text-[#6B6458] md:col-span-2">Explainer agent is still writing the plain-words versions…</p>}
          <ConnectionsBox one={one} /></div>
      ); })()}

      {section === "gameplan" && (!plan ? <Skeleton /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="hk-card p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#6B6458]">Do next</div><div className="mt-1 text-lg font-bold">{plan.next_action}</div></div>
            <Actions id={id} one={one} after={h.after || {}} onDone={d => setH(d)} />
            <H>Checklist</H>
            <ul className="space-y-2">{plan.checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-3 hk-block p-3">
                <input type="checkbox" checked={c.done} onChange={() => toggleCheck(i)} className="mt-1" />
                <div className={c.done ? "line-through text-[#6B6458]" : ""}><div className="text-sm">{c.title}</div>{c.due && <div className="text-xs text-[#6B6458]">by {fmtDate(c.due)}</div>}</div>
              </li>))}</ul>
            {plan.warnings.length > 0 && <><H>Easy to break</H><ul className="list-disc pl-5 text-sm">{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
          </div>
          <div>
            <H>Timeline</H>
            <ol className="space-y-1 text-sm">{(plan.timeline.length ? plan.timeline : b?.agenda || []).map((a, i) => <li key={i} className="flex gap-3"><span className="w-28 shrink-0 font-mono text-[#6B6458]">{/^\d{4}-/.test(a.time) ? fmtDate(a.time, { hour: "numeric", minute: "2-digit" }) : a.time}</span><span>{a.title}</span></li>)}</ol>
          </div>
        </div>
      ))}

      {section === "submit" && (!b ? <Skeleton /> : (
        <div className="max-w-2xl">
          <div className="hk-block p-4">
            <div className="flex items-center justify-between"><div className="font-medium">Submission</div><Countdown iso={deadline} compact /></div>
            {b.submission.url && <a className="mt-2 block text-sm underline" target="_blank" href={b.submission.url}>{b.submission.url}</a>}
            {b.submission.instructions && <p className="mt-2 text-sm">{b.submission.instructions}</p>}
            {b.submission.fields.length > 0 && <><H>The form asks for</H><ul className="list-disc pl-5 text-sm">{b.submission.fields.map((f, i) => <li key={i}>{f}</li>)}</ul></>}
          </div>
          <DeadlineFix id={id} current={deadline} onSaved={d => setH(d)} />
          <SubmitForm after={h.after || {}} onSave={saveAfter} />
        </div>
      ))}

      {section === "debrief" && <AfterForm after={h.after || {}} onSave={saveAfter} />}
      </div>
    </div>
  );
}

function SubmitForm({ after, onSave }: { after: After; onSave: (a: After) => Promise<void> }) {
  const [repo, setRepo] = useState(after.repo_url || ""), [video, setVideo] = useState(after.video_url || ""), [team, setTeam] = useState(after.team_handle || "");
  if (after.submitted_at) return <p className="mt-4 text-sm text-[#1A1712]">Marked submitted {fmtDate(after.submitted_at)}. Fill in results under Debrief.</p>;
  return (
    <div className="mt-4 hk-block p-4">
      <H>Mark as submitted</H>
      <label className="block text-sm">Team handle for this hackathon<input value={team} onChange={e => setTeam(e.target.value)} placeholder="lowercase, numbers, dashes" className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" /></label>
      <label className="mt-2 block text-sm">Repo URL<input value={repo} onChange={e => setRepo(e.target.value)} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" /></label>
      <label className="mt-2 block text-sm">Demo video URL<input value={video} onChange={e => setVideo(e.target.value)} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" /></label>
      <button onClick={() => onSave({ ...after, team_handle: team, repo_url: repo, video_url: video, submitted_at: new Date().toISOString() })} className="mt-3 rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712]">Mark submitted</button>
    </div>
  );
}

function AfterForm({ after, onSave }: { after: After; onSave: (a: After) => Promise<void> }) {
  const [a, setA] = useState<After>(after);
  const [saved, setSaved] = useState(false);
  useEffect(() => setA(after), [after]);
  const F = ({ k, label, rows }: { k: keyof After; label: string; rows?: number }) => (
    <label className="block text-sm">{label}
      {rows ? <textarea rows={rows} value={(a[k] as string) || ""} onChange={e => setA({ ...a, [k]: e.target.value })} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />
        : <input value={(a[k] as string) || ""} onChange={e => setA({ ...a, [k]: e.target.value })} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />}
    </label>
  );
  return (
    <div className="max-w-2xl space-y-3">
      {!after.submitted_at && <p className="text-sm text-[#6B6458]">Not marked submitted yet. You can still keep notes here.</p>}
      <div className="grid gap-3 md:grid-cols-2"><F k="placing" label="Placing or result" /><F k="prizes" label="Prizes won" /></div>
      <F k="judge_comments" label="Judge comments" rows={3} />
      <F k="notes" label="Personal notes" rows={3} />
      <F k="retro" label="What to do differently next time" rows={3} />
      <button onClick={async () => { await onSave(a); setSaved(true); setTimeout(() => setSaved(false), 1500); }} className="rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712]">{saved ? "Saved" : "Save"}</button>
    </div>
  );
}

type OneConnectStatus = { configured: boolean; connected: boolean; platforms: Record<string, { connected: boolean; name?: string }>; error?: string; reconnect?: boolean };

function Actions({ id, one, after, onDone }: { id: string; one: OneStatus | null; after: After; onDone: (d: Hackathon) => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [oc, setOc] = useState<OneConnectStatus | null>(null);
  useEffect(() => { fetch("/api/actions").then(r => r.json()).then(setOc).catch(() => setOc(null)); }, []);
  const viaConnect = !!oc?.configured;
  const gm = viaConnect && !!oc?.platforms?.["gmail"]?.connected;
  const dis = viaConnect ? !!oc?.platforms?.["discord"]?.connected : !!one?.platforms?.["discord"]?.connected;
  async function run(what: "discord" | "email") {
    setBusy(what); setMsg("");
    try {
      if (viaConnect) {
        const r = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hackathonId: id, what }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || r.statusText);
        setMsg(what === "discord" ? "Posted to Discord through One." : `Emailed the brief and gameplan to ${d.to}.`);
      } else if (what === "discord") { const r = await api.toDiscord(id); setMsg(r.ok ? "Posted to Discord." : "Discord did not confirm."); }
      else { setMsg("Email needs One Connect, which is not configured here."); }
      onDone(await api.get(id));
    } catch (e) { setMsg(String(e)); } finally { setBusy(""); }
  }
  if (!viaConnect && !dis) return null;
  return (<>
    <H>Send it to yourself</H>
    <div className="hk-block p-4 text-sm">
      {viaConnect && !oc?.connected && (
        <div className="mb-3">
          <ConnectButton authorizeUrl="/api/one/authorize" logos={["google-calendar", "gmail"]} connected={false} returnTo={typeof window !== "undefined" ? window.location.pathname : "/"} onSuccess={() => fetch("/api/actions").then(r => r.json()).then(setOc)} onError={(e: unknown) => setMsg(String(e))} />
          <p className="mt-2 text-xs text-[#6B6458]">Connect your own apps through One. Hackathonner reads your calendar to spot hackathons you already planned, and can email you this brief. It never writes to your calendar. You can revoke the grant on One at any time.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {gm && <button disabled={!!busy} onClick={() => run("email")} className="rounded-full bg-[#EC6699] px-4 py-1.5 font-bold text-[#1A1712] disabled:opacity-40">{busy === "email" ? "Sending…" : "Email me the brief and gameplan"}</button>}
        {dis && <button disabled={!!busy} onClick={() => run("discord")} className="rounded-full bg-white px-4 py-1.5 font-bold text-[#1A1712] disabled:opacity-40">{busy === "discord" ? "Posting…" : "Post brief to Discord"}</button>}
      </div>
      {oc?.connected && !gm && <p className="mt-2 text-xs text-[#6B6458]">Gmail is not in your grant, so there is nothing to send with. Reconnect through One to add it.</p>}
      {msg && <p className="mt-2 text-xs">{msg}</p>}
      {after.emailed_at && <p className="mt-2 text-xs text-[#6B6458]">Last emailed to {after.emailed_to} on {fmtDate(after.emailed_at)}.</p>}
    </div>
  </>);
}

function DeadlineFix({ id, current, onSaved }: { id: string; current?: string | null; onSaved: (d: Hackathon) => void }) {
  const toLocal = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const [v, setV] = useState(toLocal(current));
  const [saving, setSaving] = useState(false);
  useEffect(() => setV(toLocal(current)), [current]);
  return (
    <div className="mt-4 hk-block p-4">
      <H>{current ? "Deadline" : "Set the deadline"}</H>
      <p className="mb-2 text-xs text-[#6B6458]">{current ? "Read from the pages. Correct it here if the organizers announce a change." : "The pages did not state a dated deadline. Enter it and the countdown starts."}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="datetime-local" value={v} onChange={e => setV(e.target.value)} className="rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />
        <button disabled={!v || saving} onClick={async () => { setSaving(true); const iso = new Date(v).toISOString(); onSaved(await api.patch(id, { brief: { submission: { deadline: iso } } })); setSaving(false); }} className="rounded-full bg-[#EC6699] px-4 py-2 text-sm font-bold text-[#1A1712] disabled:opacity-40">{saving ? "Saving…" : "Save deadline"}</button>
      </div>
    </div>
  );
}

function ConnectionsBox({ one }: { one: OneStatus | null }) {
  const [oc, setOc] = useState<OneConnectStatus | null>(null);
  useEffect(() => { fetch("/api/actions").then(r => r.json()).then(setOc).catch(() => setOc(null)); }, []);
  if (oc === null) return null;
  if (oc.configured) {
    return (
      <div className="hk-block p-4 text-sm md:col-span-2">
        <div className="font-medium">Your own apps, through One</div>
        {oc.connected ? (
          <div className="mt-1 flex flex-wrap gap-2">{Object.entries(oc.platforms).map(([k, v]) => <Chip key={k} tone={v.connected ? "green" : "neutral"}>{k}{v.connected ? " connected" : " not connected"}</Chip>)}</div>
        ) : <p className="mt-1 text-[#6B6458]">Not connected yet. Use the Connect button under Gameplan. Hackathonner only receives what you grant, and you can revoke it on One at any time.</p>}
      </div>
    );
  }
  if (!one || one.error) return null;
  return (
    <div className="hk-block p-4 text-sm md:col-span-2">
      <div className="font-medium">Connections through One</div>
      <div className="mt-1 flex flex-wrap gap-2">{Object.entries(one.platforms).map(([k, v]) => <Chip key={k} tone={v.connected ? "green" : "neutral"}>{k}{v.connected ? " connected" : " not connected"}</Chip>)}</div>
    </div>
  );
}
