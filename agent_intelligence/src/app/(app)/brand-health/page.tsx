"use client";

// Brand Health (/brand-health) — composite 0-100 score per tracked brand,
// scoped to one of the agent's licensed states, over a selectable date
// range, weighted by user-adjustable pillar sliders. Reads the monthly
// pre-generated snapshot (src/lib/brandHealthData.ts) — no live fetching,
// same pattern as compliance. All scoring math lives in src/lib/brandHealth.

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
  calculateBrandHealth,
  DEFAULT_BH_RANGE,
  DEFAULT_WEIGHTS,
  getPillarScores,
  normalizeWeights,
  type PillarKey,
  type SourceBackedMetric,
  type Weights,
} from "@/lib/brandHealth";
import { BRAND_HEALTH_SNAPSHOT } from "@/lib/brandHealthData";
import { BRANDS, type Brand } from "@/lib/constants";
import { AgentProfile, loadProfile } from "@/lib/profile";

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

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setState(p.licensed_states[0] ?? "");
  }, [router]);

  const snapshot = BRAND_HEALTH_SNAPSHOT;

  // Score every brand for the current state/range/weights. Weights always
  // pass through normalizeWeights so the applied formula matches the panel.
  const cards: CardData[] = useMemo(() => {
    if (!state) return [];
    const applied = normalizeWeights(weights);
    const rows = BRANDS.map(brand => {
      const { scores, metrics } = getPillarScores(snapshot, brand, state, range);
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
  }, [snapshot, state, range, weights]);

  if (!profile || !state) return <PageSkeleton variant="table" />;

  // Preview banner while the snapshot is still Phase-1 seed data — flips off
  // automatically once refresh.ts writes real metrics (tier !== "seed").
  const isSeed = snapshot.national[BRANDS[0]].sentiment?.sourceTier === "seed";

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar
        title="Brand Health"
        chips={[{ icon: "map-pin", label: state }]}
        asOf={snapshot.generatedAt.slice(0, 10)}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          A weighted composite of price momentum, customer sentiment, search interest, and
          website performance for every tracked brand in {state}. Adjust the weights to match
          what matters in your market.
        </p>

        {isSeed && (
          <div
            data-testid="bh-seed-banner"
            className="mb-4 rounded-tile bg-amber-fill text-amber-text border border-amber-border px-[18px] py-3 text-13 leading-normal"
          >
            <span className="font-bold">Preview — placeholder data.</span> Every score below
            is seed data; layout and interactions are real, values are not. The first monthly
            refresh replaces this snapshot and removes this banner.
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
            Quarters refer to {snapshot.dataYear}. Sentiment &amp; website are point-in-time.
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
            />
          ))}
        </div>

        <BrandHealthMethodology />
      </div>
    </main>
  );
}
