"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import FilterBar from "@/components/FilterBar";
import PageSkeleton from "@/components/PageSkeleton";
import ScopeStrip from "@/components/ScopeStrip";
import type { Filing } from "@/lib/filings";
import {
  FilterState,
  applyFilters,
  defaultFilters,
} from "@/lib/filters";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[] };

export default function ProspectPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
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
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-18 font-medium m-0 text-ink">
            Prospect
          </h1>
          <p className="text-13 mt-3 p-3 rounded-md text-red-text bg-red-fill border border-hairline border-line">
            Couldn’t load filings: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <ScopeStrip
        states={profile.licensed_states}
        captiveBrand={
          profile.agent_type === "captive" ? profile.authorized_brands[0] : undefined
        }
      />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-18 font-medium m-0 text-ink">
            Prospect
          </h1>
          <p className="text-13 mt-1 m-0 text-ink-2">
            Rate increases in your states — opportunities to attack and decisions to make.
          </p>
        </div>

        <FilterBar
          mode="prospect"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
        />

        {headerCard && (
          <div className="rounded-lg mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 bg-surface-2 px-4 py-3.5">
            <div>
              <div className="text-11 uppercase tracking-wider04 mb-0.5 text-ink-2">
                Filings in your states
              </div>
              <div
                className="text-22 font-medium text-ink"
                data-testid="header-count"
              >
                {headerCard.count}
              </div>
            </div>
            <div className="w-px self-stretch bg-line-2 hidden sm:block" />
            <div>
              <div className="text-11 uppercase tracking-wider04 mb-0.5 text-ink-2">
                Largest move
              </div>
              <div className="text-14 text-ink">
                <span className="font-medium text-red-text">
                  {headerCard.largest.overall_rate_impact >= 0 ? "+" : "−"}
                  {Math.abs(headerCard.largest.overall_rate_impact).toFixed(1)}%
                </span>{" "}
                by {headerCard.largest.brand} in {headerCard.largest.state}
              </div>
            </div>
          </div>
        )}

        <FilingsTable
          mode="prospect"
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
