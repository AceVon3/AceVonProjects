"use client";

// Brand Health (/brand-health) — composite 0-100 score per tracked brand,
// scoped to one of the agent's licensed states, over a selectable date
// range, weighted by user-adjustable pillar sliders.
//
// Data flow: /api/brand-health?state=XX returns one state's slice —
// price computed LIVE from filings.db (filed rate momentum), the other
// pillars from the monthly snapshot (seed until their refresh phases land).
// All composite scoring happens client-side from the current weights
// (src/lib/brandHealth) so slider changes recompute instantly.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BrandHealthCard from "@/components/BrandHealthCard";
import BrandHealthMethodology from "@/components/BrandHealthMethodology";
import MetricWeightsPanel from "@/components/MetricWeightsPanel";
import PageSkeleton from "@/components/PageSkeleton";
import TopBar from "@/components/TopBar";
import {
  BH_RANGE_KEYS,
  BH_RANGE_LABELS,
  type BhRangeKey,
  type BrandHealthResult,
  type BrandNationalMetrics,
  type BrandStateMetrics,
  calculateBrandHealth,
  DEFAULT_BH_RANGE,
  DEFAULT_WEIGHTS,
  normalizeWeights,
  PILLAR_LABELS,
  type PillarKey,
  resolvePillars,
  type SourceBackedMetric,
  type Weights,
} from "@/lib/brandHealth";
import { BRANDS, type Brand } from "@/lib/constants";
import { AgentProfile, loadProfile } from "@/lib/profile";

type ApiResponse = {
  asOf: string;
  dataYear: number;
  national: Record<Brand, BrandNationalMetrics>;
  brands: Record<Brand, BrandStateMetrics>;
  seedPillars: PillarKey[];
};

type CardData = {
  brand: Brand;
  result: BrandHealthResult | null;
  metrics: Record<PillarKey, SourceBackedMetric | null>;
};

export default function BrandHealthPage(): React.JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [state, setState] = useState<string>("");
  const [range, setRange] = useState<BhRangeKey>(DEFAULT_BH_RANGE);
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setState(p.licensed_states[0] ?? "");
  }, [router]);

  // Fetch the state slice whenever the state changes. Previous data stays
  // on screen during a switch (no skeleton flash); errors surface inline.
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    fetch(`/api/brand-health?state=${encodeURIComponent(state)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(d => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch(e => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Score every brand for the current range/weights. Weights always pass
  // through normalizeWeights so the applied formula matches the panel.
  const cards: CardData[] = useMemo(() => {
    if (!data) return [];
    const applied = normalizeWeights(weights);
    const rows = BRANDS.map(brand => {
      const { scores, metrics } = resolvePillars(
        data.national[brand],
        data.brands[brand],
        range,
      );
      return { brand, metrics, result: calculateBrandHealth(scores, applied) };
    });
    // Rank by score desc; unscorable brands sink to the bottom alphabetically.
    rows.sort((a, b) => {
      if (a.result && b.result) return b.result.score - a.result.score || a.brand.localeCompare(b.brand);
      if (a.result) return -1;
      if (b.result) return 1;
      return a.brand.localeCompare(b.brand);
    });
    return rows;
  }, [data, range, weights]);

  if (!profile || !state) return <PageSkeleton variant="table" />;

  if (error && !data) {
    return (
      <main className="min-h-screen bg-canvas">
        <TopBar title="Brand Health" />
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
          <p className="text-13 m-0 p-3 rounded-md text-red-text bg-red-fill border border-red-border">
            Couldn&apos;t load Brand Health data: {error}
          </p>
        </div>
      </main>
    );
  }

  if (!data) return <PageSkeleton variant="table" />;

  const seedNames = data.seedPillars.map(k => PILLAR_LABELS[k]);
  const livePillars = (["price", "sentiment", "search", "website"] as PillarKey[]).filter(
    k => !data.seedPillars.includes(k),
  );

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar
        title="Brand Health"
        chips={[{ icon: "map-pin", label: state }]}
        asOf={data.asOf}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          A weighted composite of price momentum, customer sentiment, search interest, and
          website performance for every tracked brand in {state}. Adjust the weights to match
          what matters in your market.
        </p>

        {data.seedPillars.length > 0 && (
          <div
            data-testid="bh-seed-banner"
            className="mb-4 rounded-tile bg-amber-fill text-amber-text border border-amber-border px-[18px] py-3 text-13 leading-normal"
          >
            <span className="font-bold">Preview — partial placeholder data.</span>{" "}
            {seedNames.join(", ")} {seedNames.length === 1 ? "is" : "are"} still seed values.
            {livePillars.length > 0 && (
              <> {livePillars.map(k => PILLAR_LABELS[k]).join(", ")} {livePillars.length === 1 ? "is" : "are"} live from real source data.</>
            )}{" "}
            This banner disappears once every pillar is live.
          </div>
        )}

        {/* Controls: state select + date-range pills */}
        <div className="flex gap-2 mb-4 flex-wrap items-center" data-testid="bh-controls">
          <span className="text-ink-3 uppercase text-11 tracking-wider04 mr-1">State</span>
          <select
            data-testid="bh-state-select"
            value={state}
            onChange={e => setState(e.target.value)}
            className="bg-surface border border-line-2 rounded-full px-3 py-[5px] text-12 text-ink cursor-pointer"
          >
            {profile.licensed_states.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <span className="text-ink-3 uppercase text-11 tracking-wider04 ml-3 mr-1">Range</span>
          <div className="flex gap-1 flex-wrap">
            {BH_RANGE_KEYS.map(k => (
              <button
                key={k}
                type="button"
                data-testid={`bh-range-${k}`}
                data-selected={range === k ? "true" : "false"}
                onClick={() => setRange(k)}
                className={[
                  "rounded-full px-3 py-[5px] text-12 cursor-pointer border transition-colors",
                  range === k
                    ? "bg-brand-navy border-brand-navy text-white font-medium"
                    : "bg-surface border-line-2 text-ink hover:bg-soft",
                ].join(" ")}
              >
                {BH_RANGE_LABELS[k]}
              </button>
            ))}
          </div>

          <span className="w-full md:w-auto md:ml-auto text-12 text-ink-3">
            Quarters refer to {data.dataYear}. Sentiment &amp; website are point-in-time.
          </span>
        </div>

        <div className="mb-5">
          <MetricWeightsPanel weights={weights} onChange={setWeights} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-start mb-5">
          {cards.map(c => (
            <BrandHealthCard
              key={c.brand}
              brand={c.brand}
              result={c.result}
              metrics={c.metrics}
              state={state}
              ownBadge={
                profile.authorized_brands.includes(c.brand)
                  ? profile.agent_type === "captive"
                    ? "Your Carrier"
                    : "You sell"
                  : undefined
              }
            />
          ))}
        </div>

        <BrandHealthMethodology />
      </div>
    </main>
  );
}
