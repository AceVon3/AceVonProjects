"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import FilterBar from "@/components/FilterBar";
import PageSkeleton from "@/components/PageSkeleton";
import TopBar from "@/components/TopBar";
import type { Filing } from "@/lib/filings";
import { Coverage, coverageGapNote } from "@/lib/coverage";
import { FilterState, applyFilters, defaultFilters } from "@/lib/filters";
import { formatRateImpact } from "@/lib/format";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[]; coverage: Coverage };

export default function DefendPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [coverage, setCoverage] = useState<Coverage>({});
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
        setCoverage(data.coverage ?? {});
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

  const coverageGap = useMemo(
    () => (profile ? coverageGapNote(profile.authorized_brands, profile.licensed_states, coverage) : null),
    [profile, coverage],
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
      <main className="min-h-screen bg-canvas">
        <TopBar title="Defend" />
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
          <p className="text-13 m-0 p-3 rounded-md text-red-text bg-red-fill border border-red-border">
            Couldn’t load filings: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar
        title="Defend"
        chips={[{ icon: "map-pin", label: profile.licensed_states.join(", ") }]}
        asOf={asOf}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        {/* Same per-agent-type split as Prospect: only captives see a pure
            competitor set. Wording per design 3b. */}
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          {profile.agent_type === "captive"
            ? `Rate cuts by ${profile.authorized_brands[0]}'s competitors in your states — your customers may be shopping. Lock in renewals before they do.`
            : "Rate cuts in your states from competitors and carriers you sell — your customers may be shopping. Lock in renewals before they do."}
        </p>

        <FilterBar
          mode="defend"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
          summary={
            headerCard && (
              <>
                <strong className="text-ink font-semibold" data-testid="header-count">
                  {headerCard.count}
                </strong>{" "}
                {headerCard.count === 1 ? "filing" : "filings"} · biggest cut{" "}
                {/* Defend = blue category color (design 3b) */}
                <strong className="font-bold text-blue-text tabular-nums">
                  {formatRateImpact(headerCard.biggestCut.overall_rate_impact)}
                </strong>{" "}
                by {headerCard.biggestCut.brand} in {headerCard.biggestCut.state}
              </>
            )
          }
        />

        <FilingsTable
          mode="defend"
          filings={visibleFilings}
          agentType={profile.agent_type}
          ownedBrands={ownedBrands}
          asOf={asOf}
          sort={filters.sort}
          onSortChange={s => setFilters(f => (f ? { ...f, sort: s } : f))}
          filteredToEmpty={visibleFilings.length === 0 && filings.length > 0}
          coverageGap={coverageGap}
        />
      </div>
    </main>
  );
}
