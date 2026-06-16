"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import FilterBar from "@/components/FilterBar";
import PageSkeleton from "@/components/PageSkeleton";
import ScopeStrip from "@/components/ScopeStrip";
import type { Filing } from "@/lib/filings";
import { Coverage, coverageGapNote } from "@/lib/coverage";
import { FilterState, applyFilters, defaultFilters } from "@/lib/filters";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[]; coverage: Coverage; neutralHidden: number };

export default function MyCarriersPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [coverage, setCoverage] = useState<Coverage>({});
  const [neutralHidden, setNeutralHidden] = useState<number>(0);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    // My Carriers is available to both agent types — no captive redirect.
    // A captive sees their single authorized carrier's filings here.
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
    // Captive requests must carry captive_brand (the API validates it).
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
        setNeutralHidden(data.neutralHidden ?? 0);
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

  // Single-carrier (captive) framing: a captive sells exactly one carrier, so
  // "My Carriers" (plural) and a "Carriers tracked: 1" count read oddly. Use a
  // singular label and name the actual carrier.
  const isCaptive = profile.agent_type === "captive";
  const carrierBrand = profile.authorized_brands[0];
  const pageTitle = isCaptive ? "My Carrier" : "My Carriers";
  const pageSubtitle = isCaptive
    ? `Every recent ${carrierBrand} filing in your states — so you know what your book is doing.`
    : "Every recent filing from the carriers you sell — so you know what your book is doing.";

  if (phase === "error") {
    return (
      <main className="min-h-screen bg-canvas">
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-18 font-medium m-0 text-ink">
            {pageTitle}
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
      {/* My Carriers shows the agent's OWN carrier(s), not competitors —
          so no "vs competitors of {brand}" suffix even for captives. */}
      <ScopeStrip states={profile.licensed_states} />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-18 font-medium m-0 text-ink">
            {pageTitle}
          </h1>
          <p className="text-13 mt-1 m-0 text-ink-2">
            {pageSubtitle}
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
                {isCaptive ? "Your carrier" : "Carriers tracked"}
              </div>
              {isCaptive ? (
                <div className="text-17 font-medium text-ink">{carrierBrand}</div>
              ) : (
                <div className="text-22 font-medium text-ink">
                  {headerCard.carriersTracked}
                </div>
              )}
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

        {/* Honest accounting for the rate-neutral suppression: explains why the
            visible count is lower than the agent's book might suggest. Shown
            above the table in BOTH the populated and empty-state cases — it is a
            separate line, NOT the empty-state variant, so a neutral-only carrier
            still renders the normal "no recent moves" empty state below. */}
        {neutralHidden > 0 && (
          <div
            data-testid="neutral-hidden-note"
            className="mb-3 text-11 text-ink-3"
          >
            {neutralHidden} rate-neutral filing{neutralHidden === 1 ? "" : "s"} (0.0%)
            hidden — these moved no rate. See Prospect/Defend for rate changes that cross the thresholds.
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
          coverageGap={coverageGap}
        />
      </div>
    </main>
  );
}
