"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import FilterBar from "@/components/FilterBar";
import PageSkeleton from "@/components/PageSkeleton";
import ScopeStrip from "@/components/ScopeStrip";
import type { Filing } from "@/lib/filings";
import { FilterState, applyFilters, defaultFilters } from "@/lib/filters";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[] };

const C = {
  bg: "#fafaf9",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  surface2: "#F4F2EC",
  redText: "#A32D2D",
  blueText: "#0C447C",
};

export default function DefendPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setFilters(defaultFilters(p, "defend"));
  }, [router]);

  // Fetch the broadest window (12m) once per profile. All filters apply
  // client-side via applyFilters — see /prospect for rationale.
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams({
      mode: "defend",
      agent_type: profile.agent_type,
      licensed_states: profile.licensed_states.join(","),
      authorized_brands: profile.authorized_brands.join(","),
    });
    if (profile.agent_type === "captive") {
      params.set("captive_brand", profile.authorized_brands[0]);
    }
    fetch(`/api/filings?${params.toString()}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(data => {
        setAsOf(data.asOf);
        setFilings(data.filings);
        setPhase("ready");
      })
      .catch(e => {
        setError(String(e?.message ?? e));
        setPhase("error");
      });
  }, [profile]);

  const ownedBrands = useMemo(
    () => new Set(profile?.authorized_brands ?? []),
    [profile],
  );

  const visibleFilings = useMemo(
    () => (filters && asOf ? applyFilters(filings, filters, asOf) : filings),
    [filings, filters, asOf],
  );

  // Header card numbers — "Biggest cut" = most-negative impact in the
  // filtered set (rows are <= -2% so they're all negative).
  const headerCard = useMemo(() => {
    if (visibleFilings.length === 0) return null;
    const states = new Set(visibleFilings.map(f => f.state));
    const biggestCut = visibleFilings.reduce(
      (best, f) => (f.overall_rate_impact < best.overall_rate_impact ? f : best),
      visibleFilings[0],
    );
    return { count: visibleFilings.length, stateCount: states.size, biggestCut };
  }, [visibleFilings]);

  if (phase === "loading" || !profile || !filters) {
    return <PageSkeleton variant="table" />;
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            Defend
          </h1>
          <p
            className="text-[13px] mt-3 p-3 rounded-md"
            style={{
              color: C.redText,
              background: "#FCEBEB",
              border: "0.5px solid rgba(0,0,0,0.08)",
            }}
          >
            Couldn’t load filings: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: C.bg }}>
      <ScopeStrip
        states={profile.licensed_states}
        captiveBrand={
          profile.agent_type === "captive" ? profile.authorized_brands[0] : undefined
        }
      />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            Defend
          </h1>
          <p className="text-[13px] mt-1 m-0" style={{ color: C.text2 }}>
            Rate decreases in your states — your customers may shop.
          </p>
        </div>

        <FilterBar
          mode="defend"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
        />

        {headerCard && (
          <div
            className="rounded-lg mb-4 flex gap-6 items-center"
            style={{ background: C.surface2, padding: "14px 16px" }}
          >
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.4px] mb-0.5"
                style={{ color: C.text2 }}
              >
                Carriers getting cheaper
              </div>
              <div
                className="text-[22px] font-medium"
                style={{ color: C.text }}
                data-testid="header-count"
              >
                {headerCard.count}
              </div>
            </div>
            <div style={{ width: "0.5px", background: C.line2, alignSelf: "stretch" }} />
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.4px] mb-0.5"
                style={{ color: C.text2 }}
              >
                Biggest cut
              </div>
              <div className="text-[14px]" style={{ color: C.text }}>
                <span style={{ fontWeight: 500, color: C.redText }}>
                  −{Math.abs(headerCard.biggestCut.overall_rate_impact).toFixed(1)}%
                </span>{" "}
                by {headerCard.biggestCut.brand} in {headerCard.biggestCut.state}
              </div>
            </div>
          </div>
        )}

        <FilingsTable
          mode="defend"
          filings={visibleFilings}
          agentType={profile.agent_type}
          ownedBrands={ownedBrands}
          asOf={asOf}
          filteredToEmpty={visibleFilings.length === 0 && filings.length > 0}
        />
      </div>
    </main>
  );
}
