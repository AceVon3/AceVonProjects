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
import { OPPORTUNITY_THRESHOLD, RETENTION_THRESHOLD, computeOpportunity, computeRetentionRisk } from "@/lib/retention";

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

  // Retention-risk signal — the agent's OWN carrier(s) raising rates >= +5% in
  // the FILTERED set (respects the chips, like the other band stats). Derived
  // client-side from the already-fetched own-carrier filings via the shared
  // computeRetentionRisk, so it reconciles with the dashboard's carrier card.
  const retention = useMemo(
    () => computeRetentionRisk(visibleFilings, asOf),
    [visibleFilings, asOf],
  );

  // Opportunity signal — own-carrier DECREASES (down 2% or more) in the FILTERED
  // set, same window/source as retention. Reconciles with the dashboard "My
  // Carrier" card's opportunity count via the shared computeOpportunity.
  const opportunity = useMemo(
    () => computeOpportunity(visibleFilings, asOf),
    [visibleFilings, asOf],
  );

  // Row-pill membership (design 3c): the same alert sets the two summary
  // cards count, keyed by filing id so the table pills reconcile exactly.
  const alertIds = useMemo(
    () => ({
      retention: new Set(retention.filings.map(f => f.id)),
      opportunity: new Set(opportunity.filings.map(f => f.id)),
    }),
    [retention, opportunity],
  );

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
        <TopBar title={pageTitle} />
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
      {/* My Carriers shows the agent's OWN carrier(s) — the scope chip lists
          them (design 3c). No "vs competitors" framing even for captives. */}
      <TopBar
        title={pageTitle}
        chips={[{ icon: "briefcase", label: profile.authorized_brands.join(", ") }]}
        asOf={asOf}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          {pageSubtitle}
        </p>

        {/* Two own-carrier alert summary cards (design 3c). Same
            computeRetentionRisk / computeOpportunity numbers the dashboard
            card shows, over the FILTERED set — the counts stay reconciled. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4 flex items-baseline gap-3">
            <span
              className={`text-28 font-bold leading-none tabular-nums ${retention.count > 0 ? "text-brand-red" : "text-ink-3"}`}
              data-testid="retention-count"
            >
              {retention.count}
            </span>
            <span className="text-13 text-ink-2">
              retention risk alert{retention.count === 1 ? "" : "s"} — your{" "}
              {isCaptive ? "carrier" : "carriers"} raised ≥ +{RETENTION_THRESHOLD}%
            </span>
          </div>
          <div className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4 flex items-baseline gap-3">
            <span
              className={`text-28 font-bold leading-none tabular-nums ${opportunity.count > 0 ? "text-green-text" : "text-ink-3"}`}
              data-testid="opportunity-count"
            >
              {opportunity.count}
            </span>
            <span className="text-13 text-ink-2">
              opportunity alert{opportunity.count === 1 ? "" : "s"} — your{" "}
              {isCaptive ? "carrier" : "carriers"} cut ≤ {OPPORTUNITY_THRESHOLD}%
            </span>
          </div>
        </div>

        <FilterBar
          mode="my-carriers"
          filters={filters}
          onChange={setFilters}
          licensedStates={profile.licensed_states}
          authorizedBrands={profile.authorized_brands}
          summary={
            headerCard && (
              <>
                <strong className="text-ink font-semibold" data-testid="header-count">
                  {headerCard.filingsCount}
                </strong>{" "}
                {headerCard.filingsCount === 1 ? "filing" : "filings"} · largest move{" "}
                <strong
                  className={`font-bold tabular-nums ${
                    headerCard.largest.overall_rate_impact >= RETENTION_THRESHOLD
                      ? "text-brand-red"
                      : headerCard.largest.overall_rate_impact <= OPPORTUNITY_THRESHOLD
                        ? "text-green-text"
                        : "text-ink"
                  }`}
                >
                  {formatRateImpact(headerCard.largest.overall_rate_impact)}
                </strong>{" "}
                by {headerCard.largest.brand} in {headerCard.largest.state}
              </>
            )
          }
        />

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
          alertIds={alertIds}
        />
      </div>
    </main>
  );
}
