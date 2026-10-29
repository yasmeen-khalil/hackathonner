"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@withone/connect/react";
import { fmtDate } from "@/lib/api";
type S = { id: string; title: string; start?: string; end?: string; location?: string; links: string[]; htmlLink?: string };
type R = { configured: boolean; connected: boolean; calendar?: boolean; scanned?: number; suggestions: S[]; error?: string };

/** Hackathons already on the user's own calendar, read through One. Never writes. */
export default function FromCalendar({ known }: { known: string[] }) {
  const [r, setR] = useState<R | null>(null);
  const load = () => fetch("/api/calendar").then(x => x.json()).then(setR).catch(() => setR(null));
  useEffect(() => { load(); }, []);
  if (!r || !r.configured) return null;
  const fresh = r.suggestions.filter(s => !known.some(k => k && s.title.toLowerCase().includes(k.toLowerCase().slice(0, 12))));
  return (
    <section className="mb-8 hk-block p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B6458]">From your calendar</h2>
        {r.connected && typeof r.scanned === "number" && <span className="text-xs text-[#6B6458]">{r.scanned} upcoming events read, {r.suggestions.length} look like hackathons</span>}
      </div>
      {!r.connected ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ConnectButton authorizeUrl="/api/one/authorize" logos={["google-calendar", "gmail"]} connected={false} returnTo="/" onSuccess={load} />
          <p className="text-sm text-[#6B6458]">Connect your calendar through One and Hackathonner spots the hackathons you already signed up for. Read only, revoke any time.</p>
        </div>
      ) : r.error ? <p className="mt-2 text-sm text-[#6B6458]">{r.error}</p>
      : fresh.length === 0 ? <p className="mt-2 text-sm text-[#6B6458]">No upcoming hackathons found on your calendar in the next 90 days.</p>
      : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">{fresh.map(s => (
          <li key={s.id} className="hk-block p-3">
            <div className="font-medium">{s.title}</div>
            <div className="text-sm text-[#6B6458]">{[fmtDate(s.start, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), s.location].filter(Boolean).join(" · ")}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link href={`/new?urls=${encodeURIComponent(s.links.join("\n"))}&title=${encodeURIComponent(s.title)}`} className="rounded-full bg-[#EC6699] px-4 py-1.5 text-xs font-bold text-[#1A1712]">Start its brief</Link>
              {s.links.length === 0 && <span className="text-xs text-[#6B6458]">No link in the event, paste one on the next screen.</span>}
              {s.htmlLink && <a className="text-xs underline" target="_blank" href={s.htmlLink}>Open in Calendar</a>}
            </div>
          </li>))}</ul>
      )}
    </section>
  );
}
