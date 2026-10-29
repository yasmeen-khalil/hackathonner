"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, HackathonRow, fmtDate } from "@/lib/api";
import Countdown, { msLeft, urgency } from "./Countdown";

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
  if (!next) return <div className="h-11 bg-[#E4F2E7] px-4 text-sm leading-[44px] text-[#6B6458]">No upcoming deadline. Add a hackathon to start a countdown.</div>;
  const u = urgency(msLeft(next.deadline));
  const bar = u === "red" ? "bg-[#C8160C] text-white" : u === "amber" ? "bg-[#F59100] text-[#1A1712]" : "bg-[#EC6699] text-[#1A1712]";
  return (
    <Link href={`/h/${next.id}`} className={`flex h-11 items-center justify-between gap-3 px-4 text-sm transition-colors duration-[360ms] ${bar}`}>
      <span className="truncate"><span className="font-bold">Submissions</span> · {next.name} · closes {fmtDate(next.deadline, { hour: "numeric", minute: "2-digit" })}</span>
      <Countdown iso={next.deadline} compact />
    </Link>
  );
}
