"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, api } from "@/lib/api";
import { useRouter } from "next/navigation";
type Found = { title: string; url: string; when?: string | null; where?: string | null; format?: string | null; fit?: number | null; why?: string | null; description?: string | null };
export default function Discover() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [profileEmpty, setProfileEmpty] = useState(false);
  useEffect(() => { api.profile().then(p => setProfileEmpty(!Object.values(p || {}).some(v => (v || "").trim()))).catch(() => {}); }, []);
  const router = useRouter();
  async function build(url: string) { const { id } = await api.create([url]); router.push(`/h/${id}`); }
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
      <p className="mb-4 text-sm text-[#6B6458]">Live search with You.com, ranked against your profile by a Matcher helper on Parasail.</p>
      {profileEmpty && <p className="mb-4 hk-block p-3 text-sm">Your profile is empty, so every result will score low. <Link href="/profile" className="underline">Fill in your profile</Link> first, it takes a minute.</p>}
      <div className="flex gap-2"><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="hackathons in San Francisco in November" className="flex-1 rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" /><button onClick={go} disabled={busy} className="rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712] disabled:opacity-40">{busy ? "Searching…" : "Search"}</button></div>
      {err && <p className="mt-3 text-sm text-[#C8160C]">{err}</p>}
      {rows && <ul className="mt-4 space-y-2">{rows.map((r, i) => (
        <li key={i} className="hk-block p-3">
          <div className="flex items-start justify-between gap-3"><a className="font-medium underline" target="_blank" href={r.url}>{r.title}</a>{r.fit != null && <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">fit {r.fit}/10</span>}</div>
          <div className="text-sm text-[#6B6458]">{[r.when, r.where, r.format].filter(Boolean).join(" · ")}</div>
          {r.why && <p className="mt-1 text-sm">{r.why}</p>}
          <button onClick={() => build(r.url)} className="mt-2 rounded-full bg-[#EC6699] px-4 py-1.5 text-xs font-bold text-[#1A1712]">Build its brief</button>
        </li>))}{rows.length === 0 && <p className="text-sm text-[#6B6458]">Nothing found.</p>}</ul>}
    </div>
  );
}
