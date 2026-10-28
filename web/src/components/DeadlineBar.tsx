"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, HackathonRow, fmtDate } from "@/lib/api";
import Countdown from "./Countdown";

export default function DeadlineBar() {
  const [next, setNext] = useState<HackathonRow | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.list().then(rows => {
      const now = Date.now();
      const upcoming = rows.filter(r => r.deadline && new Date(r.deadline).getTime() > now && r.status !== "submitted")
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
      if (alive) setNext(upcoming[0] || null);
    }).catch(() => {});
    load(); const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!next) return <div className="h-10 bg-white px-4 text-sm leading-10 text-neutral-500">No upcoming deadline. Add a hackathon to start a countdown.</div>;
  return (
    <Link href={`/h/${next.id}`} className="flex h-10 items-center justify-between gap-3 bg-white px-4 text-sm">
      <span className="truncate"><span className="font-medium">{next.name}</span> <span className="text-neutral-500">submissions close {fmtDate(next.deadline)}</span></span>
      <Countdown iso={next.deadline} compact />
    </Link>
  );
}
