"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function JoinPage() { return <Suspense fallback={null}><Join /></Suspense>; }

function Join() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<{ name: string } | null | undefined>(undefined);
  const [result, setResult] = useState<string>("");
  useEffect(() => { api.joinPreview(token).then(setTeam).catch(() => setTeam(null)); }, [token]);
  if (team === undefined) return null;
  if (team === null) return <p className="mx-auto max-w-md text-sm text-[#6B6458]">This invite link is not valid. Ask the team for a fresh one.</p>;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-normal tracking-tight">Join {team.name}</h1>
      <p className="mt-2 text-sm text-[#6B6458]">The team leader approves requests. Once approved you see the team's briefs, gameplans and notes.</p>
      {!result ? (
        <button onClick={async () => { const r = await api.joinRequest(token); setResult(r.status); }} className="mt-5 rounded-full bg-[#EC6699] px-5 py-2 text-sm font-bold text-[#1A1712]">Request to join</button>
      ) : (
        <div className="hk-block mt-5 p-4 text-sm">
          {result === "approved" ? "You are already a member." : result === "declined" ? "The leader declined an earlier request. Ask them to approve you from their Profile." : "Request sent. The leader will see it on their Profile page."}
          <div className="mt-3"><button onClick={() => router.push("/")} className="rounded-full bg-white px-4 py-1.5 font-bold text-[#1A1712]">Back to Home</button></div>
        </div>
      )}
    </div>
  );
}
