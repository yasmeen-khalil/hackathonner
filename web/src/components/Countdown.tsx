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
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
const tone = { none: "bg-neutral-200 text-neutral-700", calm: "bg-neutral-900 text-white", amber: "bg-amber-500 text-black", red: "bg-red-600 text-white", past: "bg-neutral-300 text-neutral-600" };

export default function Countdown({ iso, label, compact }: { iso?: string | null; label?: string; compact?: boolean }) {
  const [ms, setMs] = useState<number | null>(msLeft(iso));
  useEffect(() => { const t = setInterval(() => setMs(msLeft(iso)), 1000); return () => clearInterval(t); }, [iso]);
  const u = urgency(ms);
  if (ms === null) return <span className="text-sm text-neutral-500">{label ? `${label}: ` : ""}no deadline found</span>;
  return (
    <span className={`inline-flex items-baseline gap-2 rounded px-2 py-1 ${tone[u]} ${compact ? "text-sm" : "text-base"}`}>
      {label && <span className="opacity-80">{label}</span>}
      <span className="font-mono tabular-nums font-semibold">{fmtLeft(ms)}</span>
    </span>
  );
}
