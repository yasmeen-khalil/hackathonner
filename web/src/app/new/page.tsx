"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
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
      {fromTitle && <p className="mb-2 rounded bg-neutral-100 px-3 py-2 text-sm">From your calendar: <span className="font-medium">{fromTitle}</span>{!text && ". The event had no link, paste the event page below."}</p>}
      <p className="mb-4 text-sm text-neutral-500">Paste every link you have: the event page, the rules page, the sponsor pages, the Discord invite, the submission form. One per line or separated by spaces.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="https://..." className="w-full rounded border border-neutral-300 bg-white p-3 font-mono text-sm" />
      <div className="mt-3"><QrDrop onLinks={(links, n) => { if (links.length) setText(t => (t.trim() ? t.trim() + "\n" : "") + links.join("\n")); setNotes(n); }} /></div>
      {notes.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-neutral-500">{notes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      <div className="mt-3 flex items-center gap-3">
        <button disabled={busy || urls.length === 0} onClick={go} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? "Building…" : `Build the brief from ${urls.length} link${urls.length === 1 ? "" : "s"}`}</button>
        <span className="text-xs text-neutral-500">Reads the pages with You.com, extracts with agents on Parasail.</span>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </div>
  );
}
