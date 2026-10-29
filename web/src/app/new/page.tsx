"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Team } from "@/lib/api";
import QrDrop from "@/components/QrDrop";

export default function NewHackathonPage() {
  return <Suspense fallback={null}><NewHackathon /></Suspense>;
}

function NewHackathon() {
  const params = useSearchParams();
  const [text, setText] = useState(params.get("urls") || "");
  const fromTitle = params.get("title");
  useEffect(() => { const u = params.get("urls"); if (u) setText(u); }, [params]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string>("");
  useEffect(() => { api.teams().then(ts => setTeams(ts.filter(t => t.status === "approved"))).catch(() => {}); }, []);
  const router = useRouter();
  const urls = text.split(/[\s,]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
  async function go() {
    setBusy(true); setErr("");
    try { const { id } = await api.create(urls, teamId || null); router.push(`/h/${id}`); }
    catch (e) { setErr(String(e)); setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Add a hackathon</h1>
      {fromTitle && <p className="mb-2 rounded bg-[#E4F2E7] px-3 py-2 text-sm">From your calendar: <span className="font-medium">{fromTitle}</span>{!text && ". The event had no link, paste the event page below."}</p>}
      <p className="mb-4 text-sm text-[#6B6458]">Paste every link you have: the event page, the rules page, the sponsor pages, the Discord invite, the submission form. One per line or separated by spaces.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="https://..." className="w-full rounded-xl bg-[#E4F2E7] p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />
      <div className="mt-3"><QrDrop onLinks={(links, n) => { if (links.length) setText(t => (t.trim() ? t.trim() + "\n" : "") + links.join("\n")); setNotes(n); }} /></div>
      {notes.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[#6B6458]">{notes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {teams.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[#6B6458]">For</span>
          <button onClick={() => setTeamId("")} className={`rounded-full px-3 py-1 ${!teamId ? "bg-[#1A1712] text-white" : "bg-[#E4F2E7] text-[#1A1712]"}`}>Just me</button>
          {teams.map(t => <button key={t.id} onClick={() => setTeamId(t.id)} className={`rounded-full px-3 py-1 ${teamId === t.id ? "bg-[#1A1712] text-white" : "bg-[#E4F2E7] text-[#1A1712]"}`}>{t.name}</button>)}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button disabled={busy || urls.length === 0} onClick={go} className="rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712] disabled:opacity-40">{busy ? "Building…" : `Build the brief from ${urls.length} link${urls.length === 1 ? "" : "s"}`}</button>
        <span className="text-xs text-[#6B6458]">Reads the pages with You.com, extracts with agents on Parasail.</span>
      </div>
      {err && <p className="mt-3 text-sm text-[#C8160C]">{err}</p>}
    </div>
  );
}
