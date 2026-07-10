"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OverviewCards from "@/components/OverviewCards";
import PageSkeleton from "@/components/PageSkeleton";
import RecentChanges from "@/components/RecentChanges";
import TopBar, { ScopeChip } from "@/components/TopBar";
import type { Filing } from "@/lib/filings";
import { computeRecentChanges } from "@/lib/overview";
import { AgentProfile, loadProfile } from "@/lib/profile";
import { computeOpportunity, computeRetentionRisk } from "@/lib/retention";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[] };

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
  const [myCarriers, setMyCarriers] = useState<Filing[]>([]);
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

    const fetchMode = async (
      mode: "prospect" | "defend" | "my-carriers",
    ): Promise<ApiResponse> => {
      const params = new URLSearchParams(common);
      params.set("mode", mode);
      const r = await fetch(`/api/filings?${params.toString()}`);
      if (!r.ok) {
        throw new Error(`${mode}: ${(await r.json()).error ?? `HTTP ${r.status}`}`);
      }
      return r.json();
    };

    // My-carriers feeds the "Your carrier's activity" summary; it pulls the
    // SAME own-carrier filings the /my-carriers page renders (both agent
    // types can request it), so the two views reconcile by construction.
    Promise.all([fetchMode("prospect"), fetchMode("defend"), fetchMode("my-carriers")])
      .then(([p1, p2, p3]) => {
        setAsOf(p1.asOf);
        setProspect(p1.filings);
        setDefend(p2.filings);
        setMyCarriers(p3.filings);
        setPhase("ready");
      })
      .catch(e => {
        setError(String(e?.message ?? e));
        setPhase("error");
      });
  }, [router]);

  const recentChanges = useMemo(() => {
    if (!asOf) return [];
    return computeRecentChanges(prospect, defend, asOf);
  }, [prospect, defend, asOf]);

  // Own-carrier alerts for the "My Carrier" card — both directions over the SAME
  // full my-carriers set, via the same shared helpers the /my-carriers tab uses,
  // so the dashboard counts reconcile with that tab by construction.
  const retentionRisk = useMemo(
    () => computeRetentionRisk(myCarriers, asOf),
    [myCarriers, asOf],
  );
  const opportunity = useMemo(
    () => computeOpportunity(myCarriers, asOf),
    [myCarriers, asOf],
  );

  // Scope chips for the top bar — same profile facts the old subtitle showed:
  // licensed states, plus the brand (captive) or carrier count (independent).
  const chips = useMemo<ScopeChip[]>(() => {
    if (!profile) return [];
    const carrierLabel =
      profile.agent_type === "captive"
        ? profile.authorized_brands[0]
        : `${profile.authorized_brands.length} ${profile.authorized_brands.length === 1 ? "carrier" : "carriers"}`;
    return [
      { icon: "map-pin", label: profile.licensed_states.join(", ") },
      { icon: "briefcase", label: carrierLabel },
    ];
  }, [profile]);

  if (phase === "loading") {
    return <PageSkeleton variant="overview" />;
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen bg-canvas">
        <TopBar title="Overview" />
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
          <p className="text-13 m-0 p-3 rounded-md text-red-text bg-red-fill border border-red-border">
            Couldn’t load Overview: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar title="Overview" chips={chips} asOf={asOf} />
      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <OverviewCards
          prospectCount={prospect.length}
          defendCount={defend.length}
          retentionCount={retentionRisk.count}
          opportunityCount={opportunity.count}
          employeeStatesCount={profile!.employee_states.length}
          todayLabel={todayShort()}
        />

        <RecentChanges rows={recentChanges} />
      </div>
    </main>
  );
}
