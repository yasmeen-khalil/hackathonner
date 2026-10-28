"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
const FIELDS: [string, string, boolean][] = [["name", "Your name", false], ["handle", "Team handle (lowercase, numbers, dashes)", false], ["working_on", "What you are working on", true], ["goals", "Goals for the next few months", true], ["interests", "Interests and topics you read about", true], ["stack", "Stack and tools you build with", false], ["city", "Home city", false], ["availability", "Availability (weekends, weekday evenings, travel ok?)", false]];
export default function Profile() {
  const [p, setP] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.profile().then(setP).catch(() => {}); }, []);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Profile</h1>
      <p className="mb-4 text-sm text-neutral-500">This informs which hackathons rank first in Discover. It never filters anything out.</p>
      <div className="space-y-3">{FIELDS.map(([k, label, long]) => (
        <label key={k} className="block text-sm">{label}
          {long ? <textarea rows={2} value={p[k] || ""} onChange={e => setP({ ...p, [k]: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 bg-white p-2 text-sm" />
            : <input value={p[k] || ""} onChange={e => setP({ ...p, [k]: e.target.value })} className="mt-1 w-full rounded border border-neutral-300 bg-white p-2 text-sm" />}
        </label>))}</div>
      <button onClick={async () => { await api.saveProfile(p); setSaved(true); setTimeout(() => setSaved(false), 1500); }} className="mt-4 rounded bg-black px-4 py-2 text-sm text-white">{saved ? "Saved" : "Save"}</button>
    </div>
  );
}
