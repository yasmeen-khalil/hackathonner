"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, HackathonRow, fmtDate } from "@/lib/api";
import Countdown from "@/components/Countdown";
import FromCalendar from "@/components/FromCalendar";

function Card({ h }: { h: HackathonRow }) {
  return (
    <Link href={`/h/${h.id}`} className="block hk-block p-4 hover:brightness-[0.98]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{h.name}</div>
          <div className="text-sm text-[#6B6458]">{[fmtDate(h.start, { weekday: "short", month: "short", day: "numeric" }), h.city, h.format?.replace("_", " ")].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span className="rounded bg-[#E4F2E7] px-2 py-0.5 uppercase tracking-wide text-[#6B6458]">{h.status}</span>
          {h.after?.placing && <span className="rounded bg-[#E4F2E7] px-2 py-0.5 text-[#1A1712]">{h.after.placing}</span>}
        </div>
      </div>
      {h.deadline && h.status !== "submitted" && <div className="mt-3"><Countdown iso={h.deadline} label="Submissions close in" compact /></div>}
      {h.error && <div className="mt-2 text-sm text-[#C8160C]">{h.error}</div>}
    </Link>
  );
}

export default function Home() {
  const [rows, setRows] = useState<HackathonRow[] | null>(null);
  const [apiErr, setApiErr] = useState("");
  useEffect(() => { api.list().then(setRows).catch(e => { setApiErr(String(e)); setRows([]); }); }, []);
  if (rows === null) return <p className="text-[#6B6458]">Loading…</p>;
  if (apiErr) return <div className="mx-auto max-w-4xl hk-block p-6 text-sm"><div className="font-medium text-[#C8160C]">The Hackathonner API is not reachable.</div><p className="mt-1 text-[#C8160C]">{apiErr}</p></div>;
  const now = Date.now();
  const isPast = (h: HackathonRow) => h.status === "submitted" || (h.end ? new Date(h.end).getTime() < now : h.deadline ? new Date(h.deadline).getTime() < now : false);
  const isToday = (h: HackathonRow) => !isPast(h) && h.start && new Date(h.start).getTime() <= now;
  const today = rows.filter(isToday), upcoming = rows.filter(h => !isPast(h) && !isToday(h)), past = rows.filter(isPast);
  const Group = ({ title, items }: { title: string; items: HackathonRow[] }) => items.length ? (
    <section className="mb-8"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B6458]">{title}</h2><div className="grid gap-3 md:grid-cols-2">{items.map(h => <Card key={h.id} h={h} />)}</div></section>
  ) : null;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-normal tracking-tight">Hackathons</h1>
        <Link href="/new" className="rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712] md:hidden">Add a hackathon</Link>
      </div>
      <FromCalendar known={rows.map(r => r.name)} />
      {rows.length === 0 && <p className="hk-block p-8 text-center text-[#6B6458]">Nothing yet. Paste an event's links and the brief builds itself.</p>}
      <Group title="Today or in progress" items={today} />
      <Group title="Upcoming" items={upcoming} />
      <Group title="Past" items={past} />
    </div>
  );
}
