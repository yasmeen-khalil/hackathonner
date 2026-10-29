"use client";
import { useEffect, useState } from "react";
import { api, Team } from "@/lib/api";

function H({ children }: { children: React.ReactNode }) { return <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-[#6B6458] first:mt-0">{children}</h3>; }
const who = (m: { display_name?: string | null; email?: string | null; owner: string }) => m.display_name || m.email || "A Hackathonner user";

/** A team: one leader, a share link any approved member can pass on, join requests the leader approves. */
export default function Teams() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const load = () => api.teams().then(setTeams).catch(() => setTeams([]));
  useEffect(() => { load(); }, []);

  async function create() { if (!name.trim()) return; setBusy(true); try { await api.createTeam(name.trim()); setName(""); await load(); } finally { setBusy(false); } }
  async function copyLink(t: Team) {
    const url = `${window.location.origin}/join/${t.invite_token}`;
    try { await navigator.clipboard.writeText(url); setCopied(t.id); setTimeout(() => setCopied(null), 1500); } catch { prompt("Copy this link", url); }
  }
  if (teams === null) return null;
  return (
    <section>
      <H>Teams</H>
      <p className="mb-3 text-sm text-[#6B6458]">A team shares its briefs, gameplans and notes. The leader approves who joins. Share the link with anyone who has a Hackathonner account.</p>
      {teams.map(t => (
        <div key={t.id} className="hk-block mb-3 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold">{t.name} <span className="font-normal text-[#6B6458]">· {t.role === "leader" ? "you lead this team" : t.status === "pending" ? "your request is waiting for the leader" : t.status === "declined" ? "request declined" : "member"}</span></div>
            {t.invite_token && <button onClick={() => copyLink(t)} className="rounded-full bg-white px-4 py-1.5 font-bold text-[#1A1712]">{copied === t.id ? "Link copied" : "Copy invite link"}</button>}
          </div>
          {t.status === "approved" && (
            <ul className="mt-3 space-y-1.5">{t.members.map(m => (
              <li key={m.owner} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <span>{who(m)} <span className="text-[#6B6458]">· {m.role === "leader" ? "leader" : m.status === "pending" ? "asked to join" : "member"}</span></span>
                {t.role === "leader" && m.role !== "leader" && (
                  <span className="flex gap-2">
                    {m.status === "pending" && <button onClick={() => api.memberAction(t.id, m.owner, "approve").then(load)} className="rounded-full bg-[#EC6699] px-3 py-1 text-xs font-bold text-[#1A1712]">Approve</button>}
                    {m.status === "pending" && <button onClick={() => api.memberAction(t.id, m.owner, "decline").then(load)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1A1712]">Decline</button>}
                    {m.status === "approved" && <button onClick={() => { if (confirm(`Remove ${who(m)} from ${t.name}?`)) api.memberAction(t.id, m.owner, "remove").then(load); }} className="rounded-full px-2 py-1 text-xs text-[#6B6458] hover:text-[#C8160C]">Remove</button>}
                  </span>
                )}
              </li>))}</ul>
          )}
          <div className="mt-3 text-xs text-[#6B6458]">
            {t.role === "leader"
              ? <button onClick={() => { if (confirm(`Delete ${t.name}? Its briefs go back to whoever added them.`)) api.deleteTeam(t.id).then(load); }} className="rounded-none px-0 hover:text-[#C8160C]">Delete team</button>
              : t.status === "approved" && <button onClick={() => { if (confirm(`Leave ${t.name}?`)) api.leaveTeam(t.id).then(load); }} className="rounded-none px-0 hover:text-[#C8160C]">Leave team</button>}
          </div>
        </div>
      ))}
      <div className="hk-block flex flex-wrap items-center gap-2 p-3">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} placeholder="New team name" className="min-w-0 flex-1 rounded-xl p-2 text-sm outline-none focus:ring-2 focus:ring-[#EC6699]" />
        <button disabled={busy || !name.trim()} onClick={create} className="rounded-full bg-[#EC6699] px-4 py-2 text-sm font-bold text-[#1A1712] disabled:opacity-40">Create team</button>
      </div>
    </section>
  );
}
