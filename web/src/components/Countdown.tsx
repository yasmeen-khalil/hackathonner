"use client";
import { useEffect, useState } from "react";

export function msLeft(iso?: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t - Date.now();
}
export function urgency(ms: number | null): "none" | "calm" | "amber" | "red" | "past" {
  if (ms === null) return "none";
  if (ms <= 0) return "past";
  if (ms < 30 * 60_000) return "red";
  if (ms < 2 * 3600_000) return "amber";
  return "calm";
}
export function fmtLeft(ms: number) {
  if (ms <= 0) return "closed";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}
const tone = { none: "bg-[#E4F2E7] text-[#1A1712]", calm: "bg-[#EC6699] text-[#1A1712]", amber: "bg-[#F59100] text-[#1A1712]", red: "bg-[#C8160C] text-white", past: "bg-[#E4F2E7] text-[#6B6458]" };

export default function Countdown({ iso, label, compact }: { iso?: string | null; label?: string; compact?: boolean }) {
  const [ms, setMs] = useState<number | null>(msLeft(iso));
  useEffect(() => { const t = setInterval(() => setMs(msLeft(iso)), 1000); return () => clearInterval(t); }, [iso]);
  const u = urgency(ms);
  if (ms === null) return <span className="text-sm text-[#6B6458]">{label ? `${label}: ` : ""}no deadline found</span>;
  return (
    <span className={`inline-flex items-baseline gap-2 rounded-full px-3 py-1 font-bold transition-colors duration-[360ms] ${tone[u]} ${compact ? "text-sm" : "text-base"}`}>
      {label && <span className="opacity-80">{label}</span>}
      <span className="font-mono tabular-nums font-semibold">{fmtLeft(ms)}</span>
    </span>
  );
}
