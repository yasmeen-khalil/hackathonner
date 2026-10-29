"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
const FIELDS: [string, string, boolean][] = [["name", "Your name", false], ["working_on", "What you are working on", true], ["goals", "Goals for the next few months", true], ["interests", "Interests and topics you read about", true], ["stack", "Stack and tools you build with", false], ["city", "Home city", false], ["availability", "Availability (weekends, weekday evenings, travel ok?)", false]];
export default function Profile() {
  const [p, setP] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.profile().then(setP).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Profile</h1>
      <p className="mb-4 text-sm text-[#6B6458]">This informs which hackathons rank first in Discover. It never filters anything out.</p>
      <div className="space-y-3">{FIELDS.map(([k, label, long]) => (
        <label key={k} className="block text-sm">{label}
          {long ? <textarea rows={2} value={p[k] || ""} onChange={e => setP({ ...p, [k]: e.target.value })} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />
            : <input value={p[k] || ""} onChange={e => setP({ ...p, [k]: e.target.value })} className="mt-1 w-full rounded-xl bg-[#E4F2E7] p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />}
        </label>))}</div>
      <button onClick={async () => { await api.saveProfile(p); setSaved(true); setTimeout(() => setSaved(false), 1500); }} className="mt-4 rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712]">{saved ? "Saved" : "Save"}</button>
    </div>
  );
}
