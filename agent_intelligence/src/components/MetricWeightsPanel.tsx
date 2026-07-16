"use client";

// Custom Metric Weights card — the four pillar sliders that drive every
// Brand Health score on the page. Raw slider values are whatever the user
// sets (each 0-100); the page always scores through normalizeWeights(), and
// this panel shows the normalized formula so what you read is what's applied.

import {
  DEFAULT_WEIGHTS,
  normalizeWeights,
  PILLAR_KEYS,
  PILLAR_LABELS,
  type Weights,
} from "@/lib/brandHealth";

type Props = {
  weights: Weights;                 // raw slider values (page state)
  onChange: (next: Weights) => void;
};

export default function MetricWeightsPanel({ weights, onChange }: Props): React.JSX.Element {
  const normalized = normalizeWeights(weights);
  const rawTotal = PILLAR_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const customized = PILLAR_KEYS.some(k => weights[k] !== DEFAULT_WEIGHTS[k]);

  return (
    <div
      data-testid="bh-weights-panel"
      className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-13 font-semibold text-ink">Metric Weights</span>
        {customized && (
          <span
            data-testid="bh-weights-customized"
            className="text-11 font-medium rounded-badge px-2 py-0.5 bg-amber-fill text-amber-text"
          >
            Customized
          </span>
        )}
        {customized && (
          <button
            type="button"
            data-testid="bh-weights-reset"
            onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
            className="ml-auto text-12 text-brand-red bg-transparent border-none cursor-pointer p-0 font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* The formula actually applied (normalized), rebuilt live. */}
      <p className="m-0 mb-3 text-12 text-ink-2" data-testid="bh-weights-formula">
        Brand Health ={" "}
        {PILLAR_KEYS.map(
          (k, i) => `${i > 0 ? " + " : ""}${normalized[k]}% ${PILLAR_LABELS[k]}`,
        ).join("")}
      </p>

      <div className="flex flex-col gap-2.5">
        {PILLAR_KEYS.map(k => (
          <label key={k} className="flex items-center gap-3" data-testid={`bh-weight-${k}`}>
            <span className="w-[150px] shrink-0 text-12 text-ink-2">{PILLAR_LABELS[k]}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[k]}
              onChange={e => onChange({ ...weights, [k]: Number(e.target.value) })}
              className="flex-1 accent-brand-red h-[4px] cursor-pointer"
            />
            <span className="w-10 shrink-0 text-12 font-medium text-ink text-right">
              {weights[k]}%
            </span>
          </label>
        ))}
      </div>

      {rawTotal !== 100 && (
        <p className="m-0 mt-2.5 text-11 text-ink-3" data-testid="bh-weights-normalize-note">
          Sliders total {rawTotal}% — scores use the auto-normalized weights shown in the
          formula above.
        </p>
      )}
    </div>
  );
}
