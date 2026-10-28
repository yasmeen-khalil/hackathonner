"use client";
import { useState } from "react";
import { API } from "@/lib/api";
type Found = { title: string; url: string; when?: string | null; where?: string | null; format?: string | null; fit?: number | null; why?: string | null; description?: string | null };
export default function Discover() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/api/discover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
      if (!r.ok) throw new Error(await r.text());
      setRows((await r.json()).results);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">Discover</h1>
      <p className="mb-4 text-sm text-neutral-500">Live search with You.com, ranked against your profile by an agent on Parasail.</p>
      <div className="flex gap-2"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="hackathons in San Francisco in November" className="flex-1 rounded border border-neutral-300 bg-white p-2 text-sm" /><button onClick={go} disabled={busy} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? "Searching…" : "Search"}</button></div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {rows && <ul className="mt-4 space-y-2">{rows.map((r, i) => (
        <li key={i} className="rounded border border-neutral-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3"><a className="font-medium underline" target="_blank" href={r.url}>{r.title}</a>{r.fit != null && <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">fit {r.fit}/10</span>}</div>
          <div className="text-sm text-neutral-500">{[r.when, r.where, r.format].filter(Boolean).join(" · ")}</div>
          {r.why && <p className="mt-1 text-sm">{r.why}</p>}
        </li>))}{rows.length === 0 && <p className="text-sm text-neutral-500">Nothing found.</p>}</ul>}
    </div>
  );
}
