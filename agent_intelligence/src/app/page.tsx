"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OverviewCards from "@/components/OverviewCards";
import RecentChanges from "@/components/RecentChanges";
import type { Filing } from "@/lib/filings";
import {
  computeMostUrgent,
  computeRecentChanges,
} from "@/lib/overview";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[] };

const C = {
  bg: "#fafaf9",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  surface2: "#F4F2EC",
  redText: "#A32D2D",
  blueText: "#0C447C",
};

// "May 28" — used for the Compliance card's "Last checked" line.
function todayShort(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OverviewPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [prospect, setProspect] = useState<Filing[]>([]);
  const [defend, setDefend] = useState<Filing[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);

    // Fetch the same /api/filings endpoint the table pages use, twice in
    // parallel. Counts will match by construction.
    const common = new URLSearchParams({
      agent_type: p.agent_type,
      licensed_states: p.licensed_states.join(","),
      authorized_brands: p.authorized_brands.join(","),
    });
    if (p.agent_type === "captive") {
      common.set("captive_brand", p.authorized_brands[0]);
    }

    const fetchMode = async (mode: "prospect" | "defend"): Promise<ApiResponse> => {
      const params = new URLSearchParams(common);
      params.set("mode", mode);
      const r = await fetch(`/api/filings?${params.toString()}`);
      if (!r.ok) {
        throw new Error(`${mode}: ${(await r.json()).error ?? `HTTP ${r.status}`}`);
      }
      return r.json();
    };

    Promise.all([fetchMode("prospect"), fetchMode("defend")])
      .then(([p1, p2]) => {
        setAsOf(p1.asOf);
        setProspect(p1.filings);
        setDefend(p2.filings);
        setPhase("ready");
      })
      .catch(e => {
        setError(String(e?.message ?? e));
        setPhase("error");
      });
  }, [router]);

  const mostUrgent = useMemo(() => {
    if (!asOf) return null;
    return computeMostUrgent(prospect, defend, asOf);
  }, [prospect, defend, asOf]);

  const recentChanges = useMemo(() => {
    if (!asOf) return [];
    return computeRecentChanges(prospect, defend, asOf);
  }, [prospect, defend, asOf]);

  const subtitle = useMemo(() => {
    if (!profile) return "";
    if (profile.agent_type === "captive") {
      return `${profile.authorized_brands[0]} · ${profile.licensed_states.join(", ")}`;
    }
    const n = profile.authorized_brands.length;
    return `${profile.licensed_states.join(", ")} · ${n} ${n === 1 ? "carrier" : "carriers"}`;
  }, [profile]);

  if (phase === "loading") {
    return (
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div
          className="max-w-[1100px] mx-auto px-4 py-10 text-[13px]"
          style={{ color: C.text3 }}
        >
          Loading…
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            Overview
          </h1>
          <p
            className="text-[13px] mt-3 p-3 rounded-md"
            style={{
              color: C.redText,
              background: "#FCEBEB",
              border: "0.5px solid rgba(0,0,0,0.08)",
            }}
          >
            Couldn’t load Overview: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <div className="mb-5">
          <h1
            className="text-[18px] font-medium m-0"
            style={{ color: C.text }}
            data-testid="page-title"
          >
            Overview
          </h1>
          <p
            className="text-[13px] mt-1 m-0"
            style={{ color: C.text2 }}
            data-testid="page-subtitle"
          >
            {subtitle}
          </p>
        </div>

        <OverviewCards
          prospectCount={prospect.length}
          defendCount={defend.length}
          mostUrgent={mostUrgent}
          employeeStatesCount={profile!.employee_states.length}
          todayLabel={todayShort()}
        />

        <RecentChanges rows={recentChanges} />
      </div>
    </main>
  );
}
