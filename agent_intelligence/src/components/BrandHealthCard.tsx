// One brand's Brand Health card: composite score ring + the four pillar
// bars that produced it, with per-pillar source tags. Purely presentational —
// the page computes the score (from current weights) and passes it in, per
// the "Brand Health is never stored" rule in src/lib/brandHealth.ts.

import {
  type BrandHealthResult,
  classifyScore,
  PILLAR_KEYS,
  PILLAR_LABELS,
  type PillarKey,
  type ScoreClass,
  type SourceBackedMetric,
} from "@/lib/brandHealth";
import type { Brand } from "@/lib/constants";

// Short pillar labels for the compact card rows — the full names live in
// the weights panel and methodology; here they'd truncate and crush the
// bars into slivers (observed in the Phase 2 screenshot).
const PILLAR_SHORT: Record<PillarKey, string> = {
  price: "Price",
  sentiment: "Sentiment",
  search: "Search",
  website: "Website",
};

// Badge + ring colors per score class. Follows the app's chip palettes;
// green = strong, blue = good, amber = fair, red = weak.
const CLASS_STYLES: Record<ScoreClass, { badge: string; ring: string; label: string }> = {
  excellent: { badge: "bg-green-fill text-green-text", ring: "text-green-text", label: "Excellent" },
  good: { badge: "bg-blue-fill text-blue-text", ring: "text-blue-text", label: "Good" },
  fair: { badge: "bg-amber-fill text-amber-text", ring: "text-amber-dot", label: "Fair" },
  weak: { badge: "bg-red-fill text-red-text", ring: "text-red-text", label: "Weak" },
};

// Short human tag for a metric's provenance, shown next to each pillar bar.
// "US" marks national-scope metrics so state pages never imply state
// precision they don't have.
function sourceTag(m: SourceBackedMetric): string {
  const parts: string[] = [];
  if (m.scope === "national") parts.push("US");
  if (m.sourceTier === "seed") parts.push("seed");
  else if (m.isEstimated) parts.push("est.");
  return parts.join(" · ");
}

function ScoreRing({
  score,
  scoreClass,
}: {
  score: number;
  scoreClass: ScoreClass;
}): React.JSX.Element {
  // r=26 → circumference ≈ 163.4; the arc is score% of it.
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[72px] h-[72px] shrink-0" data-testid="bh-score-ring">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-soft" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={CLASS_STYLES[scoreClass].ring}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-18 font-[650] text-ink">
        {score}
      </span>
    </div>
  );
}

type Props = {
  brand: Brand;
  result: BrandHealthResult | null; // null = nothing scorable in this state
  metrics: Record<PillarKey, SourceBackedMetric | null>;
  state: string;
};

export default function BrandHealthCard({
  brand,
  result,
  metrics,
  state,
}: Props): React.JSX.Element {
  const scoreClass = result ? classifyScore(result.score) : null;

  // Freshness footer: oldest dataAsOf among contributing pillars — the
  // honest "this score is only as fresh as its stalest input" date.
  const contributing = PILLAR_KEYS.map(k => metrics[k]).filter(
    (m): m is SourceBackedMetric => m !== null,
  );
  const oldestAsOf = contributing.reduce<string | null>(
    (acc, m) => (acc === null || m.dataAsOf < acc ? m.dataAsOf : acc),
    null,
  );

  return (
    <div
      data-testid="bh-card"
      data-brand={brand}
      className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-14 font-semibold text-ink">{brand}</span>
        {result && scoreClass ? (
          <span
            data-testid="bh-badge"
            className={`text-11 font-medium rounded-badge px-2 py-0.5 ${CLASS_STYLES[scoreClass].badge}`}
          >
            {CLASS_STYLES[scoreClass].label}
          </span>
        ) : (
          <span className="text-11 font-medium rounded-badge px-2 py-0.5 bg-gray-fill text-gray-text">
            Insufficient data
          </span>
        )}
      </div>

      <div className="flex items-center gap-5">
        {result && scoreClass ? (
          <ScoreRing score={result.score} scoreClass={scoreClass} />
        ) : (
          <div className="w-[72px] h-[72px] shrink-0 rounded-full bg-soft flex items-center justify-center text-18 text-ink-3">
            —
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {PILLAR_KEYS.map(k => {
            const m = metrics[k];
            return (
              <div key={k} className="flex items-center gap-2" data-testid={`bh-pillar-${k}`}>
                <span
                  className="w-[62px] shrink-0 text-11 text-ink-2 whitespace-nowrap"
                  title={PILLAR_LABELS[k]}
                >
                  {PILLAR_SHORT[k]}
                </span>
                {m ? (
                  <>
                    <span className="flex-1 h-[6px] rounded-full bg-soft overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-brand-navy"
                        style={{ width: `${m.value}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-12 font-medium text-ink text-right">
                      {m.value}
                    </span>
                    <span className="w-[44px] shrink-0 text-10 text-ink-3" title={m.note ?? m.sourceName}>
                      {sourceTag(m)}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-11 text-ink-3">
                    No data for {state}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Renormalization notice — the score exists but not all pillars fed it. */}
      {result && result.droppedPillars.length > 0 && (
        <p className="m-0 mt-2.5 text-11 text-ink-3" data-testid="bh-dropped-note">
          Scored on {result.usedPillars.length} of 4 pillars (
          {result.droppedPillars.map(k => PILLAR_LABELS[k]).join(", ")} unavailable
          {result.droppedPillars.some(k => k === "price" || k === "search") ? ` in ${state}` : ""}
          ) — weights renormalized.
        </p>
      )}

      {oldestAsOf && (
        <p className="m-0 mt-2 text-10 text-ink-3">
          Oldest input as of {oldestAsOf}
        </p>
      )}
    </div>
  );
}
