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

export default function MyCarriersPage(): React.JSX.Element {
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
    // Captive guard: my-carriers is independent-only (spec line 835).
    if (p.agent_type === "captive") {
      router.replace("/");
      return;
    }
    setProfile(p);
    setFilters(defaultFilters(p, "my-carriers"));
  }, [router]);

  // Fetch the broadest window (12m) once per profile. All filters apply
  // client-side via applyFilters — see /prospect for rationale.
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams({
      mode: "my-carriers",
      agent_type: profile.agent_type,
      licensed_states: profile.licensed_states.join(","),
      authorized_brands: profile.authorized_brands.join(","),
    });
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

  // Header card numbers:
  //   Carriers tracked: agent's authorized brand count (NOT the filtered
  //   carrier count — it's "how many carriers you sell", not "how many
  //   you're currently filtered to").
  //   Filings this period: filtered visible count.
  //   Largest move: absolute-value max impact in the filtered set, signed.
  const headerCard = useMemo(() => {
    if (!profile || visibleFilings.length === 0) return null;
    const largest = visibleFilings.reduce(
      (best, f) =>
        Math.abs(f.overall_rate_impact) > Math.abs(best.overall_rate_impact)
          ? f
          : best,
      visibleFilings[0],
    );
    return {
      carriersTracked: profile.authorized_brands.length,
      filingsCount: visibleFilings.length,
      largest,
    };
  }, [visibleFilings, profile]);

  if (phase === "loading" || !profile || !filters) {
    return <PageSkeleton variant="table" />;
  }

  if (phase === "error") {
    return (
      <main className="min-h-screen bg-canvas">
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-18 font-medium m-0 text-ink">
            My Carriers
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
      {/* My Carriers is independent-only; no captiveBrand suffix. */}
      <ScopeStrip states={profile.licensed_states} />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-18 font-medium m-0 text-ink">
            My Carriers
          </h1>
          <p className="text-13 mt-1 m-0 text-ink-2">
            Every recent filing from the carriers you sell — so you know what your book is doing.
          </p>
        </div>

        <FilterBar
          mode="my-carriers"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
          authorizedBrands={profile.authorized_brands}
        />

        {headerCard && (
          <div className="rounded-lg mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 bg-surface-2 px-4 py-3.5">
            <div>
              <div className="text-11 uppercase tracking-wider04 mb-0.5 text-ink-2">
                Carriers tracked
              </div>
              <div className="text-22 font-medium text-ink">
                {headerCard.carriersTracked}
              </div>
            </div>
            <div className="w-px self-stretch bg-line-2 hidden sm:block" />
            <div>
              <div className="text-11 uppercase tracking-wider04 mb-0.5 text-ink-2">
                Filings this period
              </div>
              <div
                className="text-22 font-medium text-ink"
                data-testid="header-count"
              >
                {headerCard.filingsCount}
              </div>
            </div>
            <div className="w-px self-stretch bg-line-2 hidden sm:block" />
            <div>
              <div className="text-11 uppercase tracking-wider04 mb-0.5 text-ink-2">
                Largest move
              </div>
              <div className="text-14 text-ink">
                <span
                  className={
                    headerCard.largest.overall_rate_impact >= 0
                      ? "font-medium text-red-text"
                      : "font-medium text-green-text"
                  }
                >
                  {headerCard.largest.overall_rate_impact >= 0 ? "+" : "−"}
                  {Math.abs(headerCard.largest.overall_rate_impact).toFixed(1)}%
                </span>{" "}
                {headerCard.largest.brand} in {headerCard.largest.state}
              </div>
            </div>
          </div>
        )}

        <FilingsTable
          mode="my-carriers"
          filings={visibleFilings}
          agentType={profile.agent_type}
          ownedBrands={ownedBrands}
          asOf={asOf}
          sort={filters.sort}
          onSortChange={s => setFilters(f => (f ? { ...f, sort: s } : f))}
          filteredToEmpty={visibleFilings.length === 0 && filings.length > 0}
        />
      </div>
    </main>
  );
}
