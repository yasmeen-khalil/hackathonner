"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function NewHackathon() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const urls = text.split(/[\s,]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
  async function go() {
    setBusy(true); setErr("");
    try { const { id } = await api.create(urls); router.push(`/h/${id}`); }
    catch (e) { setErr(String(e)); setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Add a hackathon</h1>
      <p className="mb-4 text-sm text-neutral-500">Paste every link you have: the event page, the rules page, the sponsor pages, the Discord invite, the submission form. One per line or separated by spaces.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="https://..." className="w-full rounded border border-neutral-300 bg-white p-3 font-mono text-sm" />
      <div className="mt-3 flex items-center gap-3">
        <button disabled={busy || urls.length === 0} onClick={go} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? "Building…" : `Build the brief from ${urls.length} link${urls.length === 1 ? "" : "s"}`}</button>
        <span className="text-xs text-neutral-500">Reads the pages with You.com, extracts with agents on Parasail.</span>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
