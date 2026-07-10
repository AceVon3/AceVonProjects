"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import FilterBar from "@/components/FilterBar";
import PageSkeleton from "@/components/PageSkeleton";
import TopBar from "@/components/TopBar";
import type { Filing } from "@/lib/filings";
import { formatRateImpact } from "@/lib/format";
import { Coverage, coverageGapNote } from "@/lib/coverage";
import {
  FilterState,
  applyFilters,
  defaultFilters,
} from "@/lib/filters";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[]; coverage: Coverage };

export default function ProspectPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [coverage, setCoverage] = useState<Coverage>({});
  const [error, setError] = useState<string>("");

  // Profile + initial filters (runs once on mount).
  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setFilters(defaultFilters(p, "prospect"));
  }, [router]);

  // Fetch the broadest window (12m) once per profile. All filters
  // (state, line, window, sort) then apply client-side via applyFilters —
  // instant, no network round-trip, and the raw `filings` count stays
  // intact so we can distinguish "filtered to empty" from "no data".
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams({
      mode: "prospect",
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

  // Honest "we don't collect <brand> here yet" note for brands with no data in
  // the agent's states (e.g. the GA-only new carriers). Null when all covered.
  const coverageGap = useMemo(
    () => (profile ? coverageGapNote(profile.authorized_brands, profile.licensed_states, coverage) : null),
    [profile, coverage],
  );

  // Apply all filters (state, line, window, sort) client-side.
  const visibleFilings = useMemo(
    () => (filters && asOf ? applyFilters(filings, filters, asOf) : filings),
    [filings, filters, asOf],
  );

  // Header card reflects the filtered count, not the raw API result.
  const headerCard = useMemo(() => {
    if (visibleFilings.length === 0) return null;
    const states = new Set(visibleFilings.map(f => f.state));
    const largest = visibleFilings.reduce(
      (best, f) => (f.overall_rate_impact > best.overall_rate_impact ? f : best),
      visibleFilings[0],
    );
    return {
      count: visibleFilings.length,
      stateCount: states.size,
      largest,
    };
  }, [visibleFilings]);

  if (phase === "loading" || !profile || !filters) {
    return <PageSkeleton variant="table" />;
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen bg-canvas">
        <TopBar title="Prospect" />
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
        title="Prospect"
        chips={[{ icon: "map-pin", label: profile.licensed_states.join(", ") }]}
        asOf={asOf}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        {/* Captive Prospect excludes the agent's own brand, so "competitors"
            is literally true; independent Prospect includes carriers the
            agent sells (spec §Important framing change), so it can't say
            that — the wording differs per agent type. */}
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          {profile.agent_type === "captive"
            ? `Rate increases filed by ${profile.authorized_brands[0]}'s competitors in your states — opportunities to attack and decisions to make.`
            : "Rate increases in your states from competitors and carriers you sell — opportunities to attack and decisions to make."}
        </p>

        <FilterBar
          mode="prospect"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
          summary={
            headerCard && (
              <>
                <strong className="text-ink font-semibold" data-testid="header-count">
                  {headerCard.count}
                </strong>{" "}
                {headerCard.count === 1 ? "filing" : "filings"} · largest{" "}
                {/* Prospect = red category color (design 3a) */}
                <strong className="font-bold text-brand-red tabular-nums">
                  {formatRateImpact(headerCard.largest.overall_rate_impact)}
                </strong>{" "}
                by {headerCard.largest.brand} in {headerCard.largest.state}
              </>
            )
          }
        />

        <FilingsTable
          mode="prospect"
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
